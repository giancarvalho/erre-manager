// Portado de queridometro@7c5c5bf:src/lib/events/anonymous-event-voting.ts (submitAnonymousEventVotes: a
// filtragem da cédula e o diff de exclusão), como função pura.
import type { StoredEventVote, VotingType } from './snapshot';

/** What the client sends per row: target and emoji always; `value` only on a "scale" event. */
export type EventVoteSubmission = { targetId: string; emojiId: string; value?: number | null | undefined };

export type BallotPlan = {
  /** Rows to upsert for this voter tag. Empty means no valid vote. */
  save: StoredEventVote[];
  /** Previously stored (target, emoji) pairs to delete: deselected, or replaced by a later duplicate. */
  remove: { targetId: string; emojiId: string }[];
};

/**
 * Decides what a resubmitted ballot stores (R-EVT-07 targets, R-ANON-05/06):
 * - a target that is not a participant, an emoji off the roster or an out-of-range value is dropped, and its
 *   previous vote is kept (an invalid row never causes a deletion);
 * - categorical: one row per target, the last one sent wins; a scale event has one row per target and axis;
 * - a stored pair the ballot no longer has is deleted, including a categorical pair that was valid but lost
 *   to a later duplicate for the same target.
 */
export function planEventBallot(input: {
  votingType: VotingType;
  participants: ReadonlySet<string>;
  roster: ReadonlyMap<string, { scaleMax: number | null }>;
  submission: readonly EventVoteSubmission[];
  existing: readonly { targetId: string; emojiId: string }[];
}): BallotPlan {
  const isScale = input.votingType === 'scale';
  const filtered = new Map<string, StoredEventVote>();
  const invalidRawPairs = new Set<string>();

  for (const row of input.submission) {
    const pairKey = `${row.targetId}|${row.emojiId}`;
    if (!input.participants.has(row.targetId)) {
      invalidRawPairs.add(pairKey);
      continue;
    }
    const emoji = input.roster.get(row.emojiId);
    if (!emoji) {
      invalidRawPairs.add(pairKey);
      continue;
    }
    if (isScale) {
      const max = emoji.scaleMax;
      const value = row.value;
      if (max == null || value == null || !Number.isInteger(value) || value < 1 || value > max) {
        invalidRawPairs.add(pairKey);
        continue;
      }
      filtered.set(pairKey, { targetId: row.targetId, emojiId: row.emojiId, value });
    } else {
      if (row.value != null) {
        invalidRawPairs.add(pairKey); // a categorical vote carrying a magnitude is malformed
        continue;
      }
      filtered.set(row.targetId, { targetId: row.targetId, emojiId: row.emojiId, value: null });
    }
  }

  const save = [...filtered.values()];
  if (save.length === 0) return { save, remove: [] };
  const kept = new Set([...save.map((f) => `${f.targetId}|${f.emojiId}`), ...invalidRawPairs]);
  const remove = input.existing
    .filter((e) => !kept.has(`${e.targetId}|${e.emojiId}`))
    .map((e) => ({ targetId: e.targetId, emojiId: e.emojiId }));
  return { save, remove };
}
