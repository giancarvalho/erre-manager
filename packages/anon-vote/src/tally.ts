// Portado de queridometro@7c5c5bf:src/domain/voting/aggregate-votes.ts (e os tipos de vote-repository.ts).
// Vote aggregation shared by Errômetro and Eventos.

export type EmojiCount = { emojiId: string; count: number };
export type TargetResult = { targetId: string; byEmoji: EmojiCount[]; total: number };
/** What trophy and ranking calculations read from a round's results. */
export type RoundTargets = { targets: TargetResult[] };

/** targetId -> emojiId -> count */
export type EmojiTally = Map<string, Map<string, number>>;

export function addToTally(tally: EmojiTally, targetId: string, emojiId: string): void {
  let emojiCounts = tally.get(targetId);
  if (!emojiCounts) {
    emojiCounts = new Map();
    tally.set(targetId, emojiCounts);
  }
  emojiCounts.set(emojiId, (emojiCounts.get(emojiId) ?? 0) + 1);
}

export function tallyToTargetResults(tally: EmojiTally): TargetResult[] {
  const targets: TargetResult[] = [];
  for (const [targetId, emojiMap] of tally) {
    const byEmoji: EmojiCount[] = [...emojiMap.entries()].map(([emojiId, count]) => ({ emojiId, count }));
    const total = byEmoji.reduce((s, e) => s + e.count, 0);
    targets.push({ targetId, byEmoji, total });
  }
  targets.sort((a, b) => a.targetId.localeCompare(b.targetId));
  return targets;
}

/** Convenience: tally a list of (target, emoji) votes. */
export function tallyVotes(votes: Iterable<{ targetId: string; emojiId: string }>): TargetResult[] {
  const tally: EmojiTally = new Map();
  for (const v of votes) addToTally(tally, v.targetId, v.emojiId);
  return tallyToTargetResults(tally);
}
