// Portado de queridometro@7c5c5bf:src/domain/events/trophy-winner.ts
import type { EventSnapshotPayload } from './snapshot';

/**
 * One trophy actually awarded, for both voting types: `magnitude` is the winning count (categorical) or the
 * winning average (scale). What eventos_trophy_wins stores.
 */
export type TrophyWinner = { emojiId: string; winnerUserId: string; magnitude: number };

/**
 * Every solo win of a closed event. A tie awards nobody and writes no row (R-EVT-10). An event's targets are
 * members, so `winnerTargetId` is the winner's user id.
 */
export function trophyWinnersFromSnapshot(payload: EventSnapshotPayload): TrophyWinner[] {
  if (payload.votingType === 'scale') {
    return payload.trophies.flatMap((t) =>
      t.winnerTargetId === null ? [] : [{ emojiId: t.emojiId, winnerUserId: t.winnerTargetId, magnitude: t.average }],
    );
  }
  return payload.trophies.flatMap((t) =>
    t.winnerTargetId === null ? [] : [{ emojiId: t.emojiId, winnerUserId: t.winnerTargetId, magnitude: t.count }],
  );
}
