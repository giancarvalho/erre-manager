// Permission matrix: for each route, who gets in (status ≠ 403) and who gets 403. The fixture has one person
// per role, a pending member and someone from outside the community. Add one case per new route.
import { createModuleHarness, permissionMatrix, type RoleFixture } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi] });
let fx: RoleFixture;
beforeAll(async () => {
  fx = await h.fixture();
});
afterAll(() => h.close());

const AVISO = { title: 'Matriz', body: 'Texto do aviso.' };

describe('permissions (matrix)', () => {
  it('list: every approved member (avisos.ver)', async () => {
    const { problems } = await permissionMatrix(fx, ['owner', 'admin', 'moderador', 'membro'], (u) =>
      h.req(u, 'GET', '/v1/avisos', { community: fx.communityId }),
    );
    expect(problems).toEqual([]);
  });

  it('publish: owner, admin and moderador (avisos.publicar)', async () => {
    const { problems } = await permissionMatrix(fx, ['owner', 'admin', 'moderador'], (u) =>
      h.req(u, 'POST', '/v1/avisos', { community: fx.communityId, body: AVISO }),
    );
    expect(problems).toEqual([]);
  });

  it('delete: owner, admin and moderador (avisos.publicar)', async () => {
    const { problems } = await permissionMatrix(fx, ['owner', 'admin', 'moderador'], async (u) => {
      const created = await h.req(fx.users.owner, 'POST', '/v1/avisos', {
        community: fx.communityId,
        body: { title: 'Para apagar', body: 'Some já já.' },
      });
      const { id } = (await created.json()) as { id: string };
      return h.req(u, 'DELETE', `/v1/avisos/${id}`, { community: fx.communityId });
    });
    expect(problems).toEqual([]);
  });

  it('the list tells the screen who can publish', async () => {
    for (const [user, canPublish] of [
      [fx.users.moderador, true],
      [fx.users.membro, false],
    ] as const) {
      const res = await h.req(user, 'GET', '/v1/avisos', { community: fx.communityId });
      expect(((await res.json()) as { canPublish: boolean }).canPublish).toBe(canPublish);
    }
  });
});

describe('validation', () => {
  it('refuses an empty, too long or unknown body with 400', async () => {
    for (const body of [
      { title: '   ', body: 'ok' },
      { title: 'ok', body: '  ' },
      { title: 'ok' },
      { title: 'x'.repeat(121), body: 'ok' },
      { title: 'ok', body: 'x'.repeat(2001) },
      { title: 'ok', body: 'ok', extra: 1 },
      {},
    ]) {
      const res = await h.req(fx.users.owner, 'POST', '/v1/avisos', { community: fx.communityId, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('deleting an unknown or malformed id', async () => {
    const missing = await h.req(fx.users.owner, 'DELETE', '/v1/avisos/22222222-2222-4222-8222-222222222222', {
      community: fx.communityId,
    });
    expect(missing.status).toBe(404);
    const bad = await h.req(fx.users.owner, 'DELETE', '/v1/avisos/nao-e-uuid', { community: fx.communityId });
    expect(bad.status).toBe(400);
  });
});
