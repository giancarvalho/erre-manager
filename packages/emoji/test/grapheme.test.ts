import { describe, expect, it } from 'vitest';

import { countGraphemesFallback, isSingleGrapheme } from '../src/grapheme';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const segmentCount = (value: string) => Array.from(segmenter.segment(value)).length;

const samples: Array<[label: string, value: string, clusters: number]> = [
  ['emoji simples', '😀', 1],
  ['emoji com seletor de variação', '❤️', 1],
  ['tom de pele', '👍🏽', 1],
  ['família com ZWJ', '👨‍👩‍👧‍👦', 1],
  ['profissão com ZWJ e tom de pele', '👩🏾‍🚀', 1],
  ['bandeira de país', '🇧🇷', 1],
  ['bandeira de subdivisão (tags)', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 1],
  ['keycap', '1️⃣', 1],
  ['letra com acento combinante', 'é', 1],
  ['dois emoji', '😀😀', 2],
  ['duas bandeiras', '🇧🇷🇵🇹', 2],
  ['texto', 'oi', 2],
  ['emoji e texto', '🔥a', 2],
  ['vazio', '', 0],
];

describe('countGraphemesFallback', () => {
  it.each(samples)('%s: igual ao Intl.Segmenter', (_label, value, clusters) => {
    expect(segmentCount(value)).toBe(clusters);
    expect(countGraphemesFallback(value)).toBe(clusters);
  });
});

describe('isSingleGrapheme', () => {
  it.each(samples)('%s', (_label, value, clusters) => {
    expect(isSingleGrapheme(value)).toBe(clusters === 1);
  });

  it('usa a alternativa quando o Intl.Segmenter não existe (Hermes)', () => {
    const intl = Intl as unknown as { Segmenter?: typeof Intl.Segmenter | undefined };
    const original = intl.Segmenter;
    delete intl.Segmenter;
    try {
      expect(isSingleGrapheme('👨‍👩‍👧‍👦')).toBe(true);
      expect(isSingleGrapheme('😀😀')).toBe(false);
    } finally {
      intl.Segmenter = original;
    }
  });
});
