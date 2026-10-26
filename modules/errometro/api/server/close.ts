// Closing rounds into snapshots: scheduled close with catch-up, release now, recompute, hide, annul, and the
// "resultado saiu" notification (once per round). Ported from queridometro@7c5c5bf:
// src/lib/jobs/close-daily-snapshots.ts, src/lib/notifications/notify-result-ready.ts,
// src/lib/persistence/daily-snapshots.ts, src/lib/voting/annul-vote.ts.
import { tallyVotes } from '@erre/anon-vote';
import type { MembersApi, Notify } from '@erre/core/server';
import { and, count, countDistinct, desc, eq, isNull, sql, type Tx } from '@erre/db';
import { fromZonedTime } from 'date-fns-tz';

import { getVotingTimeZone } from '../../domain/calendar';
import { pickRandom, RESULT_READY_BODIES } from '../../domain/notification-copy';
import { participants, snapshots, votes, type SnapshotPayload } from '../../db/schema';
import { voteRepository } from './repositories';
import { lockRound, resolveRound } from './round';

/** What closing needs to tell the members: who they are, how to notify, the community's name. */
export type RoundNotifier = {
  community: { id: string; name: string; createdAt: Date };
  members: MembersApi;
  notify: Notify;
};

/**
 * Most periods one community catches up in one run (R-RES-02): absorbs about two weeks of a daily cadence
 * after the scheduler was down, and keeps a math bug that doesn't advance `to` from looping forever.
 */
export const MAX_CATCHUP_PERIODS = 14;

/** Tally of the votes stored under a round label (R-RES-10). */
export async function roundResults(tx: Tx, communityId: string, period: string): Promise<SnapshotPayload> {
  const rows = await tx
    .select({ targetId: votes.targetId, emojiId: votes.emojiId })
    .from(votes)
    .where(and(eq(votes.communityId, communityId), eq(votes.period, period)));
  return { targets: tallyVotes(rows) };
}

/**
 * Writes (or rewrites) the round's snapshot. The label is always the round's `to` label, never `now`: every
 * vote of the round was stored under it (R-CAL-05, the r-uberlandia incident). `releasedAt` becomes the
 * snapshot's createdAt, the next round's anchor. Idempotent; never touches `hidden` or `notified_at`.
 * The caller holds the exclusive round lock.
 */
export async function closeRound(tx: Tx, communityId: string, period: string, releasedAt: Date) {
  const payload = await roundResults(tx, communityId, period);
  await tx
    .insert(snapshots)
    .values({ communityId, period, payload, createdAt: releasedAt })
    .onConflictDoUpdate({ target: [snapshots.communityId, snapshots.period], set: { payload, createdAt: releasedAt } });
  return payload;
}

/** Whether anyone can vote here at all. A community that never used the Errômetro gets no pushes (D-044). */
export async function hasApprovedParticipants(tx: Tx, communityId: string): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(participants)
    .where(and(eq(participants.communityId, communityId), eq(participants.status, 'approved')));
  return (row?.n ?? 0) > 0;
}

/**
 * "Resultado saiu" to every approved member, at most once per round (R-RES-04): claims `notified_at` first,
 * so a recompute or a second close of the same round never notifies again. Sent after the commit by notify().
 */
export async function notifyResultReady(tx: Tx, n: RoundNotifier, period: string): Promise<boolean> {
  const claimed = await tx
    .update(snapshots)
    .set({ notifiedAt: sql`now()` })
    .where(and(eq(snapshots.communityId, n.community.id), eq(snapshots.period, period), isNull(snapshots.notifiedAt)))
    .returning({ period: snapshots.period });
  if (claimed.length === 0) return false;
  if (!(await hasApprovedParticipants(tx, n.community.id))) return false;
  const members = await n.members.list();
  if (members.length === 0) return false;
  await n.notify({
    userIds: members.map((m) => m.userId),
    type: 'errometro.resultado_pronto',
    title: `Resultado do ${n.community.name} saiu! 📊`,
    body: pickRandom(RESULT_READY_BODIES),
    route: `/errometro/resultados?comunidade=${n.community.id}`,
  });
  return true;
}

/**
 * Scheduled close (R-RES-01): closes every round whose `to` has passed, catching up several if the job was
 * late, each anchored at its own `to` (not `now`, which would leave votes between `to` and the run in no
 * round). Manual cadence never closes here: its `to` is decades away.
 */
export async function closeDueRounds(tx: Tx, n: RoundNotifier, now: Date) {
  await lockRound(tx, n.community.id, 'exclusive');
  const closed: string[] = [];
  while (closed.length < MAX_CATCHUP_PERIODS) {
    const round = await resolveRound(tx, n.community);
    if (now < round.to) break;
    await closeRound(tx, n.community.id, round.label, round.to);
    await notifyResultReady(tx, n, round.label);
    closed.push(round.label);
  }
  return { closed, capped: closed.length === MAX_CATCHUP_PERIODS };
}

/** "Liberar agora": closes the current round now and starts the next one (the only close of a manual cadence). */
export async function releaseNow(tx: Tx, n: RoundNotifier, now: Date) {
  await lockRound(tx, n.community.id, 'exclusive');
  const round = await resolveRound(tx, n.community);
  const payload = await closeRound(tx, n.community.id, round.label, now);
  await notifyResultReady(tx, n, round.label);
  return { period: round.label, targetCount: payload.targets.length };
}

/** `{period}T23:59:59.999` in the voting time zone. */
function endOfPeriodDay(period: string): Date {
  return fromZonedTime(`${period}T23:59:59.999`, getVotingTimeZone());
}

/**
 * Recomputes a round from the votes stored under its label (R-RES-03). The anchor only moves when this is the
 * current round (then it is a close now); a past round keeps its createdAt, and one that never closed gets the
 * end of its own day, which can never steal the current round's anchor. Notifies only if never notified.
 */
export async function recomputeRound(tx: Tx, n: RoundNotifier, period: string, now: Date) {
  await lockRound(tx, n.community.id, 'exclusive');
  const current = await resolveRound(tx, n.community);
  let releasedAt: Date;
  if (period === current.label) releasedAt = now;
  else {
    const [existing] = await tx
      .select({ createdAt: snapshots.createdAt })
      .from(snapshots)
      .where(and(eq(snapshots.communityId, n.community.id), eq(snapshots.period, period)));
    releasedAt = existing?.createdAt ?? endOfPeriodDay(period);
  }
  const payload = await closeRound(tx, n.community.id, period, releasedAt);
  await notifyResultReady(tx, n, period);
  return { period, targetCount: payload.targets.length };
}

/** Unpublish/republish a closed round. The row stays: deleting it would move the anchor (R-RES-07). */
export async function setRoundHidden(tx: Tx, communityId: string, period: string, hidden: boolean) {
  const rows = await tx
    .update(snapshots)
    .set({ hidden })
    .where(and(eq(snapshots.communityId, communityId), eq(snapshots.period, period)))
    .returning({ period: snapshots.period });
  return rows.length > 0;
}

/**
 * Moderator view of the rounds: closed ones (hidden included) and the labels with votes, newest first, with
 * vote and distinct-voter counts (legacy listRoundsWithVotes). Counts only, never tags.
 */
export async function listRoundsForModerators(tx: Tx, communityId: string, limit = 30) {
  const closed = await tx
    .select({
      period: snapshots.period,
      hidden: snapshots.hidden,
      releasedAt: snapshots.createdAt,
      notifiedAt: snapshots.notifiedAt,
    })
    .from(snapshots)
    .where(eq(snapshots.communityId, communityId))
    .orderBy(desc(snapshots.period))
    .limit(limit);
  const withVotes = await tx
    .select({ period: votes.period, voteCount: count(), voterCount: countDistinct(votes.voterTag) })
    .from(votes)
    .where(eq(votes.communityId, communityId))
    .groupBy(votes.period)
    .orderBy(desc(votes.period))
    .limit(limit);
  return {
    closed: closed.map((r) => ({
      period: r.period,
      hidden: r.hidden,
      releasedAt: r.releasedAt.toISOString(),
      notified: r.notifiedAt !== null,
    })),
    withVotes,
  };
}

/**
 * Annuls a ballot by the code (voter tag) its owner chose to share (R-RES-09): deletes every row of the tag.
 * Never followed by a new token: reissuing would let the same person count twice in the round.
 */
export function annulVotes(tx: Tx, communityId: string, voterTag: string) {
  return voteRepository(tx, communityId).deleteVotesForTag(voterTag);
}
