// One community never sees or changes another one's data, even knowing the ids (RLS + membership check).
import { createModuleHarness, type RoleFixture } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi] });
let a: RoleFixture;
let b: RoleFixture;
beforeAll(async () => {
  a = await h.fixture();
  b = await h.fixture();
});
afterAll(() => h.close());

const list = async (fx: RoleFixture) => {
  const res = await h.req(fx.users.owner, 'GET', '/v1/avisos', { community: fx.communityId });
  expect(res.status).toBe(200);
  return ((await res.json()) as { avisos: { id: string; title: string }[] }).avisos;
};

describe('isolation between communities', () => {
  it("B doesn't see, delete or reach A's notices", async () => {
    const created = await h.req(a.users.owner, 'POST', '/v1/avisos', {
      community: a.communityId,
      body: { title: 'Só da A', body: 'Ninguém da B vê.' },
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    expect((await list(a)).map((i) => i.id)).toContain(id);
    expect((await list(b)).map((i) => i.id)).not.toContain(id);

    // Deleting A's notice from B: not found, and it is still there.
    const del = await h.req(b.users.owner, 'DELETE', `/v1/avisos/${id}`, { community: b.communityId });
    expect(del.status).toBe(404);
    expect((await list(a)).map((i) => i.id)).toContain(id);

    // B's owner naming A in the header: refused before reaching the module.
    const spoof = await h.req(b.users.owner, 'GET', '/v1/avisos', { community: a.communityId });
    expect(spoof.status).toBe(403);
  });
});
