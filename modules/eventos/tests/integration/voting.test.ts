// Ported in behavior from queridometro@7c5c5bf:src/lib/events/anonymous-event-voting.test.ts,
// src/lib/events/voting-event-lifecycle.test.ts, src/app/actions/voting-event-token.test.ts and
// src/app/api/events/[id]/{vote,my-votes}/route.test.ts, against the real API, Postgres and RLS.
import { createModuleHarness, type RoleFixture, type TestUser } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { helpers } from './helpers';

const logged: string[] = [];
const capture = (obj: object, msg: string) => void logged.push(`${msg} ${JSON.stringify(obj)}`);
const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi], log: { info: capture, error: capture } });
const t = helpers(h, inject('db').admin);

let fx: RoleFixture;
let ana: TestUser;
let bia: TestUser;
let caio: TestUser;
let duda: TestUser;

beforeAll(async () => {
  fx = await h.fixture();
  ana = await t.newMember(fx, 'Ana');
  bia = await t.newMember(fx, 'Bia');
  caio = await t.newMember(fx, 'Caio');
  duda = await t.newMember(fx, 'Duda');
});
afterAll(() => h.close());

type Result = {
  result: {
    votingType: string;
    targets: {
      targetId: string;
      total?: number;
      byEmoji: { emojiId: string; average?: number; voteCount?: number }[];
    }[];
    trophies: { emojiId: string; winnerTargetId: string | null; count?: number; average?: number }[];
  };
  people: Record<string, { displayName: string }>;
};

const close = (eventId: string) => t.json(t.call(fx.users.owner, 'POST', `/${eventId}/encerrar`, fx.communityId));

describe('end to end (R-EVT-08, R-EVT-09, R-EVT-10)', () => {
  it('categorical: create, roster, publish, sign up, open, vote, close and read the right trophy', async () => {
    const ev = await t.openEvent(fx, [ana, bia, caio, duda]);
    for (const voter of [ana, bia, caio]) {
      const tk = await t.getToken(fx.communityId, ev.id, voter);
      await t.json(t.vote(fx.communityId, ev.id, tk, [{ targetId: duda.id, emojiId: 'coracao' }]));
    }
    const dudaToken = await t.getToken(fx.communityId, ev.id, duda);
    await t.json(t.vote(fx.communityId, ev.id, dudaToken, [{ targetId: ana.id, emojiId: 'cobra' }]));
    await close(ev.id);

    const res = await t.json<Result>(t.call(fx.users.membro, 'GET', `/${ev.id}/resultados`, fx.communityId));
    expect(res.result.votingType).toBe('categorical');
    expect(res.result.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: duda.id, total: 3 }),
        expect.objectContaining({ targetId: ana.id, total: 1 }),
      ]),
    );
    expect(res.result.trophies).toEqual([{ emojiId: 'coracao', count: 3, winnerTargetId: duda.id, tiedTargetIds: [] }]);
    expect(res.people[duda.id]?.displayName).toBe('Duda');
    const wins = await t.admin(
      'SELECT emoji_id, winner_user_id, voting_type, magnitude FROM eventos_trophy_wins WHERE event_id = $1',
      [ev.id],
    );
    expect(wins).toEqual([
      { emoji_id: 'coracao', winner_user_id: duda.id, voting_type: 'categorical', magnitude: '3.00' },
    ]);
  });

  it('scale: several axes, exact averages, a trophy per axis; a ceiling-1 axis compares counts (3 to 3 is a tie)', async () => {
    const ev = await t.openEvent(fx, [ana, bia, caio, duda], { votingType: 'scale' });
    // coracao (ceiling 10): Duda gets 10, 9, 8 → 9.00; Caio gets 10, 10 (only 2 votes: doesn't compete).
    // cobra (ceiling 1, decided by count): Ana and Bia get 3 votes each → a tie, nobody wins.
    const ballots: [TestUser, { targetId: string; emojiId: string; value: number }[]][] = [
      [
        ana,
        [
          { targetId: duda.id, emojiId: 'coracao', value: 10 },
          { targetId: caio.id, emojiId: 'coracao', value: 10 },
          { targetId: bia.id, emojiId: 'cobra', value: 1 },
        ],
      ],
      [
        bia,
        [
          { targetId: duda.id, emojiId: 'coracao', value: 9 },
          { targetId: caio.id, emojiId: 'coracao', value: 10 },
          { targetId: ana.id, emojiId: 'cobra', value: 1 },
        ],
      ],
      [
        caio,
        [
          { targetId: duda.id, emojiId: 'coracao', value: 8 },
          { targetId: ana.id, emojiId: 'cobra', value: 1 },
          { targetId: bia.id, emojiId: 'cobra', value: 1 },
        ],
      ],
      [
        duda,
        [
          { targetId: ana.id, emojiId: 'cobra', value: 1 },
          { targetId: bia.id, emojiId: 'cobra', value: 1 },
        ],
      ],
    ];
    for (const [voter, rows] of ballots) {
      const tk = await t.getToken(fx.communityId, ev.id, voter);
      await t.json(t.vote(fx.communityId, ev.id, tk, rows));
    }
    await close(ev.id);
    const res = await t.json<Result>(t.call(fx.users.membro, 'GET', `/${ev.id}/resultados`, fx.communityId));
    const duda9 = res.result.targets.find((x) => x.targetId === duda.id)!.byEmoji[0]!;
    expect(duda9).toEqual({ emojiId: 'coracao', sum: 27, voteCount: 3, average: 9 });
    expect(res.result.trophies).toEqual([
      { emojiId: 'cobra', average: 3, winnerTargetId: null, tiedTargetIds: [ana.id, bia.id].sort() },
      { emojiId: 'coracao', average: 9, winnerTargetId: duda.id, tiedTargetIds: [] },
    ]);
    const wins = await t.admin<{ magnitude: string }>('SELECT magnitude FROM eventos_trophy_wins WHERE event_id = $1', [
      ev.id,
    ]);
    expect(wins).toEqual([{ magnitude: '9.00' }]); // the tie writes no row
  });

  it('a closed event no longer takes votes; results before closing are 409', async () => {
    const ev = await t.openEvent(fx, [ana, bia]);
    const tk = await t.getToken(fx.communityId, ev.id, ana);
    await t.json(t.call(fx.users.membro, 'GET', `/${ev.id}/resultados`, fx.communityId), 409);
    await close(ev.id);
    const res = await t.json<{ code: string }>(
      t.vote(fx.communityId, ev.id, tk, [{ targetId: bia.id, emojiId: 'coracao' }]),
      409,
    );
    expect(res.code).toBe('EVENT_NOT_OPEN');
  });
});

describe('participation (R-EVT-07, P-014 B)', () => {
  it('members sign up while the event takes applications or is open; nobody votes before it opens', async () => {
    const ev = await t.draft(fx);
    await t.json(t.call(ana, 'POST', `/${ev.id}/inscricao`, fx.communityId), 404); // a draft doesn't exist for members
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/publicar`, fx.communityId));
    await t.json(t.call(ana, 'POST', `/${ev.id}/inscricao`, fx.communityId));
    await t.json(t.call(ana, 'POST', `/${ev.id}/inscricao`, fx.communityId)); // idempotent
    const key = await t.json<{ code: string }>(t.call(ana, 'GET', `/${ev.id}/chave`, fx.communityId), 409);
    expect(key.code).toBe('EVENT_NOT_OPEN');
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/abrir`, fx.communityId));
    await t.json(t.call(bia, 'POST', `/${ev.id}/inscricao`, fx.communityId)); // still possible once open
    const detail = await t.json<{ participants: { displayName: string }[]; participating: boolean }>(
      t.call(ana, 'GET', `/${ev.id}`, fx.communityId),
    );
    expect(detail.participants.map((p) => p.displayName)).toEqual(['Ana', 'Bia']);
    expect(detail.participating).toBe(true);
    await close(ev.id);
    const late = await t.json<{ code: string }>(t.call(caio, 'POST', `/${ev.id}/inscricao`, fx.communityId), 409);
    expect(late.code).toBe('EVENT_NOT_LIVE');
  });

  it('only approved members: pending and outsiders get 403, and a non-participant gets no token', async () => {
    const ev = await t.openEvent(fx, [ana]);
    await t.json(t.call(fx.users.pending, 'POST', `/${ev.id}/inscricao`, fx.communityId), 403);
    await t.json(t.call(fx.users.outsider, 'POST', `/${ev.id}/inscricao`, fx.communityId), 403);
    await t.json(t.call(bia, 'GET', `/${ev.id}/chave`, fx.communityId), 403);
    await t.json(t.call(bia, 'POST', `/${ev.id}/token`, fx.communityId, { blindedMsgB64: 'AAAA' }), 403);
    await close(ev.id);
  });

  it('a participant who leaves the community stops being a target; closed events keep their participants', async () => {
    const leaver = await t.newMember(fx, 'Eva');
    const ev = await t.openEvent(fx, [ana, leaver]);
    const tk = await t.getToken(fx.communityId, ev.id, ana);
    await t.json(h.req(leaver, 'POST', `/v1/communities/${fx.communityId}/leave`, { community: fx.communityId }));
    const res = await t.json<{ code: string }>(
      t.vote(fx.communityId, ev.id, tk, [{ targetId: leaver.id, emojiId: 'coracao' }]),
      422,
    );
    expect(res.code).toBe('NO_VALID_VOTES');
    const rows = await t.admin('SELECT user_id FROM eventos_participants WHERE event_id = $1', [ev.id]);
    expect(rows).toEqual([{ user_id: ana.id }]);
    await close(ev.id);
  });
});

describe('anonymous ballot (R-ANON-01 to R-ANON-07)', () => {
  it('one token per person and event; a malformed blinded message does not burn it', async () => {
    const ev = await t.openEvent(fx, [ana, bia]);
    expect((await t.call(ana, 'POST', `/${ev.id}/token`, fx.communityId, { blindedMsgB64: 'AAAA' })).status).toBe(400);
    await t.getToken(fx.communityId, ev.id, ana);
    const { startToken } = await import('@erre/anon-vote/client');
    const key = await t.json<{ publicKeyJwk: never }>(t.call(ana, 'GET', `/${ev.id}/chave`, fx.communityId));
    const again = await t.json<{ code: string }>(
      t.call(ana, 'POST', `/${ev.id}/token`, fx.communityId, {
        blindedMsgB64: startToken(key.publicKeyJwk).blindedMsgB64,
      }),
      409,
    );
    expect(again.code).toBe('TOKEN_ALREADY_ISSUED');
    const issuance = await t.admin<Record<string, unknown>>(
      'SELECT * FROM eventos_token_issuances WHERE event_id = $1',
      [ev.id],
    );
    expect(Object.keys(issuance[0]!).sort()).toEqual(['community_id', 'event_id', 'user_id']);
    await close(ev.id);
  });

  it('votes, updates, deselects and reads back by the tag only; no session on the wire is needed', async () => {
    const ev = await t.openEvent(fx, [ana, bia, caio]);
    const tk = await t.getToken(fx.communityId, ev.id, ana);
    const first = await t.json<{ status: string }>(
      t.vote(fx.communityId, ev.id, tk, [
        { targetId: bia.id, emojiId: 'coracao' },
        { targetId: caio.id, emojiId: 'cobra' },
      ]),
    );
    expect(first.status).toBe('inserted');
    const second = await t.json<{ status: string }>(
      t.vote(fx.communityId, ev.id, tk, [{ targetId: bia.id, emojiId: 'cobra' }]),
    );
    expect(second.status).toBe('updated');
    expect((await t.myVotes(fx.communityId, ev.id, tk.voterTag)).votes).toEqual([
      { targetId: bia.id, emojiId: 'cobra', value: null },
    ]);
    expect((await t.myVotes(fx.communityId, ev.id, 'f'.repeat(64))).votes).toEqual([]);
    const stored = await t.admin<Record<string, unknown>>('SELECT * FROM eventos_votes WHERE event_id = $1', [ev.id]);
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toHaveProperty('user_id');
    await close(ev.id);
  });

  it('a session cookie sent with the ballot is stripped and nothing identifying is logged', async () => {
    const ev = await t.openEvent(fx, [ana, bia]);
    const tk = await t.getToken(fx.communityId, ev.id, ana);
    logged.length = 0;
    await t.json(
      t.vote(fx.communityId, ev.id, tk, [{ targetId: bia.id, emojiId: 'coracao' }], {
        cookie: ana.cookie,
        'x-forwarded-for': '203.0.113.7',
      }),
    );
    const text = logged.join('\n');
    expect(text).not.toContain(ana.id);
    expect(text).not.toContain('203.0.113.7');
    await close(ev.id);
  });

  it("a token of one event doesn't vote in another, nor in another community", async () => {
    const first = await t.openEvent(fx, [ana, bia]);
    const tk = await t.getToken(fx.communityId, first.id, ana);
    await close(first.id);
    const second = await t.openEvent(fx, [ana, bia]);
    await t.getToken(fx.communityId, second.id, bia); // second has its own key
    const res = await t.json<{ code: string }>(
      t.vote(fx.communityId, second.id, tk, [{ targetId: bia.id, emojiId: 'coracao' }]),
      401,
    );
    expect(res.code).toBe('INVALID_TOKEN');
    // The same event id under another community's path finds no event (RLS scopes it).
    const other = await h.fixture();
    await t.json(t.vote(other.communityId, second.id, tk, [{ targetId: bia.id, emojiId: 'coracao' }]), 404);
    await close(second.id);
  });

  it('a forged signature or an event with no key is refused', async () => {
    const ev = await t.openEvent(fx, [ana, bia]);
    const fake = { preparedMsgB64: 'AAAA', signatureB64: 'AAAA', voterTag: '' };
    await t.json(t.vote(fx.communityId, ev.id, fake, [{ targetId: bia.id, emojiId: 'coracao' }]), 401);
    const tk = await t.getToken(fx.communityId, ev.id, ana);
    await t.json(
      t.vote(fx.communityId, ev.id, { ...tk, signatureB64: tk.signatureB64.slice(0, -4) + 'AAAA' }, [
        { targetId: bia.id, emojiId: 'coracao' },
      ]),
      401,
    );
    await close(ev.id);
  });

  it('closing waits for a ballot in flight (exclusive event lock)', async () => {
    const ev = await t.openEvent(fx, [ana, bia]);
    const tk = await t.getToken(fx.communityId, ev.id, ana);
    const [voted, closed] = await Promise.all([
      t.vote(fx.communityId, ev.id, tk, [{ targetId: bia.id, emojiId: 'coracao' }]),
      t.call(fx.users.owner, 'POST', `/${ev.id}/encerrar`, fx.communityId),
    ]);
    expect(closed.status).toBe(200);
    const [snapshot] = await t.admin<{ payload: { targets: unknown[] } }>(
      'SELECT payload FROM eventos_snapshots WHERE event_id = $1',
      [ev.id],
    );
    // Either the ballot landed before the tally (and is counted) or after the close (and was refused).
    if (voted.status === 200) expect(snapshot!.payload.targets).toHaveLength(1);
    else expect(voted.status).toBe(409);
  });
});
