// Portado de queridometro@7c5c5bf:src/lib/events/voting-event-emoji-config.test.ts (validação e resolução,
// contra as funções puras; o "só em rascunho" é testado na API, tests/integration/lifecycle.test.ts).
import { DEFAULT_TROPHY_GLOW_RGB, EMOJI_OPTIONS, MAX_DESCRIPTION_LENGTH, trophyNameForEmoji } from '@erre/emoji';
import { describe, expect, it } from 'vitest';

import {
  buildEventEmojiRows,
  resolveEventEmoji,
  type EventEmojiEntryInput,
  type EventEmojiRow,
} from '../../domain/emoji-config';
import { MAX_ACTIVE_EMOJIS, MAX_SCALE_AXES } from '../../domain/limits';

const catalog = (n: number, scaleMax?: number): EventEmojiEntryInput[] =>
  EMOJI_OPTIONS.slice(0, n).map((o) => ({ isCustom: false, emojiId: o.id, ...(scaleMax ? { scaleMax } : {}) }));
const custom = (over: Partial<Extract<EventEmojiEntryInput, { isCustom: true }>> = {}): EventEmojiEntryInput => ({
  isCustom: true,
  char: '🦄',
  label: 'Unicórnio',
  trophyName: 'Troféu Unicórnio',
  ...over,
});
const error = (r: ReturnType<typeof buildEventEmojiRows>) => (r.ok ? null : r.error);
const rows = (r: ReturnType<typeof buildEventEmojiRows>) => (r.ok ? r.rows : []);

describe('buildEventEmojiRows — categórico', () => {
  it('recusa lista vazia', () => {
    expect(error(buildEventEmojiRows('categorical', []))).toBe('Escolha pelo menos 1 emoji.');
  });

  it(`recusa mais de ${MAX_ACTIVE_EMOJIS} e aceita exatamente ${MAX_ACTIVE_EMOJIS}`, () => {
    const filled = (n: number) => {
      const list = catalog(Math.min(n, EMOJI_OPTIONS.length));
      while (list.length < n) list.push(custom({ emojiId: `custom-${list.length}` }));
      return list;
    };
    expect(error(buildEventEmojiRows('categorical', filled(MAX_ACTIVE_EMOJIS + 1)))).toBe(
      `No máximo ${MAX_ACTIVE_EMOJIS} emojis ativos.`,
    );
    expect(rows(buildEventEmojiRows('categorical', filled(MAX_ACTIVE_EMOJIS)))).toHaveLength(MAX_ACTIVE_EMOJIS);
  });

  it('recusa emoji repetido (custom com o mesmo id, ou catálogo e custom com o mesmo id)', () => {
    expect(
      error(buildEventEmojiRows('categorical', [custom({ emojiId: 'custom-a' }), custom({ emojiId: 'custom-a' })])),
    ).toBe('Emoji repetido.');
    const id = EMOJI_OPTIONS[0]!.id;
    expect(error(buildEventEmojiRows('categorical', [{ isCustom: false, emojiId: id }, custom({ emojiId: id })]))).toBe(
      'Emoji repetido.',
    );
  });

  it(`descrição do custom: ${MAX_DESCRIPTION_LENGTH} aceita, ${MAX_DESCRIPTION_LENGTH + 1} recusa (cap do roster, não os 280 do evento)`, () => {
    expect(buildEventEmojiRows('categorical', [custom({ description: 'a'.repeat(MAX_DESCRIPTION_LENGTH) })]).ok).toBe(
      true,
    );
    expect(
      error(buildEventEmojiRows('categorical', [custom({ description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1) })])),
    ).toBe(`Descrição precisa ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  });

  it('glowRgb fora de 0-255 é descartado; 255 255 255 é aceito', () => {
    expect(rows(buildEventEmojiRows('categorical', [custom({ glowRgb: '256 0 0' })]))[0]!.glowRgb).toBeNull();
    expect(rows(buildEventEmojiRows('categorical', [custom({ glowRgb: '255 255 255' })]))[0]!.glowRgb).toBe(
      '255 255 255',
    );
  });

  it('recusa id de catálogo inválido e char custom que não é um emoji só', () => {
    expect(error(buildEventEmojiRows('categorical', [{ isCustom: false, emojiId: 'nao-existe' }]))).toBe(
      'Emoji do catálogo inválido.',
    );
    expect(error(buildEventEmojiRows('categorical', [custom({ char: 'ab' })]))).toBe(
      'O emoji custom precisa ser um único emoji.',
    );
  });

  it('recusa scaleMax num evento categórico, inclusive 0 e mesmo fora da primeira linha', () => {
    const message = 'Evento categórico não tem escala por emoji.';
    expect(error(buildEventEmojiRows('categorical', catalog(1, 5)))).toBe(message);
    expect(
      error(buildEventEmojiRows('categorical', [{ isCustom: false, emojiId: EMOJI_OPTIONS[0]!.id, scaleMax: 0 }])),
    ).toBe(message);
    expect(
      error(
        buildEventEmojiRows('categorical', [
          ...catalog(1),
          { isCustom: false, emojiId: EMOJI_OPTIONS[1]!.id, scaleMax: 3 },
        ]),
      ),
    ).toBe(message);
  });

  it('salva com scaleMax sempre null, na ordem enviada', () => {
    const r = rows(buildEventEmojiRows('categorical', catalog(3)));
    expect(r.map((x) => [x.sortOrder, x.scaleMax])).toEqual([
      [0, null],
      [1, null],
      [2, null],
    ]);
  });

  it('gera id novo para custom sem emojiId e reutiliza o existente quando enviado', () => {
    const r = rows(
      buildEventEmojiRows(
        'categorical',
        [custom(), custom({ emojiId: 'custom-keep', char: '🐙' })],
        () => 'custom-new',
      ),
    );
    expect(r.map((x) => x.emojiId)).toEqual(['custom-new', 'custom-keep']);
  });
});

describe('buildEventEmojiRows — escala', () => {
  const message = 'A escala de cada emoji precisa ser um número inteiro entre 1 e 10.';

  it('recusa eixo sem scaleMax, mesmo só na segunda linha', () => {
    expect(error(buildEventEmojiRows('scale', catalog(1)))).toBe(message);
    expect(
      error(buildEventEmojiRows('scale', [...catalog(1, 5), { isCustom: false, emojiId: EMOJI_OPTIONS[1]!.id }])),
    ).toBe(message);
  });

  it.each([0, -1, 11, 2.5, Number.NaN])('recusa scaleMax %s', (scaleMax) => {
    expect(error(buildEventEmojiRows('scale', [{ isCustom: false, emojiId: EMOJI_OPTIONS[0]!.id, scaleMax }]))).toBe(
      message,
    );
  });

  it('recusa scaleMax null vindo de um payload não confiável', () => {
    const entry = { isCustom: false, emojiId: EMOJI_OPTIONS[0]!.id, scaleMax: null } as unknown as EventEmojiEntryInput;
    expect(error(buildEventEmojiRows('scale', [entry]))).toBe(message);
  });

  it('aceita tetos diferentes por eixo e os limites 1 e 10', () => {
    const r = rows(
      buildEventEmojiRows('scale', [
        { isCustom: false, emojiId: EMOJI_OPTIONS[0]!.id, scaleMax: 1 },
        { isCustom: false, emojiId: EMOJI_OPTIONS[1]!.id, scaleMax: 10 },
        custom({ scaleMax: 4 }),
      ]),
    );
    expect(r.map((x) => x.scaleMax)).toEqual([1, 10, 4]);
  });

  it(`recusa mais de ${MAX_SCALE_AXES} eixos (abaixo do teto categórico) e aceita exatamente ${MAX_SCALE_AXES}`, () => {
    expect(error(buildEventEmojiRows('scale', catalog(MAX_SCALE_AXES + 1, 5)))).toBe(
      `No máximo ${MAX_SCALE_AXES} eixos em um evento de escala.`,
    );
    expect(rows(buildEventEmojiRows('scale', catalog(MAX_SCALE_AXES, 5)))).toHaveLength(MAX_SCALE_AXES);
  });
});

describe('resolveEventEmoji', () => {
  const row = (over: Partial<EventEmojiRow>): EventEmojiRow => ({
    emojiId: EMOJI_OPTIONS[0]!.id,
    sortOrder: 0,
    isCustom: false,
    char: null,
    label: null,
    trophyName: null,
    description: null,
    glowRgb: null,
    scaleMax: null,
    ...over,
  });

  it('resolve uma linha de catálogo para o char e o label reais, repassando scaleMax', () => {
    const o = EMOJI_OPTIONS[0]!;
    expect(resolveEventEmoji(row({ scaleMax: 7 }))).toEqual(
      expect.objectContaining({ id: o.id, char: o.char, label: o.label, isCustom: false, scaleMax: 7 }),
    );
  });

  it('resolve uma linha custom com os campos salvos, sem tocar no catálogo', () => {
    const r = resolveEventEmoji(
      row({
        emojiId: 'custom-x',
        isCustom: true,
        char: '🦄',
        label: 'Uni',
        trophyName: 'Troféu Uni',
        description: 'd',
        glowRgb: '1 2 3',
        scaleMax: 3,
      }),
    );
    expect(r).toEqual({
      id: 'custom-x',
      char: '🦄',
      label: 'Uni',
      trophyName: 'Troféu Uni',
      isCustom: true,
      description: 'd',
      glowRgb: '1 2 3',
      scaleMax: 3,
    });
  });

  it('custom com glowRgb inválido ou null cai no brilho padrão; char, label e troféu null caem nos fallbacks', () => {
    expect(resolveEventEmoji(row({ emojiId: 'custom-x', isCustom: true, glowRgb: 'x' })).glowRgb).toBe(
      DEFAULT_TROPHY_GLOW_RGB,
    );
    const r = resolveEventEmoji(row({ emojiId: 'custom-x', isCustom: true }));
    expect([r.char, r.label, r.trophyName, r.glowRgb]).toEqual([
      '❓',
      'custom-x',
      trophyNameForEmoji('custom-x'),
      DEFAULT_TROPHY_GLOW_RGB,
    ]);
  });

  it('linha de catálogo com id que saiu do catálogo cai no placeholder, sem lançar', () => {
    expect(resolveEventEmoji(row({ emojiId: 'sumiu' }))).toEqual(
      expect.objectContaining({ char: '❓', label: 'sumiu' }),
    );
  });
});
