// Portado de queridometro@7c5c5bf:src/domain/events/scale-calculator.test.ts
import { describe, expect, it } from 'vitest';
import { scaleCalculator, type ScaleVote } from '../../domain/scale-calculator';

describe('scaleCalculator.tally', () => {
  it('calcula a média de um único emoji pra um target', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      { targetId: 'alice', emojiId: 'limao', value: 3 },
    ];
    const result = scaleCalculator.tally(votes);
    expect(result).toEqual([{ targetId: 'alice', byEmoji: [{ emojiId: 'limao', sum: 4, voteCount: 2, average: 2 }] }]);
  });

  it('arredonda a média pra 2 casas decimais', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      { targetId: 'alice', emojiId: 'limao', value: 2 },
    ];
    const result = scaleCalculator.tally(votes);
    expect(result[0]!.byEmoji[0]!.average).toBeCloseTo(1.33, 5);
    expect(result[0]!.byEmoji[0]!.sum).toBe(4);
    expect(result[0]!.byEmoji[0]!.voteCount).toBe(3);
  });

  it('um target pode ter médias independentes em vários eixos/emojis', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 3 },
      { targetId: 'alice', emojiId: 'estrela', value: 10 },
      { targetId: 'alice', emojiId: 'estrela', value: 8 },
    ];
    const result = scaleCalculator.tally(votes);
    const alice = result.find((t) => t.targetId === 'alice')!;
    expect(alice.byEmoji.find((e) => e.emojiId === 'limao')?.average).toBe(3);
    expect(alice.byEmoji.find((e) => e.emojiId === 'estrela')?.average).toBe(9);
  });

  it('ordena os targets por id', () => {
    const votes: ScaleVote[] = [
      { targetId: 'zeca', emojiId: 'limao', value: 5 },
      { targetId: 'alice', emojiId: 'limao', value: 5 },
    ];
    const result = scaleCalculator.tally(votes);
    expect(result.map((t) => t.targetId)).toEqual(['alice', 'zeca']);
  });

  it('lista vazia produz tally vazio', () => {
    expect(scaleCalculator.tally([])).toEqual([]);
  });
});

describe('scaleCalculator.computeTrophies', () => {
  /**
   * Same floor as the categorical flow's MIN_COUNT_FOR_TROPHY (=3): being
   * the sole (or leading) rating on an axis off a single vote — or even
   * two — reads as arbitrary, not earned. A target under the minimum
   * doesn't compete for that emoji's trophy at all, same as if nobody had
   * rated them yet.
   */
  it('menos de 3 votos não ganha troféu, mesmo sendo o único a receber votos naquele emoji', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 10 },
      { targetId: 'alice', emojiId: 'limao', value: 10 },
    ];
    const tally = scaleCalculator.tally(votes);
    expect(scaleCalculator.computeTrophies(tally)).toEqual([]);
  });

  it('no mínimo exato (3 votos) já garante o troféu', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 7 },
      { targetId: 'alice', emojiId: 'limao', value: 7 },
      { targetId: 'alice', emojiId: 'limao', value: 7 },
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 7, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });

  it('um target abaixo do mínimo não atrapalha outro que bate o mínimo, mesmo com média mais alta — o de baixo simplesmente não compete', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 10 },
      { targetId: 'alice', emojiId: 'limao', value: 10 }, // 2 votos, média 10 — abaixo do mínimo, não compete
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 }, // 3 votos, média 5 — único a bater o mínimo
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 5, winnerTargetId: 'bob', tiedTargetIds: [] }]);
  });

  it('entre dois que batem o mínimo, maior média vence mesmo com menos votos que o outro', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 9 },
      { targetId: 'alice', emojiId: 'limao', value: 9 },
      { targetId: 'alice', emojiId: 'limao', value: 9 }, // 3 votos, média 9
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 }, // 4 votos, média 5
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 9, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });

  it('empate na média não dá troféu a ninguém', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 6 },
      { targetId: 'alice', emojiId: 'limao', value: 6 },
      { targetId: 'alice', emojiId: 'limao', value: 6 },
      { targetId: 'bob', emojiId: 'limao', value: 6 },
      { targetId: 'bob', emojiId: 'limao', value: 6 },
      { targetId: 'bob', emojiId: 'limao', value: 6 },
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 6, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] }]);
  });

  it('empate é detectado pela razão exata (sum/count), não pela média já arredondada — duas contagens diferentes que dão a mesma razão exata empatam de verdade', () => {
    const votes: ScaleVote[] = [
      // alice: 3 votos somando 9 -> 9/3 = 3
      { targetId: 'alice', emojiId: 'limao', value: 3 },
      { targetId: 'alice', emojiId: 'limao', value: 3 },
      { targetId: 'alice', emojiId: 'limao', value: 3 },
      // bob: 6 votos somando 18 -> 18/6 = 3 (mesma razão exata, contagem diferente, ambos >= mínimo)
      { targetId: 'bob', emojiId: 'limao', value: 3 },
      { targetId: 'bob', emojiId: 'limao', value: 3 },
      { targetId: 'bob', emojiId: 'limao', value: 3 },
      { targetId: 'bob', emojiId: 'limao', value: 3 },
      { targetId: 'bob', emojiId: 'limao', value: 3 },
      { targetId: 'bob', emojiId: 'limao', value: 3 },
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 3, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] }]);
  });

  it('cada emoji/eixo tem seu próprio troféu independente', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 9 },
      { targetId: 'alice', emojiId: 'limao', value: 9 },
      { targetId: 'alice', emojiId: 'limao', value: 9 },
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      { targetId: 'alice', emojiId: 'estrela', value: 1 },
      { targetId: 'alice', emojiId: 'estrela', value: 1 },
      { targetId: 'alice', emojiId: 'estrela', value: 1 },
      { targetId: 'bob', emojiId: 'estrela', value: 10 },
      { targetId: 'bob', emojiId: 'estrela', value: 10 },
      { targetId: 'bob', emojiId: 'estrela', value: 10 },
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual(
      expect.arrayContaining([
        { emojiId: 'limao', average: 9, winnerTargetId: 'alice', tiedTargetIds: [] },
        { emojiId: 'estrela', average: 10, winnerTargetId: 'bob', tiedTargetIds: [] },
      ]),
    );
    expect(trophies).toHaveLength(2);
  });

  it('sem votos, sem troféus', () => {
    expect(scaleCalculator.computeTrophies([])).toEqual([]);
  });

  it("um target sem nenhum voto num emoji não concorre àquele troféu (não aparece como 'média 0')", () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 5 },
      { targetId: 'alice', emojiId: 'limao', value: 5 },
      { targetId: 'alice', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'estrela', value: 5 },
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    const limaoTrophy = trophies.find((t) => t.emojiId === 'limao');
    expect(limaoTrophy?.winnerTargetId).toBe('alice');
    expect(limaoTrophy?.tiedTargetIds).toEqual([]);
  });

  /**
   * The whole point of comparing raw (sum, count) via cross-multiplication
   * instead of the rounded `average` is to avoid a FALSE tie (or a missed
   * one) when two different exact ratios happen to round to the same 2
   * decimals. 13/12 = 1.0833... and 14/13 = 1.0769... both round to 1.08,
   * but they are NOT equal — alice's true average is strictly higher, so
   * she must win outright. A naive "compare rounded average" implementation
   * would see 1.08 === 1.08 and wrongly call this a tie.
   */
  it('médias que arredondam pro mesmo valor mas são exatamente diferentes NÃO empatam (13/12 vs 14/13, ambas arredondam pra 1.08)', () => {
    const votes: ScaleVote[] = [
      // alice: 11 votos de 1 + 1 voto de 2 -> soma 13, count 12 -> 1.0833...
      ...Array.from({ length: 11 }, () => ({ targetId: 'alice', emojiId: 'limao', value: 1 })),
      { targetId: 'alice', emojiId: 'limao', value: 2 },
      // bob: 12 votos de 1 + 1 voto de 2 -> soma 14, count 13 -> 1.0769...
      ...Array.from({ length: 12 }, () => ({ targetId: 'bob', emojiId: 'limao', value: 1 })),
      { targetId: 'bob', emojiId: 'limao', value: 2 },
    ] satisfies ScaleVote[];

    const tally = scaleCalculator.tally(votes);
    const alice = tally.find((t) => t.targetId === 'alice')!.byEmoji[0]!;
    const bob = tally.find((t) => t.targetId === 'bob')!.byEmoji[0]!;
    // Both display as 1.08 — this is exactly the ambiguous case.
    expect(alice.average).toBe(1.08);
    expect(bob.average).toBe(1.08);

    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 1.08, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });

  it('mesmo resultado (alice vence) processando os targets na ordem inversa — a decisão de líder não depende de quem é avaliado primeiro', () => {
    const votes: ScaleVote[] = [
      ...Array.from({ length: 12 }, () => ({ targetId: 'bob', emojiId: 'limao', value: 1 })),
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      ...Array.from({ length: 11 }, () => ({ targetId: 'alice', emojiId: 'limao', value: 1 })),
      { targetId: 'alice', emojiId: 'limao', value: 2 },
    ] satisfies ScaleVote[];

    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 1.08, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });

  it('empate verdadeiro entre frações que reduzem pra mesma razão exata com (sum,count) bem diferentes (8/6 vs 12/9, ambas 4/3)', () => {
    const votes: ScaleVote[] = [
      // alice: 8/6
      { targetId: 'alice', emojiId: 'limao', value: 2 },
      { targetId: 'alice', emojiId: 'limao', value: 2 },
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      { targetId: 'alice', emojiId: 'limao', value: 1 },
      // bob: 12/9 (3 votos de 2 + 6 votos de 1 = 6+6=12, count 9)
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      { targetId: 'bob', emojiId: 'limao', value: 2 },
      { targetId: 'bob', emojiId: 'limao', value: 1 },
      { targetId: 'bob', emojiId: 'limao', value: 1 },
      { targetId: 'bob', emojiId: 'limao', value: 1 },
      { targetId: 'bob', emojiId: 'limao', value: 1 },
      { targetId: 'bob', emojiId: 'limao', value: 1 },
      { targetId: 'bob', emojiId: 'limao', value: 1 },
    ];
    const tally = scaleCalculator.tally(votes);
    const trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([
      {
        emojiId: 'limao',
        average: 1.33,
        winnerTargetId: null,
        tiedTargetIds: ['alice', 'bob'],
      },
    ]);
  });

  it('um terceiro target abaixo da liderança não vira empate, e um que supera os dois líderes empatados assume sozinho', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'limao', value: 5 },
      { targetId: 'alice', emojiId: 'limao', value: 5 },
      { targetId: 'alice', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'bob', emojiId: 'limao', value: 5 },
      { targetId: 'carol', emojiId: 'limao', value: 4 },
      { targetId: 'carol', emojiId: 'limao', value: 4 },
      { targetId: 'carol', emojiId: 'limao', value: 4 },
    ];
    const tally = scaleCalculator.tally(votes);
    let trophies = scaleCalculator.computeTrophies(tally);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 5, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] }]);

    const votes2: ScaleVote[] = [
      ...votes,
      { targetId: 'dave', emojiId: 'limao', value: 6 },
      { targetId: 'dave', emojiId: 'limao', value: 6 },
      { targetId: 'dave', emojiId: 'limao', value: 6 },
    ];
    const tally2 = scaleCalculator.tally(votes2);
    trophies = scaleCalculator.computeTrophies(tally2);
    expect(trophies).toEqual([{ emojiId: 'limao', average: 6, winnerTargetId: 'dave', tiedTargetIds: [] }]);
  });
});

describe('computeTrophies com scaleMaxByEmoji — eixo teto=1 vence por CONTAGEM, não por razão', () => {
  /**
   * Com teto=1 todo voto válido vale exatamente 1, então sum === voteCount
   * sempre — a "média" de qualquer alvo com pelo menos um voto é
   * IDENTICAMENTE 1.00, não importa se ele tem 3 votos ou 30. A
   * comparação por razão (sum*count vs sum*count) então SEMPRE dá empate
   * exato entre dois alvos quaisquer que batam o mínimo — mesmo quando um
   * tem visivelmente mais votos que o outro. Sem o scaleMaxByEmoji, é
   * exatamente isso que acontece (ver primeiro teste abaixo); com ele,
   * dave (mais votos) vence sozinho.
   */
  it('sem scaleMaxByEmoji, dois alvos com contagens bem diferentes empatam (a razão sum/count é sempre 1)', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
    ];
    const tally = scaleCalculator.tally(votes);
    expect(scaleCalculator.computeTrophies(tally)).toEqual([
      { emojiId: 'presente', average: 1, winnerTargetId: null, tiedTargetIds: ['alice', 'dave'] },
    ]);
  });

  it('com scaleMaxByEmoji marcando o eixo como teto=1, dave vence sozinho por ter mais votos', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
    ];
    const tally = scaleCalculator.tally(votes);
    const scaleMaxByEmoji = new Map([['presente', 1]]);
    expect(scaleCalculator.computeTrophies(tally, scaleMaxByEmoji)).toEqual([
      // average aqui é a CONTAGEM vencedora (6), não uma média de verdade.
      { emojiId: 'presente', average: 6, winnerTargetId: 'dave', tiedTargetIds: [] },
    ]);
  });

  it('empate real de contagem (mesmo nº de votos) ainda não dá troféu a ninguém', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
    ];
    const tally = scaleCalculator.tally(votes);
    const scaleMaxByEmoji = new Map([['presente', 1]]);
    expect(scaleCalculator.computeTrophies(tally, scaleMaxByEmoji)).toEqual([
      { emojiId: 'presente', average: 3, winnerTargetId: null, tiedTargetIds: ['alice', 'dave'] },
    ]);
  });

  it('abaixo do mínimo de 3 votos continua não competindo, mesmo num eixo teto=1', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
    ];
    const tally = scaleCalculator.tally(votes);
    const scaleMaxByEmoji = new Map([['presente', 1]]);
    expect(scaleCalculator.computeTrophies(tally, scaleMaxByEmoji)).toEqual([]);
  });

  it('scaleMaxByEmoji só afeta o eixo marcado — outro eixo do mesmo evento continua por média', () => {
    const votes: ScaleVote[] = [
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'alice', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      { targetId: 'dave', emojiId: 'presente', value: 1 },
      // eixo comum (teto 10): alice vence por média, mesmo com menos votos.
      { targetId: 'alice', emojiId: 'estrela', value: 9 },
      { targetId: 'alice', emojiId: 'estrela', value: 9 },
      { targetId: 'alice', emojiId: 'estrela', value: 9 },
      { targetId: 'dave', emojiId: 'estrela', value: 2 },
      { targetId: 'dave', emojiId: 'estrela', value: 2 },
      { targetId: 'dave', emojiId: 'estrela', value: 2 },
    ];
    const tally = scaleCalculator.tally(votes);
    const scaleMaxByEmoji = new Map([
      ['presente', 1],
      ['estrela', 10],
    ]);
    const trophies = scaleCalculator.computeTrophies(tally, scaleMaxByEmoji);
    expect(trophies).toEqual(
      expect.arrayContaining([
        { emojiId: 'presente', average: 4, winnerTargetId: 'dave', tiedTargetIds: [] },
        { emojiId: 'estrela', average: 9, winnerTargetId: 'alice', tiedTargetIds: [] },
      ]),
    );
    expect(trophies).toHaveLength(2);
  });
});

describe('averageRoundedTo2Decimals — regression: floating-point rounding at the .005 boundary', () => {
  /**
   * FIXED (found in adversarial review): the original `round2` was
   * `Math.round(n * 100) / 100`, dividing in floating point FIRST. For
   * n = 41/40 = 1.025 exactly, `n * 100` doesn't land on the exact double
   * 102.5 — it lands fractionally below it (102.49999999999999...) because
   * 1.025 itself has no exact binary floating-point representation.
   * Math.round then rounded DOWN to 102, giving 1.02 instead of the
   * mathematically correct round-half-up value 1.03.
   *
   * Reachable with realistic input: 40 raters on one axis for one target,
   * 39 of whom rate it 1 and 1 of whom rates it 2 (sum=41, count=40,
   * average exactly 1.025).
   *
   * This bug never affected who won a trophy: computeTrophies always
   * compared raw (sum, count) via exact cross-multiplication, never the
   * rounded field — only the *displayed* average was ever wrong. Fixed by
   * `averageRoundedTo2Decimals`, which rounds via exact BigInt integer
   * arithmetic instead of dividing in floating point first.
   */
  it('41/40 = 1.025 arredonda pra 1.03 (round-half-up)', () => {
    const votes: ScaleVote[] = [
      ...Array.from({ length: 39 }, () => ({ targetId: 'alice', emojiId: 'limao', value: 1 })),
      { targetId: 'alice', emojiId: 'limao', value: 2 },
    ] satisfies ScaleVote[];

    const tally = scaleCalculator.tally(votes);
    const alice = tally.find((t) => t.targetId === 'alice')!.byEmoji[0]!;
    expect(alice.sum).toBe(41);
    expect(alice.voteCount).toBe(40);
    expect(alice.average).toBe(1.03);
  });
});
