// Portado de queridometro@7c5c5bf:src/lib/trophies/group-trophy-tally.ts (parte pura: recebe os snapshots).
import { computeRoundTrophies, EMOJI_OPTIONS, emojiIdsInSnapshot, type RoundTargets } from '@erre/emoji';

export type MemberTrophyTally = { targetId: string; emojiId: string; winCount: number };

/**
 * All-time trophy tally from the closed rounds. Each snapshot carries its own emoji ids, so a removed (or
 * deactivated custom) emoji still counts (R-TRO-02). Ties award nothing and don't accumulate (R-TRO-01).
 */
export function computeTrophyTally(rounds: readonly RoundTargets[]): MemberTrophyTally[] {
  const tally = new Map<string, number>();
  for (const round of rounds) {
    for (const result of computeRoundTrophies(round, emojiIdsInSnapshot(round))) {
      if (!result.winnerTargetId) continue;
      const key = `${result.winnerTargetId}::${result.emojiId}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }
  return [...tally.entries()].map(([key, winCount]) => {
    const [targetId, emojiId] = key.split('::') as [string, string];
    return { targetId, emojiId, winCount };
  });
}

/** This member's rows, by winCount desc then emoji order (the community's roster order when given). */
export function tallyForMember(
  all: readonly MemberTrophyTally[],
  targetId: string,
  emojiOrder: readonly string[] = EMOJI_OPTIONS.map((o) => o.id),
): MemberTrophyTally[] {
  const orderIndex = new Map(emojiOrder.map((id, i) => [id, i]));
  return all
    .filter((t) => t.targetId === targetId)
    .sort((a, b) => {
      if (a.winCount !== b.winCount) return b.winCount - a.winCount;
      return (orderIndex.get(a.emojiId) ?? 0) - (orderIndex.get(b.emojiId) ?? 0);
    });
}
