// Portado de queridometro@7c5c5bf:src/lib/voting/filter-existing-votes.test.ts
import { describe, expect, it } from 'vitest';
import { filterVotesToCurrentMembers, filterVotesToKnownEmojis } from '../../domain/filter-existing-votes';

const members = [{ id: 'm1' }, { id: 'm2' }];

describe('filterVotesToCurrentMembers', () => {
  it('mantém votos para membros ainda presentes no grupo', () => {
    const result = filterVotesToCurrentMembers({ m1: 'coracao', m2: 'biscoito' }, members);
    expect(result).toEqual({ m1: 'coracao', m2: 'biscoito' });
  });

  it('descarta votos para membros que já não fazem parte do grupo', () => {
    const result = filterVotesToCurrentMembers({ m1: 'coracao', removido: 'biscoito' }, members);
    expect(result).toEqual({ m1: 'coracao' });
  });

  it('retorna objeto vazio quando não há membros atuais', () => {
    const result = filterVotesToCurrentMembers({ m1: 'coracao' }, []);
    expect(result).toEqual({});
  });
});

describe('filterVotesToKnownEmojis', () => {
  const activeEmojiIds = ['coracao', 'biscoito'];

  it('mantém votos cujo emoji ainda está no roster ativo', () => {
    const result = filterVotesToKnownEmojis({ m1: 'coracao', m2: 'biscoito' }, activeEmojiIds);
    expect(result).toEqual({ m1: 'coracao', m2: 'biscoito' });
  });

  it('descarta votos cujo emoji não existe mais no roster ativo', () => {
    const result = filterVotesToKnownEmojis({ m1: 'coracao', m2: 'emoji-removido' }, activeEmojiIds);
    expect(result).toEqual({ m1: 'coracao' });
  });

  it('retorna objeto vazio quando o único emoji lembrado foi removido', () => {
    const result = filterVotesToKnownEmojis({ m1: 'emoji-removido' }, activeEmojiIds);
    expect(result).toEqual({});
  });
});
