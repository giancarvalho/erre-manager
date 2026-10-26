// Portado de queridometro@7c5c5bf:src/domain/events/categorical-calculator.test.ts
import { describe, expect, it } from 'vitest';
import { categoricalCalculator, type CategoricalVote } from '../../domain/categorical-calculator';
import { computeRoundTrophies } from '@erre/emoji';
import { addToTally, tallyToTargetResults, type EmojiTally } from '@erre/anon-vote';

/** Deterministic PRNG (mulberry32) so failures are reproducible without external deps. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRandomVotes(
  rand: () => number,
  targetIds: string[],
  emojiIds: string[],
  count: number,
): CategoricalVote[] {
  const votes: CategoricalVote[] = [];
  for (let i = 0; i < count; i++) {
    votes.push({
      targetId: targetIds[Math.floor(rand() * targetIds.length)]!,
      emojiId: emojiIds[Math.floor(rand() * emojiIds.length)]!,
    });
  }
  return votes;
}

describe('categoricalCalculator.tally', () => {
  it('conta um voto por (target, emoji)', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'bob', emojiId: 'cobra' },
    ];
    const result = categoricalCalculator.tally(votes);
    const alice = result.find((t) => t.targetId === 'alice');
    const bob = result.find((t) => t.targetId === 'bob');
    expect(alice?.byEmoji).toEqual([{ emojiId: 'coracao', count: 2 }]);
    expect(alice?.total).toBe(2);
    expect(bob?.byEmoji).toEqual([{ emojiId: 'cobra', count: 1 }]);
  });

  it('lista vazia produz tally vazio', () => {
    expect(categoricalCalculator.tally([])).toEqual([]);
  });

  it('ordena os targets por id', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'zeca', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
    ];
    const result = categoricalCalculator.tally(votes);
    expect(result.map((t) => t.targetId)).toEqual(['alice', 'zeca']);
  });

  it('um mesmo target pode acumular contagens de vários emojis diferentes', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'cobra' },
      { targetId: 'alice', emojiId: 'cobra' },
    ];
    const result = categoricalCalculator.tally(votes);
    const alice = result.find((t) => t.targetId === 'alice');
    expect(alice?.total).toBe(3);
    expect(alice?.byEmoji).toHaveLength(2);
  });
});

describe('categoricalCalculator.computeTrophies', () => {
  it('dá o troféu pra quem tem a maior contagem daquele emoji (mínimo de 3 votos)', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'bob', emojiId: 'coracao' },
    ];
    const tally = categoricalCalculator.tally(votes);
    const trophies = categoricalCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'coracao', count: 3, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });

  it('abaixo do mínimo de 3 votos não dá troféu', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
    ];
    const tally = categoricalCalculator.tally(votes);
    expect(categoricalCalculator.computeTrophies(tally)).toEqual([]);
  });

  it('empate não dá troféu a ninguém', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'cobra' },
      { targetId: 'alice', emojiId: 'cobra' },
      { targetId: 'alice', emojiId: 'cobra' },
      { targetId: 'bob', emojiId: 'cobra' },
      { targetId: 'bob', emojiId: 'cobra' },
      { targetId: 'bob', emojiId: 'cobra' },
    ];
    const tally = categoricalCalculator.tally(votes);
    const trophies = categoricalCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'cobra', count: 3, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] }]);
  });

  it('sem votos, sem troféus', () => {
    expect(categoricalCalculator.computeTrophies([])).toEqual([]);
  });

  /**
   * A calculadora precisa produzir exatamente o mesmo resultado que
   * computeRoundTrophies produziria recebendo a mesma tally diretamente —
   * ela só adapta o formato de entrada (lista de votos -> EmojiTally), não
   * reimplementa a regra. Guarda contra o adapter silenciosamente divergir
   * da lógica de produção que ele reusa.
   */
  it('paridade: mesmo resultado que chamar computeRoundTrophies direto com a mesma tally', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'bob', emojiId: 'coracao' },
      { targetId: 'bob', emojiId: 'cobra' },
      { targetId: 'bob', emojiId: 'cobra' },
      { targetId: 'bob', emojiId: 'cobra' },
      { targetId: 'bob', emojiId: 'cobra' },
    ];
    const tally = categoricalCalculator.tally(votes);
    const viaCalculator = categoricalCalculator.computeTrophies(tally);
    // Same emojiId order the calculator derives internally (sorted) — the
    // point of this test is proving the adapter doesn't change the RESULT,
    // not re-deriving its own emojiId ordering logic.
    const viaDirect = computeRoundTrophies({ targets: tally }, ['cobra', 'coracao']);
    expect(viaCalculator).toEqual(viaDirect);
  });

  it('no mínimo exato (MIN_COUNT_FOR_TROPHY=3) já garante o troféu através da calculadora, não só direto em computeRoundTrophies', () => {
    const votes: CategoricalVote[] = [
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'coracao' },
    ];
    const tally = categoricalCalculator.tally(votes);
    const trophies = categoricalCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'coracao', count: 3, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });

  /**
   * Fuzz parity: for many random vote lists across several targets/emojis,
   * feeding them through categoricalCalculator (tally -> computeTrophies)
   * must produce exactly the same trophies as building the EmojiTally
   * by hand with the SAME production primitives (addToTally /
   * tallyToTargetResults / computeRoundTrophies) used directly — i.e. the
   * adapter is a pure reshuffle of inputs/outputs around the existing
   * production logic, never a place where behavior can quietly diverge.
   * The emojiId order passed to computeRoundTrophies is reproduced exactly
   * as the adapter derives it (sorted, deduplicated, from the tally) so this
   * compares the full ordered array, not just as sets.
   */
  it('paridade (fuzz): dezenas de listas de votos aleatórias produzem exatamente o mesmo resultado que montar a tally e chamar as funções de produção diretamente', () => {
    const targetIds = ['alice', 'bob', 'carol', 'dave', 'erin'];
    const emojiIds = ['coracao', 'cobra', 'vomito', 'planta', 'bolo', 'asno'];

    for (let seed = 1; seed <= 40; seed++) {
      const rand = mulberry32(seed);
      const voteCount = 1 + Math.floor(rand() * 60);
      const votes = buildRandomVotes(rand, targetIds, emojiIds, voteCount);

      const viaCalculatorTally = categoricalCalculator.tally(votes);
      const viaCalculatorTrophies = categoricalCalculator.computeTrophies(viaCalculatorTally);

      const manualTally: EmojiTally = new Map();
      for (const vote of votes) addToTally(manualTally, vote.targetId, vote.emojiId);
      const manualTargetResults = tallyToTargetResults(manualTally);
      const manualEmojiIds = [...new Set(votes.map((v) => v.emojiId))].sort();
      const manualTrophies = computeRoundTrophies({ targets: manualTargetResults }, manualEmojiIds);

      expect(viaCalculatorTally, `seed ${seed}: tally mismatch`).toEqual(manualTargetResults);
      expect(viaCalculatorTrophies, `seed ${seed}: trophies mismatch`).toEqual(manualTrophies);
    }
  });
});
