// Portado de queridometro@7c5c5bf:src/domain/events/scale-calculator.ts
import { MIN_COUNT_FOR_TROPHY } from '@erre/emoji';

import type { VotingTypeCalculator } from './calculator';

/** One vote: a target rated on one axis with an intensity 1..that axis' scale_max (validated upstream). */
export type ScaleVote = { targetId: string; emojiId: string; value: number };

export type ScaleEmojiAverage = {
  emojiId: string;
  /**
   * sum/voteCount rounded to 2 decimals, display only. Every leader/tie decision compares sum and voteCount
   * exactly (cross-multiplication), never this value, so two averages that merely display the same can't
   * create or hide a tie.
   */
  average: number;
  voteCount: number;
  sum: number;
};

export type ScaleTargetResult = { targetId: string; byEmoji: ScaleEmojiAverage[] };

export type ScaleTrophyResult = {
  emojiId: string;
  /** The winning (or tied) average, display only; on a ceiling-1 axis, the winning vote count. */
  average: number;
  /** The solo winner, or null on a tie (a tie awards nobody, same as categorical). */
  winnerTargetId: string | null;
  /** Everyone tied for the lead (length >= 2), only when winnerTargetId is null. */
  tiedTargetIds: string[];
};

/**
 * sum/count rounded half up to 2 decimals with exact integer (BigInt) arithmetic. Dividing in floating point
 * first lands on the wrong side of a real .005 boundary (41/40 = 1.025 would give 1.02).
 */
export function averageRoundedTo2Decimals(sum: number, count: number): number {
  const scaledSum = BigInt(sum) * BigInt(100);
  const bigCount = BigInt(count);
  const quotient = scaledSum / bigCount;
  const remainder = scaledSum % bigCount;
  const roundedUp = remainder * BigInt(2) >= bigCount ? quotient + BigInt(1) : quotient;
  return Number(roundedUp) / 100;
}

/** targetId -> emojiId -> running {sum, count}. */
type ScaleSumTally = Map<string, Map<string, { sum: number; count: number }>>;

function addToScaleTally(tally: ScaleSumTally, vote: ScaleVote): void {
  let byEmoji = tally.get(vote.targetId);
  if (!byEmoji) {
    byEmoji = new Map();
    tally.set(vote.targetId, byEmoji);
  }
  const current = byEmoji.get(vote.emojiId) ?? { sum: 0, count: 0 };
  byEmoji.set(vote.emojiId, { sum: current.sum + vote.value, count: current.count + 1 });
}

/**
 * A target's score per axis is the average of its ratings; the trophy goes to the highest average with at
 * least MIN_COUNT_FOR_TROPHY votes (R-EVT-09).
 */
export const scaleCalculator: VotingTypeCalculator<
  ScaleVote,
  ScaleTargetResult,
  ScaleTrophyResult,
  ReadonlyMap<string, number>
> = {
  tally(votes) {
    const tally: ScaleSumTally = new Map();
    for (const vote of votes) addToScaleTally(tally, vote);

    const targets: ScaleTargetResult[] = [];
    for (const [targetId, byEmoji] of tally) {
      const entries: ScaleEmojiAverage[] = [...byEmoji.entries()].map(([emojiId, { sum, count }]) => ({
        emojiId,
        sum,
        voteCount: count,
        average: averageRoundedTo2Decimals(sum, count),
      }));
      targets.push({ targetId, byEmoji: entries });
    }
    targets.sort((a, b) => a.targetId.localeCompare(b.targetId));
    return targets;
  },

  /**
   * With `scaleMaxByEmoji`, an axis whose ceiling is exactly 1 compares raw vote COUNTS: every vote there is
   * 1, so every average is 1.00 and comparing ratios would tie any two qualifying targets.
   */
  computeTrophies(targets, scaleMaxByEmoji) {
    const emojiIds = [...new Set(targets.flatMap((t) => t.byEmoji.map((e) => e.emojiId)))].sort();
    const results: ScaleTrophyResult[] = [];

    for (const emojiId of emojiIds) {
      const isBinaryAxis = scaleMaxByEmoji?.get(emojiId) === 1;
      let leaders: { targetId: string; sum: number; count: number }[] = [];

      for (const target of targets) {
        const entry = target.byEmoji.find((e) => e.emojiId === emojiId);
        // Under the minimum, a target doesn't compete for the trophy at all.
        if (!entry || entry.voteCount < MIN_COUNT_FOR_TROPHY) continue;

        if (leaders.length === 0) {
          leaders = [{ targetId: target.targetId, sum: entry.sum, count: entry.voteCount }];
          continue;
        }
        const top = leaders[0]!;
        // Ceiling 1: raw counts (sum === count there). Otherwise sum/count vs the leaders' ratio, exactly.
        const cmp = isBinaryAxis ? entry.sum - top.sum : entry.sum * top.count - top.sum * entry.voteCount;
        if (cmp > 0) leaders = [{ targetId: target.targetId, sum: entry.sum, count: entry.voteCount }];
        else if (cmp === 0) leaders.push({ targetId: target.targetId, sum: entry.sum, count: entry.voteCount });
      }

      if (leaders.length === 0) continue;

      // Ceiling 1 reports the winning COUNT, not the (always 1.00) average.
      const average = isBinaryAxis ? leaders[0]!.sum : averageRoundedTo2Decimals(leaders[0]!.sum, leaders[0]!.count);
      if (leaders.length === 1) {
        results.push({ emojiId, average, winnerTargetId: leaders[0]!.targetId, tiedTargetIds: [] });
      } else {
        results.push({ emojiId, average, winnerTargetId: null, tiedTargetIds: leaders.map((l) => l.targetId) });
      }
    }

    return results;
  },
};
