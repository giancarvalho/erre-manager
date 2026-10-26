// Ported in behavior from queridometro@7c5c5bf: src/app/actions/group-membership.test.ts (voting part),
// src/app/actions/voting-token.test.ts (gate) and the voting cascade of postgres-group.repository.ts.
import { randomUUID } from 'node:crypto';

import {
  addMember,
  createModuleHarness,
  createTestUser,
  HARNESS_ORIGIN,
  permissionMatrix,
  type RoleFixture,
} from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { MAX_PARTICIPANTS } from '../../domain/limits';
import { helpers } from './helpers';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi] });
const t = helpers(h, inject('db').admin);
let fx: RoleFixture;

type Participation = { status: string | null; full: boolean; approvedCount: number; limit: number };

beforeAll(async () => {
  fx = await h.fixture();
});
afterAll(() => h.close());

describe('participation', () => {
  it('request → pending, idempotent; the moderator approves; the person becomes a target', async () => {
    const { membro, owner } = fx.users;
    expect((await t.json<Participation>(t.call(membro, 'GET', '/participacao', fx.communityId))).status).toBeNull();
    expect(await t.json(t.call(membro, 'POST', '/participacao', fx.communityId))).toEqual({
      status: 'pending',
      justRequested: true,
    });
    expect(await t.json(t.call(membro, 'POST', '/participacao', fx.communityId))).toEqual({
      status: 'pending',
      justRequested: false,
    });
    const list = await t.json<{ userId: string; status: string }[]>(
      t.call(owner, 'GET', '/participantes', fx.communityId),
    );
    expect(list.find((p) => p.userId === membro.id)?.status).toBe('pending');

    expect(await t.json(t.call(owner, 'POST', `/participantes/${membro.id}/aprovar`, fx.communityId))).toEqual({
      status: 'approved',
    });
    const round = await t.json<{ targets: { userId: string }[] }>(t.call(membro, 'GET', '/rodada', fx.communityId));
    expect(round.targets.map((x) => x.userId)).toContain(membro.id);
  });

  it('transitions: reject only from pending, remove only from approved; the removed asks again', async () => {
    const { owner } = fx.users;
    const u = await createTestUser(h.app, h.google, { origin: HARNESS_ORIGIN });
    await addMember(h.db, fx.communityId, u.id, 'membro');
    const act = (acao: string) => t.call(owner, 'POST', `/participantes/${u.id}/${acao}`, fx.communityId);

    expect((await act('aprovar')).status).toBe(404); // never asked
    await t.json(t.call(u, 'POST', '/participacao', fx.communityId));
    expect((await t.json<{ code: string }>(act('remover'), 409)).code).toBe('INVALID_TRANSITION');
    expect(await t.json(act('rejeitar'))).toEqual({ status: 'rejected' });
    expect((await t.json<{ code: string }>(act('rejeitar'), 409)).code).toBe('INVALID_TRANSITION');

    expect(await t.json(t.call(u, 'POST', '/participacao', fx.communityId))).toEqual({
      status: 'pending',
      justRequested: true,
    });
    await t.json(act('aprovar'));
    expect(await t.json(act('remover'))).toEqual({ status: 'removed' });
    const round = await t.json<{ targets: { userId: string }[] }>(t.call(u, 'GET', '/rodada', fx.communityId));
    expect(round.targets.map((x) => x.userId)).not.toContain(u.id);
  });

  it(`at most ${MAX_PARTICIPANTS} voters: above it the request waits as pending (D-027, R-MEM-04)`, async () => {
    const full = await h.fixture();
    // Fill the cap directly: 49 placeholder participants + the moderator's approval of a real one.
    for (let i = 0; i < MAX_PARTICIPANTS - 1; i++)
      await t.admin("INSERT INTO errometro_participants (community_id, user_id, status) VALUES ($1, $2, 'approved')", [
        full.communityId,
        randomUUID(),
      ]);
    await t.makeVoter(full, full.users.admin);
    const view = await t.json<Participation>(t.call(full.users.membro, 'GET', '/participacao', full.communityId));
    expect(view).toMatchObject({ full: true, approvedCount: MAX_PARTICIPANTS, limit: MAX_PARTICIPANTS });

    await t.json(t.call(full.users.membro, 'POST', '/participacao', full.communityId));
    const res = await t.json<{ code: string; message: string }>(
      t.call(full.users.owner, 'POST', `/participantes/${full.users.membro.id}/aprovar`, full.communityId),
      422,
    );
    expect(res.code).toBe('PARTICIPANTS_FULL');
    // Removing someone opens the slot.
    await t.json(t.call(full.users.owner, 'POST', `/participantes/${full.users.admin.id}/remover`, full.communityId));
    await t.json(t.call(full.users.owner, 'POST', `/participantes/${full.users.membro.id}/aprovar`, full.communityId));
  });

  it('permission matrix', async () => {
    const all = ['owner', 'admin', 'moderador', 'membro'] as const;
    const mods = ['owner', 'admin'] as const;
    const cases: [readonly string[], string, string][] = [
      [all, 'GET', '/rodada'],
      [all, 'GET', '/participacao'],
      [all, 'POST', '/participacao'],
      [mods, 'GET', '/participantes'],
      [mods, 'POST', `/participantes/${randomUUID()}/aprovar`],
      [mods, 'GET', '/config/emojis'],
      [mods, 'GET', '/config/cadencia'],
    ];
    for (const [allowed, method, path] of cases) {
      const { problems } = await permissionMatrix(fx, allowed as never, (user, headers) =>
        h.app.request(`/v1/errometro${path}`, { method, headers: { ...headers, origin: HARNESS_ORIGIN } }),
      );
      expect(problems, `${method} ${path}`).toEqual([]);
    }
  });

  it('voting needs an approved participation: an approved member who is not a voter gets 403 (legacy gate)', async () => {
    const outsiderOfVoting = fx.users.moderador;
    expect((await t.call(outsiderOfVoting, 'GET', '/chave', fx.communityId)).status).toBe(403);
    expect((await t.call(outsiderOfVoting, 'POST', '/token', fx.communityId, { blindedMsgB64: 'AAAA' })).status).toBe(
      403,
    );
  });
});

describe('membership cascade (D-023, R-MEM-05)', () => {
  async function inviteAndRequest(c: RoleFixture) {
    const { code } = await t.json<{ code: string }>(
      h.req(c.users.owner, 'POST', `/v1/communities/${c.communityId}/invites`, {
        community: c.communityId,
        body: { intent: 'errometro.participar' },
      }),
      201,
    );
    const u = await createTestUser(h.app, h.google, { origin: HARNESS_ORIGIN, name: 'Convidada' });
    await t.json(h.req(u, 'POST', `/v1/invites/${code}/join`));
    return u;
  }
  const approve = (c: RoleFixture, userId: string) =>
    t.json(
      h.req(c.users.owner, 'POST', `/v1/communities/${c.communityId}/requests/${userId}/approve`, {
        community: c.communityId,
      }),
    );

  it('one request: approving the join with the Errômetro intent approves the voting too', async () => {
    const u = await inviteAndRequest(fx);
    await approve(fx, u.id);
    expect((await t.json<Participation>(t.call(u, 'GET', '/participacao', fx.communityId))).status).toBe('approved');
  });

  it('with the cap full, the person joins the community and the voting waits as pending', async () => {
    const c = await h.fixture();
    for (let i = 0; i < MAX_PARTICIPANTS; i++)
      await t.admin("INSERT INTO errometro_participants (community_id, user_id, status) VALUES ($1, $2, 'approved')", [
        c.communityId,
        randomUUID(),
      ]);
    const u = await inviteAndRequest(c);
    await approve(c, u.id);
    expect(await t.json<Participation>(t.call(u, 'GET', '/participacao', c.communityId))).toMatchObject({
      status: 'pending',
      full: true,
    });
  });

  it('leaving or being removed from the community takes the voting along', async () => {
    const leaver = await t.newVoter(fx, 'Sai');
    const removed = await t.newVoter(fx, 'Removida');
    await t.json(h.req(leaver, 'POST', `/v1/communities/${fx.communityId}/leave`, { community: fx.communityId }));
    await t.json(
      h.req(fx.users.owner, 'POST', `/v1/communities/${fx.communityId}/members/${removed.id}/remove`, {
        community: fx.communityId,
      }),
    );
    const rows = await t.admin<{ user_id: string; status: string }>(
      'SELECT user_id, status FROM errometro_participants WHERE community_id = $1 AND user_id = ANY($2)',
      [fx.communityId, [leaver.id, removed.id]],
    );
    expect(rows.map((r) => r.status)).toEqual(['removed', 'removed']);
    const round = await t.json<{ targets: { userId: string }[] }>(
      t.call(fx.users.owner, 'GET', '/rodada', fx.communityId),
    );
    expect(round.targets.map((x) => x.userId)).not.toContain(leaver.id);
    expect(round.targets.map((x) => x.userId)).not.toContain(removed.id);
  });

  it('targets are read through ctx.members: a participant whose membership is gone is not a target', async () => {
    const ghost = await t.newVoter(fx, 'Fantasma');
    // Membership changed behind the module's back (no hook ran).
    await t.admin("UPDATE core_community_memberships SET status = 'removed' WHERE community_id = $1 AND user_id = $2", [
      fx.communityId,
      ghost.id,
    ]);
    const round = await t.json<{ targets: { userId: string }[] }>(
      t.call(fx.users.owner, 'GET', '/rodada', fx.communityId),
    );
    expect(round.targets.map((x) => x.userId)).not.toContain(ghost.id);
  });

  it('isolation: participants of one community are not targets of another', async () => {
    const other = await h.fixture();
    const round = await t.json<{ targets: { userId: string }[] }>(
      t.call(other.users.owner, 'GET', '/rodada', other.communityId),
    );
    expect(round.targets.map((x) => x.userId)).not.toContain(fx.users.membro.id);
  });
});
