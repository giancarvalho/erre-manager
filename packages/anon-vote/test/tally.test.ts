import { describe, expect, it } from 'vitest';

import { tallyVotes } from '../src/tally';

describe('tally', () => {
  it('counts per target and emoji, totals, and sorts targets', () => {
    expect(
      tallyVotes([
        { targetId: 'bob', emojiId: 'cobra' },
        { targetId: 'alice', emojiId: 'coracao' },
        { targetId: 'bob', emojiId: 'cobra' },
        { targetId: 'bob', emojiId: 'planta' },
      ]),
    ).toEqual([
      { targetId: 'alice', byEmoji: [{ emojiId: 'coracao', count: 1 }], total: 1 },
      {
        targetId: 'bob',
        byEmoji: [
          { emojiId: 'cobra', count: 2 },
          { emojiId: 'planta', count: 1 },
        ],
        total: 3,
      },
    ]);
    expect(tallyVotes([])).toEqual([]);
  });
});
