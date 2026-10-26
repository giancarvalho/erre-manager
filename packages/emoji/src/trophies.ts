// Portado de queridometro@7c5c5bf:src/domain/voting/trophies.ts
/** Round results as read by the trophy calculation (same shape as @erre/anon-vote's RoundTargets). */
export type RoundTargets = { targets: { targetId: string; byEmoji: { emojiId: string; count: number }[] }[] };

/** Every emoji id that appears anywhere in this snapshot — whatever the group's roster actually was that round, independent of its current config. */
export function emojiIdsInSnapshot(daily: RoundTargets): string[] {
  const ids = new Set<string>();
  for (const target of daily.targets) {
    for (const e of target.byEmoji) ids.add(e.emojiId);
  }
  return [...ids];
}

export type RoundTrophyResult = {
  emojiId: string;
  /** The leading count for this emoji this round; always >= MIN_COUNT_FOR_TROPHY. */
  count: number;
  /** The solo winner, or null when the top count is tied between 2+ targets — a tie awards no trophy. */
  winnerTargetId: string | null;
  /** Populated (length >= 2) only when winnerTargetId is null — everyone tied for the lead. */
  tiedTargetIds: string[];
};

/**
 * A trophy requires at least this many votes for the emoji — otherwise being
 * the sole (or tied) recipient of a rarely-used emoji would "win" a trophy
 * off a single vote, which reads as arbitrary rather than earned.
 */
export const MIN_COUNT_FOR_TROPHY = 3;

/**
 * One entry per emoji id (in the given `emojiIds` order) that had at least
 * MIN_COUNT_FOR_TROPHY votes for its leading target this round. An emoji
 * with no votes, or whose leading count falls short of the minimum, is
 * omitted entirely. A tie for the lead awards no trophy (winnerTargetId:
 * null) — see trophyStatusByTarget for how ties surface as a "near miss"
 * instead.
 *
 * `emojiIds` is passed in (not read from the global EMOJI_OPTIONS catalog)
 * because a group's active roster is configurable — the caller resolves it
 * (see lib/emojis/group-emoji-config.ts). Keeps this function pure and
 * usable against a closed snapshot's own historical id set, so removing an
 * emoji from a group's current config never corrupts past rounds' trophies.
 */
export function computeRoundTrophies(daily: RoundTargets, emojiIds: readonly string[]): RoundTrophyResult[] {
  const results: RoundTrophyResult[] = [];

  for (const emojiId of emojiIds) {
    let max = 0;
    let leaders: string[] = [];

    for (const target of daily.targets) {
      const count = target.byEmoji.find((e) => e.emojiId === emojiId)?.count ?? 0;
      if (count <= 0) continue;
      if (count > max) {
        max = count;
        leaders = [target.targetId];
      } else if (count === max) {
        leaders.push(target.targetId);
      }
    }

    if (max < MIN_COUNT_FOR_TROPHY) continue;

    if (leaders.length === 1) {
      results.push({ emojiId, count: max, winnerTargetId: leaders[0]!, tiedTargetIds: [] });
    } else if (leaders.length > 1) {
      results.push({ emojiId, count: max, winnerTargetId: null, tiedTargetIds: leaders });
    }
  }

  return results;
}

export type MemberRoundTrophyStatus = {
  wins: { emojiId: string }[];
  nearMisses: { emojiId: string }[];
};

/**
 * Groups a round's trophy results by member — what ResultRankingList looks
 * up per row. Plain object (not Map): this crosses the Server→Client
 * Component boundary (results/page.tsx → RankingSection → ResultRankingList).
 */
export function trophyStatusByTarget(results: RoundTrophyResult[]): Record<string, MemberRoundTrophyStatus> {
  const byTarget: Record<string, MemberRoundTrophyStatus> = {};

  const ensure = (targetId: string): MemberRoundTrophyStatus => {
    return (byTarget[targetId] ??= { wins: [], nearMisses: [] });
  };

  for (const result of results) {
    if (result.winnerTargetId) {
      ensure(result.winnerTargetId).wins.push({ emojiId: result.emojiId });
    } else {
      for (const targetId of result.tiedTargetIds) {
        ensure(targetId).nearMisses.push({ emojiId: result.emojiId });
      }
    }
  }

  return byTarget;
}
