// Portado de queridometro@7c5c5bf:src/types/voting-event-snapshot.ts e src/lib/events/close-voting-event.ts
// (computeSnapshotPayload).
import type { TargetResult } from '@erre/anon-vote';
import type { RoundTrophyResult } from '@erre/emoji';

import { categoricalCalculator } from './categorical-calculator';
import { scaleCalculator, type ScaleTargetResult, type ScaleTrophyResult } from './scale-calculator';

export type VotingType = 'categorical' | 'scale';

/** The frozen result of a closed event, shaped by the calculator of its voting type. */
export type EventSnapshotPayload =
  | { votingType: 'categorical'; targets: TargetResult[]; trophies: RoundTrophyResult[] }
  | { votingType: 'scale'; targets: ScaleTargetResult[]; trophies: ScaleTrophyResult[] };

export type StoredEventVote = { targetId: string; emojiId: string; value: number | null };

/**
 * Tallies every vote with the calculator of the event's type. `scaleMaxByEmoji` comes from the event's locked
 * roster (a ceiling-1 axis is decided by counts).
 */
export function computeSnapshotPayload(
  votingType: VotingType,
  votes: readonly StoredEventVote[],
  scaleMaxByEmoji: ReadonlyMap<string, number>,
): EventSnapshotPayload {
  if (votingType === 'scale') {
    // A scale event only stores rows with a value (the ballot check guarantees it); the filter is for the type.
    const scaleVotes = votes.flatMap((v) =>
      v.value === null ? [] : [{ targetId: v.targetId, emojiId: v.emojiId, value: v.value }],
    );
    const targets = scaleCalculator.tally(scaleVotes);
    return { votingType: 'scale', targets, trophies: scaleCalculator.computeTrophies(targets, scaleMaxByEmoji) };
  }
  const targets = categoricalCalculator.tally(votes.map((v) => ({ targetId: v.targetId, emojiId: v.emojiId })));
  return { votingType: 'categorical', targets, trophies: categoricalCalculator.computeTrophies(targets) };
}
