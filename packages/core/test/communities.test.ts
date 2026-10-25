import { randomUUID } from 'node:crypto';

import { withTenantTx } from '@erre/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import { CREATE_LIMIT_PER_DAY } from '../src/server/communities';
import { requireCommunity } from '../src/server/context';
import { errors } from '../src/server/errors';
import { errorHandler } from '../src/server/http';
import { memberships } from '../src/server/schema';
import { requireSession } from '../src/server/session';
import {
  addMember,
  createRoleFixture,
  createTestUser,
  permissionMatrix,
  type RoleFixture,
  type TestUser,
} from '../src/server/testing';
import { ORIGIN, setupCore } from './helpers';

const urls = inject('db');
let core: ReturnType<typeof setupCore>;
let fx: RoleFixture;
let other: RoleFixture;

const uniq = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function req(user: TestUser, method: string, path: string, body?: unknown, communityId?: string) {
  const headers: Record<string, string> = { cookie: user.cookie, origin: ORIGIN };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (communityId) headers['x-community-id'] = communityId;
  return core.app.request(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

beforeAll(async () => {
  core = setupCore(urls.app);
  fx = await createRoleFixture(core.app, core.google, core.db, { origin: ORIGIN });
  other = await createRoleFixture(core.app, core.google, core.db, { origin: ORIGIN });
});
afterAll(() => core.close());

describe('create community', () => {
  it('anyone signed in creates one and becomes owner', async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    const name = uniq();
    const res = await req(u, 'POST', '/v1/communities', { name });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string };
    expect(created).toMatchObject({ name, slug: name, role: 'owner' });
    const mine = (await (await req(u, 'GET', '/v1/me/communities')).json()) as { id: string }[];
    expect(mine.map((c) => c.id)).toEqual([created.id]);
  });

  it('validates the name like the legacy group name', async () => {
    const u = fx.users.membro;
    const bad = await req(u, 'POST', '/v1/communities', { name: 'Minha Bagunça' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toMatch(/letras minúsculas, números e hífens/);
    expect((await req(u, 'POST', '/v1/communities', { name: 'demo' })).status).toBe(400);
    expect((await req(u, 'POST', '/v1/communities', { name: 'x'.repeat(33) })).status).toBe(400);
  });

  it('refuses a name already in use', async () => {
    const name = uniq();
    expect((await req(fx.users.admin, 'POST', '/v1/communities', { name })).status).toBe(201);
    const dup = await req(fx.users.moderador, 'POST', '/v1/communities', { name });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ code: 'COMMUNITY_NAME_TAKEN', message: 'Esse nome já existe. Tente outro.' });
  });

  it(`limits creation to ${CREATE_LIMIT_PER_DAY} per day`, async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    for (let i = 0; i < CREATE_LIMIT_PER_DAY; i++) {
      expect((await req(u, 'POST', '/v1/communities', { name: uniq() })).status).toBe(201);
    }
    const res = await req(u, 'POST', '/v1/communities', { name: uniq() });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'TOO_MANY_COMMUNITIES' });
  });

  it('the creation transaction cannot write into another community', async () => {
    const newId = randomUUID();
    const err = await withTenantTx(core.db, { communityId: newId, userId: fx.users.outsider.id }, (tx) =>
      tx.insert(memberships).values({
        communityId: other.communityId,
        userId: fx.users.outsider.id,
        role: 'owner',
        status: 'approved',
      }),
    ).catch((e: { cause?: { code?: string } }) => e.cause?.code);
    expect(err).toBe('42501');
  });
});

describe('my communities', () => {
  it('lists approved memberships only, across communities, with RLS on', async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await addMember(core.db, fx.communityId, u.id, 'membro');
    await addMember(core.db, other.communityId, u.id, 'admin');
    const pendingIn = await createRoleFixture(core.app, core.google, core.db, { origin: ORIGIN });
    await addMember(core.db, pendingIn.communityId, u.id, 'membro', 'pending');
    const mine = (await (await req(u, 'GET', '/v1/me/communities')).json()) as { id: string; role: string }[];
    expect(mine.map((c) => c.id).sort()).toEqual([fx.communityId, other.communityId].sort());
    expect(mine.find((c) => c.id === other.communityId)?.role).toBe('admin');
  });

  it('a person without communities gets an empty list', async () => {
    expect(await (await req(fx.users.outsider, 'GET', '/v1/me/communities')).json()).toEqual([]);
  });
});

describe('request context', () => {
  const details = (u: TestUser, path: string, header?: string) => req(u, 'GET', path, undefined, header);

  it('opens for an approved member and returns role and permissions', async () => {
    const res = await details(fx.users.owner, `/v1/communities/${fx.communityId}`, fx.communityId);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: fx.communityId,
      role: 'owner',
      permissions: ['core.convites.gerenciar', 'core.membros.gerenciar'],
    });
    const m = (await (await details(fx.users.membro, `/v1/communities/${fx.communityId}`, fx.communityId)).json()) as {
      permissions: string[];
    };
    expect(m.permissions).toEqual([]);
  });

  it('403 without the header, with garbage, for outsiders, pending members and forged headers', async () => {
    const path = `/v1/communities/${fx.communityId}`;
    expect((await details(fx.users.owner, path)).status).toBe(403);
    expect((await details(fx.users.owner, path, 'not-a-uuid')).status).toBe(403);
    expect((await details(fx.users.outsider, path, fx.communityId)).status).toBe(403);
    expect((await details(fx.users.pending, path, fx.communityId)).status).toBe(403);
    // Member of A forging B's id, in the header and in the path.
    const forged = await details(fx.users.owner, `/v1/communities/${other.communityId}`, other.communityId);
    expect(forged.status).toBe(403);
    expect(await forged.json()).toEqual({ code: 'FORBIDDEN', message: 'Você não tem acesso a esta comunidade.' });
    // Header of A, path of B.
    expect((await details(fx.users.owner, `/v1/communities/${other.communityId}`, fx.communityId)).status).toBe(403);
  });

  it('rejected and removed members lose access', async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    for (const status of ['rejected', 'removed'] as const) {
      await addMember(core.db, fx.communityId, u.id, 'membro', status);
      expect((await details(u, `/v1/communities/${fx.communityId}`, fx.communityId)).status).toBe(403);
    }
  });

  it('rolls back the transaction when the route fails', async () => {
    const label = `rollback-${Date.now()}`;
    const app = new Hono()
      .route('/v1', core.app)
      .post('/t/throws', requireSession(core.auth), requireCommunity(core.db), async (c) => {
        await c.var.tx.update(memberships).set({ role: 'admin' });
        throw errors.rule('FAIL', label);
      })
      .post('/t/error-status', requireSession(core.auth), requireCommunity(core.db), async (c) => {
        await c.var.tx.update(memberships).set({ role: 'admin' });
        return c.json({ code: 'X', message: 'x' }, 422);
      })
      .onError(errorHandler({ error: () => undefined }));
    for (const path of ['/t/throws', '/t/error-status']) {
      const res = await app.request(path, {
        method: 'POST',
        headers: { cookie: fx.users.owner.cookie, 'x-community-id': fx.communityId },
      });
      expect(res.status).toBe(422);
      const rows = await withTenantTx(core.db, { communityId: fx.communityId, userId: fx.users.owner.id }, (tx) =>
        tx.select({ role: memberships.role }).from(memberships),
      );
      expect(rows.filter((r) => r.role === 'admin')).toHaveLength(1); // only the fixture's admin
    }
  });
});

describe('change member role', () => {
  const patch = (u: TestUser, target: string, role: string, communityId = fx.communityId) =>
    req(u, 'PATCH', `/v1/communities/${communityId}/members/${target}`, { role }, communityId);

  it('permission matrix: only owner and admin', async () => {
    const target = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await addMember(core.db, fx.communityId, target.id, 'membro');
    const { problems, statuses } = await permissionMatrix(fx, ['owner', 'admin'], (_u, headers) =>
      core.app.request(`/v1/communities/${fx.communityId}/members/${target.id}`, {
        method: 'PATCH',
        headers: { ...headers, origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'moderador' }),
      }),
    );
    expect(problems).toEqual([]);
    expect(statuses.owner).toBe(200);
  });

  it('admin promotes a member; nobody becomes owner here; the owner keeps the role', async () => {
    const target = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await addMember(core.db, fx.communityId, target.id, 'membro');
    const ok = await patch(fx.users.admin, target.id, 'admin');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ userId: target.id, role: 'admin' });

    expect((await patch(fx.users.owner, target.id, 'owner')).status).toBe(400);
    expect((await patch(fx.users.admin, fx.users.owner.id, 'membro')).status).toBe(403);
    const self = await patch(fx.users.owner, fx.users.owner.id, 'admin');
    expect(self.status).toBe(422);
    expect(await self.json()).toMatchObject({ code: 'OWNER_REQUIRED' });
  });

  it('404 for someone who is not an approved member', async () => {
    expect((await patch(fx.users.owner, fx.users.pending.id, 'admin')).status).toBe(404);
    expect((await patch(fx.users.owner, fx.users.outsider.id, 'admin')).status).toBe(404);
  });

  it('cannot reach members of another community', async () => {
    expect((await patch(fx.users.owner, other.users.membro.id, 'admin')).status).toBe(404);
    expect((await patch(fx.users.owner, other.users.membro.id, 'admin', other.communityId)).status).toBe(403);
  });
});
