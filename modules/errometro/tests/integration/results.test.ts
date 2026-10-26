// Ported in behavior from queridometro@7c5c5bf: src/app/results/page.tsx (real-group branch),
// src/app/actions/comments.test.ts and src/infrastructure/comments/in-memory-comment.repository.test.ts.
import {
  createModuleHarness,
  permissionMatrix,
  HARNESS_ORIGIN,
  type RoleFixture,
  type TestUser,
} from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { helpers } from './helpers';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi] });
const t = helpers(h, inject('db').admin);

type Entry = {
  member: { userId: string; displayName: string };
  byEmoji: { emojiId: string; char: string; count: number }[];
  total: number;
  trophies: { wins: { emojiId: string }[]; nearMisses: { emojiId: string }[] };
};
type Results = {
  days: string[];
  period: string | null;
  ranking: Entry[];
  trophies: { emojiId: string; winnerTargetId: string | null; char: string; trophyName: string; count: number }[];
  commentCounts: Record<string, number>;
  nextReleaseAt: string | null;
  hiddenCount?: number;
};
type Comment = { id: string; authorId: string; authorName: string; text: string; updatedAt: string | null };

let fx: RoleFixture;
let voters: TestUser[];
let target: TestUser;
let closedPeriod: string;

const results = (user: TestUser, query = '') =>
  t.json<Results>(t.call(user, 'GET', `/resultados${query}`, fx.communityId));

beforeAll(async () => {
  fx = await h.fixture('resultados');
  target = await t.newVoter(fx, 'Alvo');
  voters = [await t.newVoter(fx, 'V1'), await t.newVoter(fx, 'V2'), await t.newVoter(fx, 'V3')];
});
afterAll(() => h.close());

describe('results', () => {
  it('before any close: no round, and when the next one is due', async () => {
    const r = await results(fx.users.membro);
    expect(r).toMatchObject({ days: [], period: null, ranking: [] });
    expect(r.nextReleaseAt).toMatch(/^\d{4}-/);
    expect(r).not.toHaveProperty('hiddenCount');
  });

  it('after the close: every current member ranked (voters or not), trophies at 3+ votes (R-RES-06, R-TRO-01)', async () => {
    for (const v of voters) {
      const tk = await t.getToken(fx, v);
      await t.json(t.vote(fx.communityId, tk, { [target.id]: 'coracao', [voters[0]!.id]: 'cobra' }));
    }
    closedPeriod = (await t.json<{ period: string }>(t.call(fx.users.owner, 'POST', '/rodada/liberar', fx.communityId)))
      .period;

    const r = await results(fx.users.membro);
    expect(r.days).toEqual([closedPeriod]);
    expect(r.period).toBe(closedPeriod);
    expect(r.ranking[0]).toMatchObject({
      member: { userId: target.id, displayName: 'Alvo' },
      byEmoji: [{ emojiId: 'coracao', char: '❤️', count: 3 }],
      total: 3,
      trophies: { wins: [{ emojiId: 'coracao' }], nearMisses: [] },
    });
    // Non-voting members are listed with zero (legacy results ranked every group member).
    const zero = r.ranking.find((e) => e.member.userId === fx.users.moderador.id);
    expect(zero).toMatchObject({ total: 0, byEmoji: [] });
    expect(r.trophies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ emojiId: 'coracao', winnerTargetId: target.id, char: '❤️', count: 3 }),
      ]),
    );
  });

  it('hidden rounds vanish for members; moderators learn how many are hidden (R-RES-07)', async () => {
    await t.json(t.call(fx.users.owner, 'POST', `/rodadas/${closedPeriod}/ocultar`, fx.communityId, { hidden: true }));
    const member = await results(fx.users.membro, `?rodada=${closedPeriod}`);
    expect(member).toMatchObject({ days: [], period: null });
    expect(member).not.toHaveProperty('hiddenCount');
    expect((await results(fx.users.admin)).hiddenCount).toBe(1);
    await t.json(t.call(fx.users.owner, 'POST', `/rodadas/${closedPeriod}/ocultar`, fx.communityId, { hidden: false }));
    expect((await results(fx.users.membro, '?rodada=2001-01-01')).period).toBe(closedPeriod);
    expect((await t.call(fx.users.membro, 'GET', '/resultados?rodada=ontem', fx.communityId)).status).toBe(400);
  });

  it('trophies show up on the winner’s profile (profile section errometro.trofeus)', async () => {
    const sections = await t.json<{ id: string; data: unknown }[]>(
      h.req(fx.users.membro, 'GET', `/v1/profile/${target.id}/sections`, { community: fx.communityId }),
    );
    expect(sections).toEqual([
      {
        id: 'errometro.trofeus',
        module: 'errometro',
        data: [
          { emojiId: 'coracao', char: '❤️', trophyName: expect.any(String), glowRgb: expect.any(String), winCount: 1 },
        ],
      },
    ]);
    const none = await t.json<unknown[]>(
      h.req(fx.users.membro, 'GET', `/v1/profile/${fx.users.moderador.id}/sections`, { community: fx.communityId }),
    );
    expect(none).toEqual([]);
  });

  it('permission matrix: results are for every member; pending and outsiders get 403', async () => {
    const { problems } = await permissionMatrix(fx, ['owner', 'admin', 'moderador', 'membro'], (_u, headers) =>
      h.app.request('/v1/errometro/resultados', { headers: { ...headers, origin: HARNESS_ORIGIN } }),
    );
    expect(problems).toEqual([]);
  });
});

describe('comments', () => {
  const post = (user: TestUser, text: string, targetId = target.id) =>
    t.call(user, 'POST', '/comentarios', fx.communityId, { targetId, period: closedPeriod, text });
  const list = (user: TestUser) =>
    t.json<Comment[]>(t.call(user, 'GET', `/comentarios?alvo=${target.id}&rodada=${closedPeriod}`, fx.communityId));

  it('create (trimmed, 1-280 chars), list in order with the author name read from the profile', async () => {
    const first = await t.json<Comment>(post(fx.users.membro, '  Mereceu!  '), 201);
    expect(first).toMatchObject({
      authorId: fx.users.membro.id,
      authorName: 'Membro',
      text: 'Mereceu!',
      updatedAt: null,
    });
    await t.json(post(fx.users.admin, 'Concordo'), 201);
    expect((await list(fx.users.moderador)).map((c) => c.text)).toEqual(['Mereceu!', 'Concordo']);
    expect((await post(fx.users.membro, '   ')).status).toBe(400);
    expect((await post(fx.users.membro, 'x'.repeat(281))).status).toBe(400);
    await t.json(post(fx.users.membro, 'x'.repeat(280)), 201);
    expect((await results(fx.users.membro)).commentCounts[target.id]).toBe(3);
  });

  it('only the author edits; the author or a moderator deletes', async () => {
    const mine = await t.json<Comment>(post(fx.users.membro, 'Original'), 201);
    expect(
      (await t.call(fx.users.moderador, 'PATCH', `/comentarios/${mine.id}`, fx.communityId, { text: 'Hackeado' }))
        .status,
    ).toBe(404);
    const edited = await t.json<Comment>(
      t.call(fx.users.membro, 'PATCH', `/comentarios/${mine.id}`, fx.communityId, { text: 'Editado' }),
    );
    expect(edited.text).toBe('Editado');
    expect(edited.updatedAt).not.toBeNull();

    expect((await t.call(fx.users.moderador, 'DELETE', `/comentarios/${mine.id}`, fx.communityId)).status).toBe(404);
    await t.json(t.call(fx.users.admin, 'DELETE', `/comentarios/${mine.id}`, fx.communityId));
    const another = await t.json<Comment>(post(fx.users.moderador, 'Meu'), 201);
    await t.json(t.call(fx.users.moderador, 'DELETE', `/comentarios/${another.id}`, fx.communityId));
    expect((await list(fx.users.membro)).map((c) => c.text)).not.toContain('Editado');
  });

  it("a comment's author who left the community shows as a former member", async () => {
    const leaver = await t.newVoter(fx, 'Saiu');
    await t.json(post(leaver, 'Tchau'), 201);
    await t.json(h.req(leaver, 'POST', `/v1/communities/${fx.communityId}/leave`, { community: fx.communityId }));
    expect((await list(fx.users.membro)).find((c) => c.text === 'Tchau')?.authorName).toBe('Ex-membro');
  });

  it('isolation: a comment of one community is not reachable from another', async () => {
    const mine = await t.json<Comment>(post(fx.users.membro, 'Só aqui'), 201);
    const other = await h.fixture();
    expect((await t.call(other.users.owner, 'DELETE', `/comentarios/${mine.id}`, other.communityId)).status).toBe(404);
    expect(
      await t.json(
        t.call(other.users.owner, 'GET', `/comentarios?alvo=${target.id}&rodada=${closedPeriod}`, other.communityId),
      ),
    ).toEqual([]);
  });
});
