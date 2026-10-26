// Portado de queridometro@7c5c5bf:src/lib/events/anonymous-event-voting.test.ts (regras da cédula: filtragem,
// "último vence" no categórico, eixos na escala e o diff de exclusão), contra a função pura planEventBallot.
// O fluxo com token e banco está em tests/integration/voting.test.ts.
import { describe, expect, it } from 'vitest';

import { planEventBallot, type EventVoteSubmission } from '../../domain/ballot';

const people = new Set(['alice', 'bob', 'carol']);
const categoricalRoster = new Map([
  ['coracao', { scaleMax: null }],
  ['bolo', { scaleMax: null }],
]);
const scaleRoster = new Map([
  ['limao', { scaleMax: 3 }],
  ['estrela', { scaleMax: 10 }],
]);

const categorical = (submission: EventVoteSubmission[], existing: { targetId: string; emojiId: string }[] = []) =>
  planEventBallot({ votingType: 'categorical', participants: people, roster: categoricalRoster, submission, existing });
const scale = (submission: EventVoteSubmission[], existing: { targetId: string; emojiId: string }[] = []) =>
  planEventBallot({ votingType: 'scale', participants: people, roster: scaleRoster, submission, existing });

describe('cédula categórica', () => {
  it('guarda um voto por alvo, sem valor', () => {
    expect(categorical([{ targetId: 'alice', emojiId: 'coracao' }])).toEqual({
      save: [{ targetId: 'alice', emojiId: 'coracao', value: null }],
      remove: [],
    });
  });

  it('deselecionar um alvo apaga o voto salvo dele, sem afetar os demais', () => {
    const plan = categorical(
      [{ targetId: 'alice', emojiId: 'coracao' }],
      [
        { targetId: 'alice', emojiId: 'coracao' },
        { targetId: 'bob', emojiId: 'bolo' },
      ],
    );
    expect(plan.remove).toEqual([{ targetId: 'bob', emojiId: 'bolo' }]);
  });

  it('NÃO apaga o voto de um alvo que só ficou inválido (deixou de participar): ele ainda veio no reenvio', () => {
    const plan = categorical(
      [
        { targetId: 'alice', emojiId: 'coracao' },
        { targetId: 'dave', emojiId: 'bolo' },
      ],
      [{ targetId: 'dave', emojiId: 'bolo' }],
    );
    expect(plan.save).toEqual([{ targetId: 'alice', emojiId: 'coracao', value: null }]);
    expect(plan.remove).toEqual([]);
  });

  it('duas linhas para o mesmo alvo: a última vence e não coexistem', () => {
    const plan = categorical(
      [
        { targetId: 'bob', emojiId: 'coracao' },
        { targetId: 'bob', emojiId: 'bolo' },
      ],
      [{ targetId: 'bob', emojiId: 'coracao' }],
    );
    expect(plan.save).toEqual([{ targetId: 'bob', emojiId: 'bolo', value: null }]);
    // The superseded (valid) row is not protected: the stored bob:coracao goes away.
    expect(plan.remove).toEqual([{ targetId: 'bob', emojiId: 'coracao' }]);
  });

  it('linha com value é malformada e é descartada; as outras valem', () => {
    const plan = categorical([
      { targetId: 'alice', emojiId: 'coracao', value: 3 },
      { targetId: 'bob', emojiId: 'bolo' },
    ]);
    expect(plan.save).toEqual([{ targetId: 'bob', emojiId: 'bolo', value: null }]);
  });

  it('descarta quem não participa e emoji fora do roster sem derrubar o lote', () => {
    const plan = categorical([
      { targetId: 'zeca', emojiId: 'coracao' },
      { targetId: 'alice', emojiId: 'cobra' },
      { targetId: 'carol', emojiId: 'bolo' },
    ]);
    expect(plan.save).toEqual([{ targetId: 'carol', emojiId: 'bolo', value: null }]);
  });

  it('tudo inválido: nada a guardar e nada a apagar', () => {
    expect(
      categorical([{ targetId: 'zeca', emojiId: 'coracao' }], [{ targetId: 'alice', emojiId: 'coracao' }]),
    ).toEqual({
      save: [],
      remove: [],
    });
  });
});

describe('cédula de escala', () => {
  it('aceita vários eixos para o mesmo alvo, cada um com seu valor', () => {
    expect(
      scale([
        { targetId: 'alice', emojiId: 'limao', value: 2 },
        { targetId: 'alice', emojiId: 'estrela', value: 9 },
      ]).save,
    ).toEqual([
      { targetId: 'alice', emojiId: 'limao', value: 2 },
      { targetId: 'alice', emojiId: 'estrela', value: 9 },
    ]);
  });

  it('usa o teto do eixo certo: limão vai até 3, estrela até 10', () => {
    expect(scale([{ targetId: 'alice', emojiId: 'limao', value: 3 }]).save).toHaveLength(1);
    expect(scale([{ targetId: 'alice', emojiId: 'limao', value: 4 }]).save).toHaveLength(0);
    expect(scale([{ targetId: 'alice', emojiId: 'estrela', value: 7 }]).save).toHaveLength(1);
    expect(scale([{ targetId: 'alice', emojiId: 'estrela', value: 10 }]).save).toHaveLength(1);
  });

  it('recusa valor 0, negativo, não inteiro ou ausente', () => {
    for (const value of [0, -1, 1.5, null, undefined])
      expect(scale([{ targetId: 'alice', emojiId: 'estrela', value }]).save, String(value)).toHaveLength(0);
  });

  it('deselecionar um eixo mantém o outro eixo do mesmo alvo', () => {
    const plan = scale(
      [{ targetId: 'alice', emojiId: 'estrela', value: 5 }],
      [
        { targetId: 'alice', emojiId: 'limao' },
        { targetId: 'alice', emojiId: 'estrela' },
      ],
    );
    expect(plan.remove).toEqual([{ targetId: 'alice', emojiId: 'limao' }]);
  });

  it('eixo OMITIDO é apagado; eixo presente mas fora do intervalo é preservado', () => {
    const plan = scale(
      [
        { targetId: 'alice', emojiId: 'limao', value: 99 },
        { targetId: 'bob', emojiId: 'estrela', value: 4 },
      ],
      [
        { targetId: 'alice', emojiId: 'limao' },
        { targetId: 'alice', emojiId: 'estrela' },
      ],
    );
    expect(plan.remove).toEqual([{ targetId: 'alice', emojiId: 'estrela' }]);
  });

  it('reenviar o mesmo eixo com valor novo é um upsert, não duplica', () => {
    const plan = scale(
      [
        { targetId: 'alice', emojiId: 'limao', value: 1 },
        { targetId: 'alice', emojiId: 'limao', value: 3 },
      ],
      [{ targetId: 'alice', emojiId: 'limao' }],
    );
    expect(plan).toEqual({ save: [{ targetId: 'alice', emojiId: 'limao', value: 3 }], remove: [] });
  });
});
