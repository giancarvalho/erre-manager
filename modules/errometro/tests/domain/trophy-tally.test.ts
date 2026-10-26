// Portado de queridometro@7c5c5bf:src/lib/trophies/group-trophy-tally.test.ts
// Os mocks de persistência viraram entrada: computeTrophyTally recebe os snapshots visíveis.
import { describe, expect, it } from 'vitest';

import { computeTrophyTally, tallyForMember } from '../../domain/trophy-tally';

const t = (targetId: string, emojiId: string, count: number) => ({
  targetId,
  byEmoji: [{ emojiId, count }],
  total: count,
});

describe('computeTrophyTally', () => {
  it('retorna [] pra uma comunidade sem nenhum histórico', () => {
    expect(computeTrophyTally([])).toEqual([]);
  });

  it('soma vitórias do mesmo membro em rodadas diferentes', () => {
    const result = computeTrophyTally([
      { targets: [t('alice', 'coracao', 3)] },
      { targets: [t('alice', 'coracao', 3), t('bob', 'cobra', 5)] },
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        { targetId: 'alice', emojiId: 'coracao', winCount: 2 },
        { targetId: 'bob', emojiId: 'cobra', winCount: 1 },
      ]),
    );
  });

  it('empate não soma pra ninguém no acervo histórico', () => {
    expect(computeTrophyTally([{ targets: [t('alice', 'cobra', 3), t('bob', 'cobra', 3)] }])).toEqual([]);
  });

  it('ser o único a receber 1 ou 2 votos de um emoji não soma no acervo — abaixo do mínimo', () => {
    expect(computeTrophyTally([{ targets: [t('alice', 'planta', 1)] }])).toEqual([]);
  });
});

describe('tallyForMember', () => {
  it('filtra só as linhas do alvo e ordena por winCount desc', () => {
    const all = [
      { targetId: 'alice', emojiId: 'coracao', winCount: 1 },
      { targetId: 'alice', emojiId: 'cobra', winCount: 3 },
      { targetId: 'bob', emojiId: 'coracao', winCount: 5 },
    ];
    expect(tallyForMember(all, 'alice')).toEqual([
      { targetId: 'alice', emojiId: 'cobra', winCount: 3 },
      { targetId: 'alice', emojiId: 'coracao', winCount: 1 },
    ]);
  });

  it('retorna [] quando o alvo não tem nenhuma linha', () => {
    expect(tallyForMember([{ targetId: 'bob', emojiId: 'coracao', winCount: 1 }], 'alice')).toEqual([]);
  });
});
