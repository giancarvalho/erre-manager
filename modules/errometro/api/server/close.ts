// Freezing a round into a snapshot. Sprint 12 needs it for the forced close of a cadence change; the
// scheduled close, recompute, hide and notifications come in Sprint 13.
// Ported from queridometro@7c5c5bf:src/lib/jobs/close-daily-snapshots.ts (recomputeGroupSnapshot).
import { tallyVotes } from '@erre/anon-vote';
import { and, eq, type Tx } from '@erre/db';

import { snapshots, votes, type SnapshotPayload } from '../../db/schema';

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
 * snapshot's createdAt, the next round's anchor. Idempotent. The caller holds the exclusive round lock.
 */
export async function closeRound(tx: Tx, communityId: string, period: string, releasedAt: Date) {
  const payload = await roundResults(tx, communityId, period);
  await tx
    .insert(snapshots)
    .values({ communityId, period, payload, createdAt: releasedAt })
    .onConflictDoUpdate({ target: [snapshots.communityId, snapshots.period], set: { payload, createdAt: releasedAt } });
  return payload;
}
