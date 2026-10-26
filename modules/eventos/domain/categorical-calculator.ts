// Portado de queridometro@7c5c5bf:src/domain/events/categorical-calculator.ts
import { addToTally, tallyToTargetResults, type EmojiTally, type TargetResult } from '@erre/anon-vote';
import { computeRoundTrophies, type RoundTrophyResult } from '@erre/emoji';

import type { VotingTypeCalculator } from './calculator';

/** One vote: a target rated with a single emoji, no magnitude. */
export type CategoricalVote = { targetId: string; emojiId: string };

/**
 * The Errômetro rule (most votes for an emoji wins, ties award nobody, at least MIN_COUNT_FOR_TROPHY votes),
 * reused, not reimplemented (R-EVT-08): it calls the same pure functions the recurring flow uses.
 */
export const categoricalCalculator: VotingTypeCalculator<CategoricalVote, TargetResult, RoundTrophyResult> = {
  tally(votes) {
    const tally: EmojiTally = new Map();
    for (const vote of votes) addToTally(tally, vote.targetId, vote.emojiId);
    return tallyToTargetResults(tally);
  },

  computeTrophies(targets) {
    const emojiIds = [...new Set(targets.flatMap((t) => t.byEmoji.map((e) => e.emojiId)))].sort();
    return computeRoundTrophies({ targets: [...targets] }, emojiIds);
  },
};
