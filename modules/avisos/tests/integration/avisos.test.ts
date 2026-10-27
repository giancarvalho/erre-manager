// The board end to end: publishing (with the push to the others), listing with the author, deleting, and LGPD.
import { createModuleHarness, type RoleFixture, type TestUser } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';

const ADMIN_SECRET = 'segredo-de-teste-avisos-1234567890';
const h = createModuleHarness({
  urls: inject('db'),
  modules: [moduleApi],
  recordPush: true,
  adminSecret: ADMIN_SECRET,
});

type Aviso = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  author: { userId: string; displayName: string } | null;
};

let fx: RoleFixture;
beforeAll(async () => {
  fx = await h.fixture('turma-do-volei');
  for (const u of Object.values(fx.users)) await h.subscribe(u);
});
afterAll(() => h.close());

const list = async (user: TestUser = fx.users.membro) => {
  const res = await h.req(user, 'GET', '/v1/avisos', { community: fx.communityId });
  expect(res.status).toBe(200);
  return ((await res.json()) as { avisos: Aviso[] }).avisos;
};

const publish = (user: TestUser, title: string, body = 'Texto do aviso.') =>
  h.req(user, 'POST', '/v1/avisos', { community: fx.communityId, body: { title, body } });

describe('publishing', () => {
  it('lists newest first, with the text and the author', async () => {
    expect((await publish(fx.users.admin, 'Primeiro', 'Corpo do primeiro.')).status).toBe(201);
    expect((await publish(fx.users.owner, 'Segundo', '  Corpo do segundo.  ')).status).toBe(201);
    const [second, first] = await list();
    expect(second).toMatchObject({ title: 'Segundo', body: 'Corpo do segundo.' });
    expect(second!.author?.userId).toBe(fx.users.owner.id);
    expect(first).toMatchObject({ title: 'Primeiro', body: 'Corpo do primeiro.' });
    expect(first!.author?.userId).toBe(fx.users.admin.id);
    expect(first!.author?.displayName).toBeTruthy();
  });

  it('pushes every other approved member once, never the author, the pending or outsiders', async () => {
    const sent = await h.pushesAfter(() => publish(fx.users.moderador, 'Treino cancelado'));
    expect(sent.map((p) => p.userId).sort()).toEqual([fx.users.owner.id, fx.users.admin.id, fx.users.membro.id].sort());
    expect(sent[0]).toMatchObject({
      title: '📌 Aviso novo em turma-do-volei',
      body: 'Treino cancelado',
      url: `/avisos?comunidade=${fx.communityId}`,
    });
  });

  it('no push when publishing fails', async () => {
    expect(await h.pushesAfter(() => publish(fx.users.membro, 'Sem permissão'))).toEqual([]);
    expect(await h.pushesAfter(() => publish(fx.users.owner, '   '))).toEqual([]);
  });

  it('deleting removes it for everyone, without a push', async () => {
    const created = await publish(fx.users.owner, 'Vai sumir');
    const { id } = (await created.json()) as { id: string };
    const sent = await h.pushesAfter(() =>
      h.req(fx.users.moderador, 'DELETE', `/v1/avisos/${id}`, { community: fx.communityId }),
    );
    expect(sent).toEqual([]);
    expect((await list()).map((a) => a.id)).not.toContain(id);
  });
});

describe('LGPD', () => {
  it('exports and erases what the person wrote, and only that', async () => {
    const other = await h.fixture();
    const writer = other.users.moderador;
    await h.req(writer, 'POST', '/v1/avisos', {
      community: other.communityId,
      body: { title: 'Meu aviso', body: 'Escrito por mim.' },
    });
    await h.req(other.users.owner, 'POST', '/v1/avisos', {
      community: other.communityId,
      body: { title: 'Da dona', body: 'Fica.' },
    });

    const exported = await h.req(writer, 'GET', '/v1/me/export');
    expect(exported.status).toBe(200);
    const text = JSON.stringify(await exported.json());
    expect(text).toContain('Escrito por mim.');
    expect(text).not.toContain('Da dona');

    const erased = await h.req(null, 'POST', `/v1/internal/users/${writer.id}/delete`, {
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    });
    expect(erased.status).toBe(200);
    const res = await h.req(other.users.owner, 'GET', '/v1/avisos', { community: other.communityId });
    const titles = ((await res.json()) as { avisos: Aviso[] }).avisos.map((a) => a.title);
    expect(titles).toEqual(['Da dona']);
  });

  it('a notice whose author left the community stays, without the author', async () => {
    const other = await h.fixture();
    await h.req(other.users.admin, 'POST', '/v1/avisos', {
      community: other.communityId,
      body: { title: 'Fica sem autor', body: 'A comunidade continua vendo.' },
    });
    const left = await h.req(other.users.admin, 'POST', `/v1/communities/${other.communityId}/leave`, {
      community: other.communityId,
    });
    expect(left.status).toBeLessThan(300);
    const res = await h.req(other.users.owner, 'GET', '/v1/avisos', { community: other.communityId });
    const [aviso] = ((await res.json()) as { avisos: Aviso[] }).avisos;
    expect(aviso).toMatchObject({ title: 'Fica sem autor', author: null });
  });
});
