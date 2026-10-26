// Portado de queridometro@7c5c5bf:src/lib/emojis/group-emoji-config.test.ts
// The persistence mocks became plain inputs: the functions receive the saved rows and return the rows to save.
// The "grupo demo" case is gone (P-003); the isSingleGrapheme cases live in @erre/emoji.
import { EMOJI_OPTIONS, MAX_ACTIVE_EMOJIS } from '@erre/emoji';
import { describe, expect, it } from 'vitest';

import { activeEmojiOptions, buildEmojiConfigRows, emojiCatalog, type EmojiConfigRow } from '../../domain/emoji-config';

const custom = (over: Partial<EmojiConfigRow>): EmojiConfigRow => ({
  emojiId: 'custom-xyz',
  sortOrder: 0,
  isCustom: true,
  active: true,
  char: '🦄',
  label: 'Unicórnio',
  trophyName: 'Troféu Mágico',
  description: null,
  glowRgb: null,
  ...over,
});

const built = (result: ReturnType<typeof buildEmojiConfigRows>) => {
  if (!result.ok) throw new Error(result.error);
  return result.rows;
};

describe('activeEmojiOptions', () => {
  it('comunidade sem config salva usa o catálogo global, na ordem padrão', () => {
    expect(activeEmojiOptions([]).map((o) => o.id)).toEqual(EMOJI_OPTIONS.map((o) => o.id));
  });

  it('resolve char/label/nome/descrição/cor de um emoji custom a partir da própria linha', () => {
    expect(activeEmojiOptions([custom({ description: 'É mágico.', glowRgb: '255 0 128' })])).toEqual([
      {
        id: 'custom-xyz',
        char: '🦄',
        label: 'Unicórnio',
        trophyName: 'Troféu Mágico',
        isCustom: true,
        description: 'É mágico.',
        glowRgb: '255 0 128',
      },
    ]);
  });

  it('emoji custom sem cor salva cai no âmbar padrão (fallback)', () => {
    const [option] = activeEmojiOptions([custom({})]);
    expect(option!.glowRgb).toBe('245 158 11');
    expect(option!.description).toBeNull();
  });

  it('omite emojis inativos do roster ativo', () => {
    const rows: EmojiConfigRow[] = [
      { ...custom({}), emojiId: 'coracao', isCustom: false, char: null, label: null, trophyName: null },
      custom({ emojiId: 'custom-old', sortOrder: 1, active: false, char: '👻' }),
    ];
    expect(activeEmojiOptions(rows).map((o) => o.id)).toEqual(['coracao']);
  });
});

describe('emojiCatalog', () => {
  it('inclui um emoji custom mesmo inativo — histórico continua resolvendo', () => {
    const catalog = emojiCatalog([
      custom({
        emojiId: 'custom-old',
        active: false,
        char: '👻',
        label: 'Antigo',
        trophyName: 'Troféu Antigo',
        description: 'Já não existe mais.',
        glowRgb: '100 100 100',
      }),
    ]);
    expect(catalog.get('custom-old')).toEqual({
      id: 'custom-old',
      char: '👻',
      label: 'Antigo',
      trophyName: 'Troféu Antigo',
      isCustom: true,
      description: 'Já não existe mais.',
      glowRgb: '100 100 100',
    });
  });

  it('também contém todo o catálogo global, mesmo com config custom', () => {
    const catalog = emojiCatalog([custom({})]);
    expect(catalog.has('coracao')).toBe(true);
    expect(catalog.has('custom-xyz')).toBe(true);
  });
});

describe('buildEmojiConfigRows', () => {
  it('recusa lista vazia (mínimo 1)', () => {
    expect(buildEmojiConfigRows([]).ok).toBe(false);
  });

  it(`recusa mais de ${MAX_ACTIVE_EMOJIS} emojis ativos`, () => {
    const entries = Array.from({ length: MAX_ACTIVE_EMOJIS + 1 }, (_, i) => ({
      isCustom: true as const,
      char: '🦄',
      label: `Emoji ${i}`,
      trophyName: `Troféu ${i}`,
    }));
    expect(buildEmojiConfigRows(entries).ok).toBe(false);
  });

  it('recusa emoji custom com char inválido (mais de um grapheme)', () => {
    expect(buildEmojiConfigRows([{ isCustom: true, char: '🦄🐍', label: 'Duplo', trophyName: 'Troféu' }]).ok).toBe(
      false,
    );
  });

  it('recusa emoji do catálogo com id inválido', () => {
    expect(buildEmojiConfigRows([{ isCustom: false, emojiId: 'nao-existe' }]).ok).toBe(false);
  });

  it('recusa descrição maior que o limite', () => {
    const result = buildEmojiConfigRows([
      { isCustom: true, char: '🦄', label: 'Unicórnio', trophyName: 'Troféu', description: 'x'.repeat(200) },
    ]);
    expect(result.ok).toBe(false);
  });

  it('gera um novo id pra um emoji custom sem emojiId, salvando descrição e cor', () => {
    const rows = built(
      buildEmojiConfigRows([
        {
          isCustom: true,
          char: '🦄',
          label: 'Unicórnio',
          trophyName: 'Troféu Mágico',
          description: 'É mágico.',
          glowRgb: '255 0 128',
        },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.emojiId).toMatch(/^custom-/);
    expect(rows[0]!.isCustom).toBe(true);
    expect(rows[0]!.description).toBe('É mágico.');
    expect(rows[0]!.glowRgb).toBe('255 0 128');
  });

  it('descrição e cor são opcionais — ficam null quando omitidas', () => {
    const rows = built(buildEmojiConfigRows([{ isCustom: true, char: '🦄', label: 'Unicórnio', trophyName: 'T' }]));
    expect(rows[0]!.description).toBeNull();
    expect(rows[0]!.glowRgb).toBeNull();
  });

  it('cor com formato inválido é descartada (cai pra null, resolvida como fallback na leitura)', () => {
    const rows = built(
      buildEmojiConfigRows([
        { isCustom: true, char: '🦄', label: 'Unicórnio', trophyName: 'Troféu Mágico', glowRgb: 'not-a-color' },
      ]),
    );
    expect(rows[0]!.glowRgb).toBeNull();
  });

  it('reutiliza o emojiId existente ao reenviar um emoji custom já criado (não gera um novo)', () => {
    const rows = built(
      buildEmojiConfigRows([
        { isCustom: true, emojiId: 'custom-fixo', char: '🦄', label: 'Unicórnio', trophyName: 'Troféu Mágico' },
      ]),
    );
    expect(rows[0]!.emojiId).toBe('custom-fixo');
  });

  it('salva uma mistura de catálogo + custom, na ordem enviada, com active=true', () => {
    const rows = built(
      buildEmojiConfigRows([
        { isCustom: false, emojiId: 'coracao' },
        { isCustom: true, char: '🦄', label: 'Unicórnio', trophyName: 'Troféu Mágico' },
      ]),
    );
    expect(rows[0]).toMatchObject({ emojiId: 'coracao', sortOrder: 0, isCustom: false, active: true });
    expect(rows[1]).toMatchObject({ sortOrder: 1, isCustom: true, active: true, char: '🦄' });
  });

  it('recusa emoji repetido', () => {
    expect(
      buildEmojiConfigRows([
        { isCustom: false, emojiId: 'coracao' },
        { isCustom: false, emojiId: 'coracao' },
      ]),
    ).toEqual({ ok: false, error: 'Emoji repetido.' });
  });
});
