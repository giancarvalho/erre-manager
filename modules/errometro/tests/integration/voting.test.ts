// Ported in behavior from queridometro@7c5c5bf:src/lib/voting/anonymous-voting.test.ts (against the real API,
// Postgres and RLS instead of in-memory repositories) and src/app/actions/voting-token.test.ts.
import { createModuleHarness, type RoleFixture, type TestUser } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { helpers, type Token } from './helpers';

const logged: string[] = [];
const capture = (obj: object, msg: string) => void logged.push(`${msg} ${JSON.stringify(obj)}`);
const h = createModuleHarness({
  urls: inject('db'),
  modules: [moduleApi],
  log: { info: capture, error: capture },
});
const t = helpers(h, inject('db').admin);

let fx: RoleFixture;
let ana: TestUser;
let bia: TestUser;
let caio: TestUser;

beforeAll(async () => {
  fx = await h.fixture();
  ana = await t.newVoter(fx, 'Ana');
  bia = await t.newVoter(fx, 'Bia');
  caio = await t.newVoter(fx, 'Caio');
});
afterAll(() => h.close());

const tally = (communityId: string) =>
  t.admin<{ target_id: string; emoji_id: string; n: string }>(
    `SELECT target_id, emoji_id, count(*) AS n FROM errometro_votes WHERE community_id = $1
      GROUP BY target_id, emoji_id ORDER BY target_id, emoji_id`,
    [communityId],
  );

describe('token issuance', () => {
  it('one token per person and round; a second request is refused (R-ANON-01)', async () => {
    const voter = await t.newVoter(fx, 'Duda');
    await t.getToken(fx, voter);
    const key = await t.json<{ publicKeyJwk: unknown }>(t.call(voter, 'GET', '/chave', fx.communityId));
    expect(key.publicKeyJwk).toEqual(expect.objectContaining({ kty: 'RSA' }));
    expect(Object.keys(key.publicKeyJwk as object).sort()).toEqual(['e', 'kty', 'n']);
    const { startToken } = await import('@erre/anon-vote/client');
    const again = await t.json<{ code: string }>(
      t.call(voter, 'POST', '/token', fx.communityId, {
        blindedMsgB64: startToken(key.publicKeyJwk as never).blindedMsgB64,
      }),
      409,
    );
    expect(again.code).toBe('TOKEN_ALREADY_ISSUED');
  });

  it('a malformed blinded message is refused without burning the token', async () => {
    const voter = await t.newVoter(fx, 'Eva');
    expect((await t.call(voter, 'POST', '/token', fx.communityId, { blindedMsgB64: 'AAAA' })).status).toBe(400);
    const tooBig = Buffer.alloc(256, 0xff).toString('base64url');
    expect((await t.call(voter, 'POST', '/token', fx.communityId, { blindedMsgB64: tooBig })).status).toBe(400);
    await t.getToken(fx, voter);
  });

  it('the issuance stores only (person, community, round) — no time (R-ANON-02)', async () => {
    const rows = await t.admin('SELECT * FROM errometro_token_issuances WHERE community_id = $1 AND user_id = $2', [
      fx.communityId,
      ana.id,
    ]);
    expect(rows).toEqual([]); // Ana has not asked yet
    await t.getToken(fx, ana).then((tk) => (anaToken = tk));
    const after = await t.admin<Record<string, unknown>>(
      'SELECT * FROM errometro_token_issuances WHERE community_id = $1 AND user_id = $2',
      [fx.communityId, ana.id],
    );
    expect(after).toHaveLength(1);
    expect(Object.keys(after[0]!).sort()).toEqual(['community_id', 'period', 'user_id']);
  });
});

let anaToken: Token;

describe('anonymous ballot', () => {
  it('happy path: votes stored under the tag, never with a person; "meus votos" by tag', async () => {
    const res = await t.json<{ status: string }>(
      t.vote(fx.communityId, anaToken, { [bia.id]: 'coracao', [caio.id]: 'cobra' }),
    );
    expect(res.status).toBe('inserted');
    const mine = await t.myVotes(fx.communityId, anaToken.voterTag);
    expect(mine.votes).toEqual({ [bia.id]: 'coracao', [caio.id]: 'cobra' });
    const rows = await t.admin<{ voter_tag: string }>('SELECT voter_tag FROM errometro_votes WHERE community_id = $1', [
      fx.communityId,
    ]);
    expect(new Set(rows.map((r) => r.voter_tag))).toEqual(new Set([anaToken.voterTag]));
  });

  it('a second ballot with the same token is "updated" and overwrites, not duplicates', async () => {
    const res = await t.json<{ status: string }>(
      t.vote(fx.communityId, anaToken, { [bia.id]: 'biscoito', [caio.id]: 'cobra' }),
    );
    expect(res.status).toBe('updated');
    expect((await t.myVotes(fx.communityId, anaToken.voterTag)).votes).toEqual({
      [bia.id]: 'biscoito',
      [caio.id]: 'cobra',
    });
  });

  it('deselecting a target (absent from the resubmission) deletes its vote, not the others (R-ANON-06)', async () => {
    await t.json(t.vote(fx.communityId, anaToken, { [bia.id]: 'biscoito' }));
    expect((await t.myVotes(fx.communityId, anaToken.voterTag)).votes).toEqual({ [bia.id]: 'biscoito' });
  });

  it('drops non-targets and unknown emojis without failing the batch; all invalid → 422 (R-ANON-05)', async () => {
    const res = await t.json<{ status: string }>(
      t.vote(fx.communityId, anaToken, {
        [bia.id]: 'biscoito',
        [fx.users.moderador.id]: 'coracao', // approved member, not a voter
        [caio.id]: 'nao-existe',
        'nao-e-uuid': 'coracao',
      }),
    );
    expect(res.status).toBe('updated');
    expect((await t.myVotes(fx.communityId, anaToken.voterTag)).votes).toEqual({ [bia.id]: 'biscoito' });
    const none = await t.json<{ code: string; message: string }>(
      t.vote(fx.communityId, anaToken, { [caio.id]: 'nao-existe' }),
      422,
    );
    expect(none).toEqual({ code: 'NO_VALID_VOTES', message: 'Nenhum voto válido.' });
  });

  it('does NOT delete the vote of a target that only became invalid (still in the map, not deselected)', async () => {
    const voter = await t.newVoter(fx, 'Fábio');
    const tk = await t.getToken(fx, voter);
    await t.json(t.vote(fx.communityId, tk, { [bia.id]: 'coracao', [caio.id]: 'cobra' }));
    await t.json(t.call(fx.users.owner, 'POST', `/participantes/${caio.id}/remover`, fx.communityId));
    await t.json(t.vote(fx.communityId, tk, { [bia.id]: 'planta', [caio.id]: 'cobra' }));
    expect((await t.myVotes(fx.communityId, tk.voterTag)).votes).toEqual({ [bia.id]: 'planta', [caio.id]: 'cobra' });
    await t.makeVoter(fx, caio);
  });

  it('refuses a forged signature, an empty ballot and more than 500 targets', async () => {
    const forged = { ...anaToken, signatureB64: Buffer.alloc(256, 7).toString('base64url') };
    expect(await t.json(t.vote(fx.communityId, forged, { [bia.id]: 'coracao' }), 401)).toEqual({
      code: 'INVALID_TOKEN',
      message: 'Token inválido.',
    });
    expect((await t.vote(fx.communityId, anaToken, {})).status).toBe(400);
    const many = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`t${i}`, 'coracao']));
    expect((await t.vote(fx.communityId, anaToken, many)).status).toBe(400);
  });

  it('refuses a token of one community used in another (keys are per community and round, §4.5)', async () => {
    const other = await h.fixture();
    await t.makeVoter(other, other.users.membro);
    await t.json(t.call(other.users.membro, 'GET', '/chave', other.communityId)); // the other community has a key
    expect((await t.vote(other.communityId, anaToken, { [other.users.membro.id]: 'coracao' })).status).toBe(401);
    // A community where no key was ever created also refuses it.
    const empty = await h.fixture();
    expect((await t.vote(empty.communityId, anaToken, { [bia.id]: 'coracao' })).status).toBe(401);
    // An unknown community is 404, a malformed id too.
    expect((await t.vote('00000000-0000-4000-8000-000000000000', anaToken, { [bia.id]: 'coracao' })).status).toBe(404);
  });

  it('different people get unlinkable tags', async () => {
    const tk = await t.getToken(fx, bia);
    expect(tk.voterTag).not.toBe(anaToken.voterTag);
    await t.json(t.vote(fx.communityId, tk, { [ana.id]: 'mala' }));
    const rows = await tally(fx.communityId);
    expect(rows.find((r) => r.target_id === ana.id)).toMatchObject({ emoji_id: 'mala', n: '1' });
  });
});

describe('anonymity of the anonymous routes', () => {
  it("a session cookie sent along changes nothing: the route doesn't learn who votes", async () => {
    const tk = await t.getToken(fx, caio);
    const res = await t.json<{ status: string }>(
      t.vote(fx.communityId, tk, { [ana.id]: 'coracao' }, { cookie: caio.cookie, authorization: 'Bearer x' }),
    );
    expect(res.status).toBe('inserted');
    // The stored row has the tag only; nothing ties it to Caio.
    const rows = await t.admin<Record<string, unknown>>(
      'SELECT * FROM errometro_votes WHERE community_id = $1 AND voter_tag = $2',
      [fx.communityId, tk.voterTag],
    );
    expect(JSON.stringify(rows)).not.toContain(caio.id);
  });

  it('nothing identifying reaches the logs (person, tag or token)', () => {
    const all = logged.join('\n');
    for (const u of [ana, bia, caio]) expect(all).not.toContain(u.id);
    expect(all).not.toContain(anaToken.voterTag);
    expect(all).not.toContain(anaToken.preparedMsgB64);
  });
});

describe('rounds', () => {
  it('after the round closes, the old token stops verifying and a new one can be issued', async () => {
    const c = await h.fixture();
    const v = await t.newVoter(c, 'Gil');
    await t.makeVoter(c, c.users.membro);
    const old = await t.getToken(c, v);
    await t.json(t.vote(c.communityId, old, { [c.users.membro.id]: 'coracao' }));
    // Changing the cadence closes the current round (Sprint 13 adds the scheduled close).
    const changed = await t.json<{ roundClosedEarly: boolean }>(
      t.call(c.users.owner, 'PUT', '/config/cadencia', c.communityId, {
        config: { frequency: 'custom', releaseHour: 18, releaseWeekdays: [2, 5] },
      }),
    );
    expect(changed.roundClosedEarly).toBe(true);
    const snap = await t.admin<{ period: string; payload: { targets: unknown[] } }>(
      'SELECT period::text, payload FROM errometro_snapshots WHERE community_id = $1',
      [c.communityId],
    );
    expect(snap).toHaveLength(1);
    expect(snap[0]!.period).toBe(old.period);
    expect(snap[0]!.payload.targets).toEqual([
      { targetId: c.users.membro.id, byEmoji: [{ emojiId: 'coracao', count: 1 }], total: 1 },
    ]);

    expect((await t.vote(c.communityId, old, { [c.users.membro.id]: 'cobra' })).status).toBe(401);
    const fresh = await t.getToken(c, v);
    expect(fresh.period).not.toBe(old.period);
    await t.json(t.vote(c.communityId, fresh, { [c.users.membro.id]: 'cobra' }));
    expect((await t.myVotes(c.communityId, fresh.voterTag)).votes).toEqual({ [c.users.membro.id]: 'cobra' });
  });
});
