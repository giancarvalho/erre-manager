// Portado de queridometro@7c5c5bf:src/domain/voting/trophies.test.ts
import { describe, expect, it } from 'vitest';
import { computeRoundTrophies, emojiIdsInSnapshot, trophyStatusByTarget, MIN_COUNT_FOR_TROPHY } from '../src/trophies';
import { EMOJI_OPTIONS } from '../src/catalog';
type DailyVotingResults = {
  groupId: string;
  votingDay: string;
  targets: { targetId: string; byEmoji: { emojiId: string; count: number }[]; total: number }[];
};

function daily(targets: DailyVotingResults['targets']): DailyVotingResults {
  return { groupId: 'g1', votingDay: '2026-07-06', targets };
}

const ALL_IDS = EMOJI_OPTIONS.map((o) => o.id);

describe('computeRoundTrophies', () => {
  it('dá o troféu pra quem tem a maior contagem daquele emoji', () => {
    const result = computeRoundTrophies(
      daily([
        { targetId: 'alice', byEmoji: [{ emojiId: 'coracao', count: 3 }], total: 3 },
        { targetId: 'bob', byEmoji: [{ emojiId: 'coracao', count: 1 }], total: 1 },
      ]),
      ALL_IDS,
    );
    const coracao = result.find((r) => r.emojiId === 'coracao');
    expect(coracao).toEqual({
      emojiId: 'coracao',
      count: 3,
      winnerTargetId: 'alice',
      tiedTargetIds: [],
    });
  });

  it('empate: ninguém ganha o troféu — winnerTargetId é null e tiedTargetIds lista todos os líderes', () => {
    const result = computeRoundTrophies(
      daily([
        { targetId: 'alice', byEmoji: [{ emojiId: 'cobra', count: 3 }], total: 3 },
        { targetId: 'bob', byEmoji: [{ emojiId: 'cobra', count: 3 }], total: 3 },
        { targetId: 'carol', byEmoji: [{ emojiId: 'cobra', count: 1 }], total: 1 },
      ]),
      ALL_IDS,
    );
    const cobra = result.find((r) => r.emojiId === 'cobra');
    expect(cobra?.winnerTargetId).toBeNull();
    expect(cobra?.tiedTargetIds.sort()).toEqual(['alice', 'bob']);
    expect(cobra?.count).toBe(3);
  });

  it("omite um emoji que ninguém votou nesta rodada — não existe 'vencedor com 0'", () => {
    const result = computeRoundTrophies(
      daily([{ targetId: 'alice', byEmoji: [{ emojiId: 'coracao', count: 3 }], total: 3 }]),
      ALL_IDS,
    );
    expect(result.find((r) => r.emojiId === 'vomito')).toBeUndefined();
  });

  it('ignora entradas de byEmoji com count 0 (não vira vencedor)', () => {
    const result = computeRoundTrophies(
      daily([{ targetId: 'alice', byEmoji: [{ emojiId: 'mala', count: 0 }], total: 0 }]),
      ALL_IDS,
    );
    expect(result.find((r) => r.emojiId === 'mala')).toBeUndefined();
  });

  it('sem nenhum voto na rodada, não há troféus', () => {
    const result = computeRoundTrophies(daily([]), ALL_IDS);
    expect(result).toEqual([]);
  });

  it(`exige pelo menos ${MIN_COUNT_FOR_TROPHY} votos do emoji — ser o único a receber 1 ou 2 não ganha troféu`, () => {
    const result = computeRoundTrophies(
      daily([
        {
          targetId: 'alice',
          byEmoji: [{ emojiId: 'planta', count: MIN_COUNT_FOR_TROPHY - 1 }],
          total: MIN_COUNT_FOR_TROPHY - 1,
        },
      ]),
      ALL_IDS,
    );
    expect(result.find((r) => r.emojiId === 'planta')).toBeUndefined();
  });

  it(`atinge exatamente ${MIN_COUNT_FOR_TROPHY} votos já garante o troféu`, () => {
    const result = computeRoundTrophies(
      daily([
        {
          targetId: 'alice',
          byEmoji: [{ emojiId: 'planta', count: MIN_COUNT_FOR_TROPHY }],
          total: MIN_COUNT_FOR_TROPHY,
        },
      ]),
      ALL_IDS,
    );
    expect(result.find((r) => r.emojiId === 'planta')?.winnerTargetId).toBe('alice');
  });

  it('empate abaixo do mínimo também não gera near-miss — o emoji é omitido por completo', () => {
    const result = computeRoundTrophies(
      daily([
        { targetId: 'alice', byEmoji: [{ emojiId: 'bolo', count: 1 }], total: 1 },
        { targetId: 'bob', byEmoji: [{ emojiId: 'bolo', count: 1 }], total: 1 },
      ]),
      ALL_IDS,
    );
    expect(result.find((r) => r.emojiId === 'bolo')).toBeUndefined();
  });

  it('a ordem de saída segue a ordem de emojiIds recebida', () => {
    const result = computeRoundTrophies(
      daily([
        {
          targetId: 'alice',
          byEmoji: [
            { emojiId: 'vomito', count: 3 },
            { emojiId: 'asno', count: 3 },
          ],
          total: 6,
        },
      ]),
      ALL_IDS,
    );
    const ids = result.map((r) => r.emojiId);
    const expectedOrder = ALL_IDS.filter((id) => ids.includes(id));
    expect(ids).toEqual(expectedOrder);
  });

  it('funciona com um emoji id customizado, ausente do catálogo global — histórico de um emoji já removido continua computável', () => {
    const result = computeRoundTrophies(
      daily([{ targetId: 'alice', byEmoji: [{ emojiId: 'custom-abc123', count: 4 }], total: 4 }]),
      ['custom-abc123'],
    );
    expect(result).toEqual([{ emojiId: 'custom-abc123', count: 4, winnerTargetId: 'alice', tiedTargetIds: [] }]);
  });
});

describe('emojiIdsInSnapshot', () => {
  it('retorna o conjunto de ids presentes no snapshot, sem duplicatas', () => {
    const ids = emojiIdsInSnapshot(
      daily([
        {
          targetId: 'alice',
          byEmoji: [
            { emojiId: 'coracao', count: 3 },
            { emojiId: 'cobra', count: 1 },
          ],
          total: 4,
        },
        { targetId: 'bob', byEmoji: [{ emojiId: 'coracao', count: 2 }], total: 2 },
      ]),
    );
    expect(new Set(ids)).toEqual(new Set(['coracao', 'cobra']));
  });

  it('retorna vazio pra um snapshot sem votos', () => {
    expect(emojiIdsInSnapshot(daily([]))).toEqual([]);
  });
});

describe('trophyStatusByTarget', () => {
  it('agrupa vitórias por membro', () => {
    const status = trophyStatusByTarget([
      { emojiId: 'coracao', count: 3, winnerTargetId: 'alice', tiedTargetIds: [] },
      { emojiId: 'cobra', count: 2, winnerTargetId: 'bob', tiedTargetIds: [] },
    ]);
    expect(status).toEqual({
      alice: { wins: [{ emojiId: 'coracao' }], nearMisses: [] },
      bob: { wins: [{ emojiId: 'cobra' }], nearMisses: [] },
    });
  });

  it('agrupa empates como near-miss pra todos os empatados, sem winner', () => {
    const status = trophyStatusByTarget([
      { emojiId: 'cobra', count: 2, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] },
    ]);
    expect(status).toEqual({
      alice: { wins: [], nearMisses: [{ emojiId: 'cobra' }] },
      bob: { wins: [], nearMisses: [{ emojiId: 'cobra' }] },
    });
  });

  it('um membro pode ter vitória num emoji e quase-troféu em outro na mesma rodada', () => {
    const status = trophyStatusByTarget([
      { emojiId: 'vomito', count: 5, winnerTargetId: 'dave', tiedTargetIds: [] },
      { emojiId: 'planta', count: 2, winnerTargetId: null, tiedTargetIds: ['dave', 'carol'] },
    ]);
    expect(status.dave).toEqual({
      wins: [{ emojiId: 'vomito' }],
      nearMisses: [{ emojiId: 'planta' }],
    });
    expect(status.carol).toEqual({ wins: [], nearMisses: [{ emojiId: 'planta' }] });
  });

  it('retorna objeto vazio pra lista de resultados vazia', () => {
    expect(trophyStatusByTarget([])).toEqual({});
  });
});
