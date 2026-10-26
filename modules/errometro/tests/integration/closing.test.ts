// Ported in behavior from queridometro@7c5c5bf: src/lib/jobs/close-daily-snapshots.test.ts,
// src/lib/jobs/send-closing-reminders.test.ts, src/lib/notifications/notify-{result-ready,closing-reminder}.test.ts,
// src/app/actions/{release-now,annul-vote}.test.ts and the hide/recompute routes — against Postgres and the
// real job runner instead of mocks.
import { createModuleHarness, type RoleFixture, type TestUser } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { MAX_CATCHUP_PERIODS } from '../../api/server/close';
import { helpers } from './helpers';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi], recordPush: true });
const t = helpers(h, inject('db').admin);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Round = { period: { label: string; from: string; to: string } };
type Snapshot = { period: string; created_at: Date; hidden: boolean; notified_at: Date | null; payload: unknown };

const close = (now: Date) => h.runtime.runJob('errometro.fechar_rodadas', now);
const remind = (now: Date) => h.runtime.runJob('errometro.lembrete_fechamento', now);
const round = (c: RoleFixture) => t.json<Round>(t.call(c.users.owner, 'GET', '/rodada', c.communityId));
const snapshotsOf = (c: RoleFixture) =>
  t.admin<Snapshot>(
    'SELECT period::text, created_at, hidden, notified_at, payload FROM errometro_snapshots WHERE community_id = $1 ORDER BY period',
    [c.communityId],
  );
const setConfig = (c: RoleFixture, frequency: string, hour: number) =>
  t.admin('INSERT INTO errometro_release_config (community_id, frequency, release_hour) VALUES ($1, $2, $3)', [
    c.communityId,
    frequency,
    hour,
  ]);

async function pushesAfter<T>(action: () => Promise<T>) {
  await h.runtime.notifier.idle();
  const before = h.pushes.length;
  await action();
  await h.runtime.notifier.idle();
  return h.pushes.slice(before);
}

let fx: RoleFixture;
let ana: TestUser;
let bia: TestUser;

beforeAll(async () => {
  fx = await h.fixture('fechamento');
  ana = await t.newVoter(fx, 'Ana');
  bia = await t.newVoter(fx, 'Bia');
  for (const u of [fx.users.owner, fx.users.membro, ana, bia]) await h.subscribe(u);
});
afterAll(() => h.close());

describe('scheduled close (errometro.fechar_rodadas)', () => {
  it('closes only once the release time has come, anchored at `to`, and notifies every member once', async () => {
    const tk = await t.getToken(fx, ana);
    await t.json(t.vote(fx.communityId, tk, { [bia.id]: 'coracao' }));
    const { period } = await round(fx);
    const to = new Date(period.to);

    expect(await pushesAfter(() => close(new Date(to.getTime() - 60_000)))).toEqual([]);
    expect(await snapshotsOf(fx)).toEqual([]);

    const sent = await pushesAfter(() => close(new Date(to.getTime() + 60_000)));
    const [snap] = await snapshotsOf(fx);
    expect(snap).toMatchObject({ period: period.label, hidden: false });
    expect(snap!.created_at).toEqual(to); // `to`, not the run time: no gap between rounds (R-RES-01)
    expect(snap!.notified_at).not.toBeNull();
    expect(snap!.payload).toEqual({
      targets: [{ targetId: bia.id, byEmoji: [{ emojiId: 'coracao', count: 1 }], total: 1 }],
    });
    // Every approved member who has a device, voter or not (legacy notifyResultReady).
    expect(new Set(sent.map((p) => p.userId))).toEqual(
      new Set([fx.users.owner.id, fx.users.membro.id, ana.id, bia.id]),
    );
    expect(sent[0]!.title).toBe('Resultado do fechamento saiu! 📊');
    expect(sent[0]!.url).toBe(`/errometro/resultados?comunidade=${fx.communityId}`);

    // Running again changes nothing and sends nothing (idempotent).
    expect(await pushesAfter(() => close(new Date(to.getTime() + 2 * 60_000)))).toEqual([]);
    expect(await snapshotsOf(fx)).toHaveLength(1);
    // The next round starts at the previous `to`.
    expect((await round(fx)).period.from).toBe(to.toISOString());
  });

  it('catches up several late rounds in one run, up to the safety cap (R-RES-02)', async () => {
    const c = await h.fixture();
    await setConfig(c, 'daily', 9);
    const start = new Date((await round(c)).period.to);
    await close(new Date(start.getTime() + 2.5 * DAY));
    expect(await snapshotsOf(c)).toHaveLength(3);

    await close(new Date(start.getTime() + 30 * DAY));
    expect(await snapshotsOf(c)).toHaveLength(3 + MAX_CATCHUP_PERIODS);
    const labels = (await snapshotsOf(c)).map((s) => s.period);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('never closes a manual cadence on its own; a community without voters gets no push (D-044)', async () => {
    const manual = await h.fixture();
    await setConfig(manual, 'manual', 12);
    const quiet = await h.fixture();
    await h.subscribe(quiet.users.owner);
    const to = new Date((await round(quiet)).period.to);
    const sent = await pushesAfter(() => close(new Date(to.getTime() + 400 * DAY)));
    expect(await snapshotsOf(manual)).toEqual([]);
    expect((await snapshotsOf(quiet)).length).toBeGreaterThan(0);
    expect(sent.filter((p) => p.userId === quiet.users.owner.id)).toEqual([]);
  });
});

describe('closing reminder (errometro.lembrete_fechamento)', () => {
  it('goes out once, within 3h of the close, to every member', async () => {
    const { period } = await round(fx);
    const to = new Date(period.to);
    expect(await pushesAfter(() => remind(new Date(to.getTime() - 4 * HOUR)))).toEqual([]);
    const sent = await pushesAfter(() => remind(new Date(to.getTime() - 2 * HOUR)));
    expect(sent.map((p) => p.userId).sort()).toEqual([fx.users.owner.id, fx.users.membro.id, ana.id, bia.id].sort());
    expect(sent[0]!.title).toBe('Faltam 3h pra fechar a rodada do fechamento ⏰');
    expect(await pushesAfter(() => remind(new Date(to.getTime() - HOUR)))).toEqual([]);
    expect(await pushesAfter(() => remind(new Date(to.getTime() + HOUR)))).toEqual([]);
  });

  it('skips a manual cadence', async () => {
    const c = await h.fixture();
    await t.makeVoter(c, c.users.membro);
    await setConfig(c, 'manual', 12);
    await h.subscribe(c.users.membro);
    const to = new Date((await round(c)).period.to);
    const sent = await pushesAfter(() => remind(new Date(to.getTime() - HOUR)));
    expect(sent.filter((p) => p.userId === c.users.membro.id)).toEqual([]);
  });
});

describe('moderation of rounds', () => {
  it('"liberar agora" closes the current round now, notifies, and starts a new round; moderators only', async () => {
    const c = await h.fixture();
    const v = await t.newVoter(c, 'Caio');
    await t.makeVoter(c, c.users.membro);
    await h.subscribe(c.users.membro);
    // Manual cadence: the only way its round closes. The round label is a day, so the community must not have
    // been anchored today: two releases on the same day share a label, as in the legacy (P-017).
    await setConfig(c, 'manual', 12);
    await t.admin("UPDATE communities SET created_at = now() - interval '3 days' WHERE id = $1", [c.communityId]);
    const before = await round(c);
    const tk = await t.getToken(c, v);
    await t.json(t.vote(c.communityId, tk, { [c.users.membro.id]: 'cobra' }));

    expect((await t.call(c.users.membro, 'POST', '/rodada/liberar', c.communityId)).status).toBe(403);
    const sent = await pushesAfter(async () =>
      expect(await t.json(t.call(c.users.admin, 'POST', '/rodada/liberar', c.communityId))).toEqual({
        period: before.period.label,
        targetCount: 1,
      }),
    );
    expect(sent.map((p) => p.userId)).toEqual([c.users.membro.id]);
    const [snap] = await snapshotsOf(c);
    expect(Date.now() - snap!.created_at.getTime()).toBeLessThan(60_000);
    expect((await round(c)).period.from).toBe(snap!.created_at.toISOString());
    expect((await t.vote(c.communityId, tk, { [c.users.membro.id]: 'coracao' })).status).toBe(401);
  });

  it('P-017 (legacy parity): two manual releases on the same day share the round label', async () => {
    const c = await h.fixture();
    await setConfig(c, 'manual', 12);
    const first = await t.json<{ period: string }>(t.call(c.users.owner, 'POST', '/rodada/liberar', c.communityId));
    expect((await round(c)).period.label).toBe(first.period);
  });

  it('recompute: a past round keeps its anchor and is not notified again; the current round closes now', async () => {
    const c = await h.fixture();
    const v = await t.newVoter(c, 'Duda');
    await t.makeVoter(c, c.users.membro);
    await h.subscribe(c.users.membro);
    const first = (await round(c)).period;
    await close(new Date(new Date(first.to).getTime() + 60_000));
    const [closed] = await snapshotsOf(c);

    // A vote that only reached the database under the old label (e.g. from the migration) gets counted.
    await t.admin(
      "INSERT INTO errometro_votes (community_id, period, voter_tag, target_id, emoji_id) VALUES ($1, $2, 'tag-antigo', $3, 'mala')",
      [c.communityId, first.label, c.users.membro.id],
    );
    const sent = await pushesAfter(async () =>
      expect(await t.json(t.call(c.users.owner, 'POST', `/rodadas/${first.label}/recalcular`, c.communityId))).toEqual({
        period: first.label,
        targetCount: 1,
      }),
    );
    expect(sent).toEqual([]);
    const [again] = await snapshotsOf(c);
    expect(again!.created_at).toEqual(closed!.created_at);
    expect(again!.payload).toEqual({
      targets: [{ targetId: c.users.membro.id, byEmoji: [{ emojiId: 'mala', count: 1 }], total: 1 }],
    });

    // A round that never closed (not the current one) gets the end of its own day as release time.
    await t.json(t.call(c.users.owner, 'POST', '/rodadas/2026-01-05/recalcular', c.communityId));
    const never = (await snapshotsOf(c)).find((s) => s.period === '2026-01-05')!;
    expect(never.created_at.toISOString()).toBe('2026-01-06T02:59:59.999Z');
    expect((await round(c)).period.from).toBe(closed!.created_at.toISOString()); // anchor untouched

    // Recomputing the current round is closing it now.
    const current = (await round(c)).period.label;
    await t.json(t.call(c.users.owner, 'POST', `/rodadas/${current}/recalcular`, c.communityId));
    const now = (await snapshotsOf(c)).find((s) => s.period === current)!;
    expect(Date.now() - now.created_at.getTime()).toBeLessThan(60_000);
    void v;
  });

  it('hide/unhide keeps the row and the anchor; unknown round is 404', async () => {
    const c = await h.fixture();
    await t.json(t.call(c.users.owner, 'POST', '/rodada/liberar', c.communityId));
    const [snap] = await snapshotsOf(c);
    const anchor = (await round(c)).period;
    expect(
      await t.json(t.call(c.users.owner, 'POST', `/rodadas/${snap!.period}/ocultar`, c.communityId, { hidden: true })),
    ).toEqual({ period: snap!.period, hidden: true });
    expect((await snapshotsOf(c))[0]!.hidden).toBe(true);
    expect((await round(c)).period).toEqual(anchor);
    const list = await t.json<{ closed: { period: string; hidden: boolean }[] }>(
      t.call(c.users.owner, 'GET', '/rodadas', c.communityId),
    );
    expect(list.closed).toEqual([expect.objectContaining({ period: snap!.period, hidden: true })]);
    await t.json(t.call(c.users.owner, 'POST', `/rodadas/${snap!.period}/ocultar`, c.communityId, { hidden: false }));
    expect(
      (await t.call(c.users.owner, 'POST', '/rodadas/2020-01-01/ocultar', c.communityId, { hidden: true })).status,
    ).toBe(404);
    expect(
      (await t.call(c.users.membro, 'POST', `/rodadas/${snap!.period}/ocultar`, c.communityId, { hidden: true }))
        .status,
    ).toBe(403);
  });

  it('annul by code deletes every row of the tag and never reissues the token (R-RES-09)', async () => {
    const c = await h.fixture();
    const v = await t.newVoter(c, 'Eva');
    await t.makeVoter(c, c.users.membro);
    await t.makeVoter(c, c.users.admin);
    const tk = await t.getToken(c, v);
    await t.json(t.vote(c.communityId, tk, { [c.users.membro.id]: 'cobra', [c.users.admin.id]: 'coracao' }));

    const code = `  ${tk.voterTag.toUpperCase()} `;
    expect(await t.json(t.call(c.users.owner, 'POST', '/votos/anular', c.communityId, { voterTag: code }))).toEqual({
      deletedCount: 2,
    });
    expect((await t.myVotes(c.communityId, tk.voterTag)).votes).toEqual({});
    expect((await t.call(c.users.owner, 'POST', '/votos/anular', c.communityId, { voterTag: 'xyz' })).status).toBe(400);
    expect(
      (await t.call(c.users.membro, 'POST', '/votos/anular', c.communityId, { voterTag: tk.voterTag })).status,
    ).toBe(403);
    // Still one token per round: the person can't get another one.
    expect((await t.call(v, 'POST', '/token', c.communityId, { blindedMsgB64: 'A'.repeat(342) })).status).toBe(409);
  });

  it('a cadence change closes the round early without a push (R-RES-05)', async () => {
    const c = await h.fixture();
    await t.makeVoter(c, c.users.membro);
    await h.subscribe(c.users.membro);
    const sent = await pushesAfter(() =>
      t.json(
        t.call(c.users.owner, 'PUT', '/config/cadencia', c.communityId, {
          config: { frequency: 'daily', releaseHour: 20 },
        }),
      ),
    );
    expect(await snapshotsOf(c)).toHaveLength(1);
    expect(sent).toEqual([]);
  });
});
