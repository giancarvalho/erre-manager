// Portado de queridometro@7c5c5bf:src/lib/trophies/trophy-catalog.test.ts
import { describe, expect, it } from 'vitest';
import { EMOJI_OPTIONS } from '../src/catalog';
import { TROPHY_NAMES, trophyNameForEmoji, DEFAULT_TROPHY_NAME } from '../src/trophy-catalog';

describe('trophy-catalog', () => {
  it('tem um nome de troféu pra cada emoji do catálogo atual', () => {
    for (const opt of EMOJI_OPTIONS) {
      expect(TROPHY_NAMES[opt.id]).toBeTruthy();
    }
  });

  it('trophyNameForEmoji retorna o nome cadastrado', () => {
    expect(trophyNameForEmoji('coracao')).toBe('Troféu Queridão da Galera');
  });

  it('trophyNameForEmoji cai no fallback pra um emoji desconhecido (ainda sem nome cadastrado)', () => {
    expect(trophyNameForEmoji('emoji-novo-sem-nome')).toBe(DEFAULT_TROPHY_NAME);
  });
});
