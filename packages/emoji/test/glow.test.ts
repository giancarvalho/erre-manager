// Portado de queridometro@7c5c5bf:src/lib/emojis/infer-glow-color.test.ts
import { describe, expect, it } from 'vitest';
import { inferEmojiGlowColor } from '../src/glow';

describe('inferEmojiGlowColor', () => {
  it('sem `document` (ambiente sem DOM, ex.: SSR/testes), cai no âmbar padrão', () => {
    // vitest.config.mts roda com environment: "node" — sem jsdom, sem canvas.
    // O propósito deste teste é só travar esse guard; a extração de cor real
    // (canvas + amostragem de pixels) é verificada manualmente num browser
    // real, onde `document` de fato existe.
    expect(inferEmojiGlowColor('🦄')).toBe('245 158 11');
  });
});
