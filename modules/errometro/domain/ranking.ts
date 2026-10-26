// Portado de queridometro@7c5c5bf:src/lib/daily-results-to-ranking.ts e src/lib/ranking.ts (sortRankingEntries).
import type { RoundTargets } from '@erre/anon-vote';

export type RankingMember = { userId: string; displayName: string; avatarVariant: string };
export type EmojiReactionCount = { emojiId: string; char: string; count: number };
export type RankingEntry = { member: RankingMember; byEmoji: EmojiReactionCount[]; total: number };

/** Totals descending, zero totals last, ties by name (pt-BR). Doesn't mutate the input. */
export function sortRankingEntries(entries: readonly RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => {
    const aZero = a.total === 0;
    const bZero = b.total === 0;
    if (aZero !== bZero) return aZero ? 1 : -1;
    if (a.total !== b.total) return b.total - a.total;
    return a.member.displayName.localeCompare(b.member.displayName, 'pt-BR');
  });
}

/**
 * One entry per current member (with or without votes); targets who are no longer members are left out.
 * `emojiCatalog` resolves chars of past emojis too (custom ones never get deleted, R-EMO-04).
 */
export function roundToRankingEntries(
  round: RoundTargets,
  members: readonly RankingMember[],
  emojiCatalog: ReadonlyMap<string, { char: string }>,
): RankingEntry[] {
  const byTarget = new Map(round.targets.map((t) => [t.targetId, t]));
  return sortRankingEntries(
    members.map((member) => {
      const t = byTarget.get(member.userId);
      return {
        member,
        byEmoji: (t?.byEmoji ?? []).map((e) => ({
          emojiId: e.emojiId,
          char: emojiCatalog.get(e.emojiId)?.char ?? '❓',
          count: e.count,
        })),
        total: t?.total ?? 0,
      };
    }),
  );
}
