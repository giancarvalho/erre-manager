import { and, eq } from '@erre/db';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import type { MemberHookContext, MembershipHooks } from '../src/server/hooks';
import { decodeInviteCode, encodeInviteCode } from '../src/server/invites';
import { MAX_MEMBERS } from '../src/server/members';
import { memberships } from '../src/server/schema';
import {
  createRoleFixture,
  createTestUser,
  permissionMatrix,
  type RoleFixture,
  type TestUser,
} from '../src/server/testing';
import { ORIGIN, setupCore } from './helpers';

const urls = inject('db');
const calls: { kind: string; userId: string; approvedInTx?: boolean }[] = [];
let failLeft = false;

const hooks: MembershipHooks = {
  intents: [
    {
      id: 'teste.participar',
      label: 'Entrar e participar do teste',
      async onApproved(ctx: MemberHookContext) {
        const [m] = await ctx.tx
          .select({ s: memberships.status })
          .from(memberships)
          .where(and(eq(memberships.communityId, ctx.communityId), eq(memberships.userId, ctx.userId)));
        calls.push({ kind: 'approved', userId: ctx.userId, approvedInTx: m?.s === 'approved' });
      },
    },
    {
      id: 'teste.quebra',
      label: 'Intenção que falha',
      async onApproved(ctx: MemberHookContext) {
        await ctx.tx
          .update(memberships)
          .set({ role: 'moderador' })
          .where(and(eq(memberships.communityId, ctx.communityId), eq(memberships.userId, ctx.userId)));
        throw new Error('module failed');
      },
    },
  ],
  onMemberLeft: [
    async (ctx) => {
      calls.push({ kind: 'left', userId: ctx.userId });
      if (failLeft) throw new Error('module could not clean up');
    },
  ],
};

let core: ReturnType<typeof setupCore>;
let fx: RoleFixture;
let other: RoleFixture;

function call(user: TestUser | null, method: string, path: string, body?: unknown, communityId?: string) {
  const headers: Record<string, string> = { origin: ORIGIN };
  if (user) headers.cookie = user.cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (communityId) headers['x-community-id'] = communityId;
  return core.app.request(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

const asOwner = (method: string, path: string, body?: unknown) =>
  call(fx.users.owner, method, `/v1/communities/${fx.communityId}${path}`, body, fx.communityId);

async function newInvite(intent?: string): Promise<string> {
  const res = await asOwner('POST', '/invites', intent ? { intent } : {});
  expect(res.status).toBe(201);
  return ((await res.json()) as { code: string }).code;
}

const join = (u: TestUser, code: string) => call(u, 'POST', `/v1/invites/${code}/join`);
const moderate = (action: 'approve' | 'reject', userId: string) => asOwner('POST', `/requests/${userId}/${action}`);
const remove = (userId: string) => asOwner('POST', `/members/${userId}/remove`);
const canOpen = async (u: TestUser) =>
  (await call(u, 'GET', `/v1/communities/${fx.communityId}`, undefined, fx.communityId)).status;

beforeAll(async () => {
  core = setupCore(urls.app, {}, hooks);
  fx = await createRoleFixture(core.app, core.google, core.db, { origin: ORIGIN });
  other = await createRoleFixture(core.app, core.google, core.db, { origin: ORIGIN });
});
afterAll(() => core.close());

describe('invite codes', () => {
  it('carry the community id and a secret', () => {
    const code = encodeInviteCode('3f1c2a9e-8b7d-4c6e-9f01-23456789abcd', 'AbCdEfGhIj_-');
    expect(code).toHaveLength(34);
    expect(decodeInviteCode(code)).toEqual({
      communityId: '3f1c2a9e-8b7d-4c6e-9f01-23456789abcd',
      secret: 'AbCdEfGhIj_-',
    });
    for (const bad of ['', 'x', code.slice(1), `${code}!`, `${code.slice(0, 33)}*`])
      expect(decodeInviteCode(bad)).toBeNull();
  });
});

describe('managing invites', () => {
  it('permission matrix: only owner and admin create invites', async () => {
    const { problems } = await permissionMatrix(fx, ['owner', 'admin'], (_u, headers) =>
      core.app.request(`/v1/communities/${fx.communityId}/invites`, {
        method: 'POST',
        headers: { ...headers, origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(problems).toEqual([]);
  });

  it('lists active invites and revokes them', async () => {
    const code = await newInvite();
    const list = (await (await asOwner('GET', '/invites')).json()) as { id: string; code: string }[];
    const mine = list.find((i) => i.code === code);
    expect(mine).toBeTruthy();
    expect((await asOwner('POST', `/invites/${mine!.id}/revoke`)).status).toBe(200);
    const after = (await (await asOwner('GET', '/invites')).json()) as { code: string }[];
    expect(after.some((i) => i.code === code)).toBe(false);
    expect((await call(null, 'GET', `/v1/invites/${code}`)).status).toBe(404);
    expect((await join(fx.users.outsider, code)).status).toBe(404);
    expect((await asOwner('POST', `/invites/${mine!.id}/revoke`)).status).toBe(404);
  });

  it('refuses an intent nobody declared', async () => {
    expect((await asOwner('POST', '/invites', { intent: 'nada.disso' })).status).toBe(400);
  });
});

describe('joining', () => {
  it('public preview shows only the community name and the intent', async () => {
    const code = await newInvite('teste.participar');
    const res = await call(null, 'GET', `/v1/invites/${code}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      community: { id: fx.communityId, name: expect.any(String) },
      intent: { id: 'teste.participar', label: 'Entrar e participar do teste' },
      myStatus: null,
    });
    const asMember = (await (await call(fx.users.membro, 'GET', `/v1/invites/${code}`)).json()) as { myStatus: string };
    expect(asMember.myStatus).toBe('approved');
  });

  it('a request is always pending and opens nothing until approved', async () => {
    const code = await newInvite();
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN, name: 'Nova' });
    const res = await join(u, code);
    expect(await res.json()).toEqual({ communityId: fx.communityId, status: 'pending' });
    expect(await (await join(u, code)).json()).toMatchObject({ status: 'pending' });
    expect(await canOpen(u)).toBe(403);
    const mine = (await (await call(u, 'GET', '/v1/me/requests')).json()) as { id: string }[];
    expect(mine.map((r) => r.id)).toEqual([fx.communityId]);

    const reqs = (await (await asOwner('GET', '/requests')).json()) as { userId: string; displayName: string }[];
    expect(reqs.find((r) => r.userId === u.id)?.displayName).toBe('Nova');
    expect((await moderate('approve', u.id)).status).toBe(200);
    expect(await canOpen(u)).toBe(200);
    const members = (await (await asOwner('GET', '/members')).json()) as { userId: string; role: string }[];
    expect(members.find((m) => m.userId === u.id)).toMatchObject({ role: 'membro' });
    expect(await (await join(u, code)).json()).toMatchObject({ status: 'approved' });
  });

  it('follows the legacy transitions, including asking again after reject or removal', async () => {
    const code = await newInvite();
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await join(u, code);
    // pending: approve/reject ok, remove not
    expect((await remove(u.id)).status).toBe(409);
    expect(await (await moderate('reject', u.id)).json()).toEqual({ userId: u.id, status: 'rejected' });
    expect((await moderate('approve', u.id)).status).toBe(409);
    expect((await moderate('reject', u.id)).status).toBe(409);
    // rejected → pending by asking again
    expect(await (await join(u, code)).json()).toMatchObject({ status: 'pending' });
    expect((await moderate('approve', u.id)).status).toBe(200);
    // approved: remove ok, approve/reject not
    expect((await moderate('approve', u.id)).status).toBe(409);
    expect((await moderate('reject', u.id)).status).toBe(409);
    expect(await (await remove(u.id)).json()).toEqual({ userId: u.id, status: 'removed' });
    expect(await canOpen(u)).toBe(403);
    // removed → pending by asking again, never straight back in
    expect(await (await join(u, code)).json()).toMatchObject({ status: 'pending' });
    expect(await canOpen(u)).toBe(403);
  });

  it('an invite of one community cannot be pointed at another', async () => {
    const code = await newInvite();
    const forged = encodeInviteCode(other.communityId, code.slice(22));
    expect((await call(null, 'GET', `/v1/invites/${forged}`)).status).toBe(404);
    expect((await join(fx.users.outsider, forged)).status).toBe(404);
  });

  it('only managers see and decide requests', async () => {
    const code = await newInvite();
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await join(u, code);
    const { problems } = await permissionMatrix(fx, ['owner', 'admin'], (_x, headers) =>
      core.app.request(`/v1/communities/${fx.communityId}/requests`, { headers }),
    );
    expect(problems).toEqual([]);
    const approve = await call(
      fx.users.moderador,
      'POST',
      `/v1/communities/${fx.communityId}/requests/${u.id}/approve`,
      undefined,
      fx.communityId,
    );
    expect(approve.status).toBe(403);
  });
});

describe('leaving and removing', () => {
  it('a member leaves; the owner cannot leave or be removed', async () => {
    const code = await newInvite();
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await join(u, code);
    await moderate('approve', u.id);
    const left = await call(u, 'POST', `/v1/communities/${fx.communityId}/leave`, undefined, fx.communityId);
    expect(await left.json()).toEqual({ userId: u.id, status: 'removed' });
    expect(await canOpen(u)).toBe(403);

    const ownerLeaves = await asOwner('POST', '/leave');
    expect(ownerLeaves.status).toBe(422);
    expect(await ownerLeaves.json()).toMatchObject({ code: 'OWNER_CANNOT_LEAVE' });
    const removeOwner = await call(
      fx.users.admin,
      'POST',
      `/v1/communities/${fx.communityId}/members/${fx.users.owner.id}/remove`,
      undefined,
      fx.communityId,
    );
    expect(removeOwner.status).toBe(422);
  });
});

describe('module hooks (one request only)', () => {
  it('the intent of the invite runs in the approval transaction', async () => {
    const code = await newInvite('teste.participar');
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await join(u, code);
    await moderate('approve', u.id);
    expect(calls).toContainEqual({ kind: 'approved', userId: u.id, approvedInTx: true });
  });

  it('a failing intent is undone alone: the person still joins', async () => {
    const code = await newInvite('teste.quebra');
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await join(u, code);
    expect((await moderate('approve', u.id)).status).toBe(200);
    expect(await canOpen(u)).toBe(200);
    const members = (await (await asOwner('GET', '/members')).json()) as { userId: string; role: string }[];
    expect(members.find((m) => m.userId === u.id)?.role).toBe('membro'); // the hook's update was rolled back
    expect(core.logs.some((l) => l.includes('join intent teste.quebra failed'))).toBe(true);
  });

  it('modules hear about rejections and removals; if they fail, nothing changes', async () => {
    const code = await newInvite();
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await join(u, code);
    await moderate('approve', u.id);
    failLeft = true;
    try {
      expect((await remove(u.id)).status).toBe(500);
    } finally {
      failLeft = false;
    }
    expect(await canOpen(u)).toBe(200);
    expect((await remove(u.id)).status).toBe(200);
    expect(calls.filter((c) => c.kind === 'left' && c.userId === u.id)).toHaveLength(2);
  });
});

describe(`limit of ${MAX_MEMBERS} members`, () => {
  it('approval waits when the community is full; the request stays pending', async () => {
    const full = await createRoleFixture(core.app, core.google, core.db, { origin: ORIGIN });
    const admin = new pg.Client({ connectionString: urls.admin });
    await admin.connect();
    try {
      // Superuser connection (tests only) fills the community up to the limit.
      const approvedNow = 4; // owner, admin, moderador, membro of the fixture
      await admin.query(
        `WITH u AS (
           INSERT INTO auth_user (name, email) SELECT 'p' || g, 'full-' || $2 || '-' || g || '@example.com'
           FROM generate_series(1, $1) g RETURNING id)
         INSERT INTO core_community_memberships (community_id, user_id, role, status)
         SELECT $3, id, 'membro', 'approved' FROM u`,
        [MAX_MEMBERS - approvedNow, Date.now().toString(36), full.communityId],
      );
    } finally {
      await admin.end();
    }
    const res = await call(
      full.users.owner,
      'POST',
      `/v1/communities/${full.communityId}/requests/${full.users.pending.id}/approve`,
      undefined,
      full.communityId,
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'COMMUNITY_FULL' });
    const reqs = (await (
      await call(full.users.owner, 'GET', `/v1/communities/${full.communityId}/requests`, undefined, full.communityId)
    ).json()) as { userId: string }[];
    expect(reqs.map((r) => r.userId)).toContain(full.users.pending.id);
  });
});
