// Portado de queridometro@7c5c5bf:src/lib/results/hidden-round-banner.test.ts
import { describe, expect, it } from 'vitest';
import { shouldShowHiddenRoundBanner } from '../../domain/hidden-round-banner';

describe('shouldShowHiddenRoundBanner', () => {
  it('mostra o banner pro criador quando não há rodada visível mas há uma escondida', () => {
    expect(shouldShowHiddenRoundBanner(true, 0, 1)).toBe(true);
  });

  it('não mostra pro criador quando o grupo genuinamente nunca liberou nada (sem escondidas também)', () => {
    expect(shouldShowHiddenRoundBanner(true, 0, 0)).toBe(false);
  });

  it('não mostra quando já existe rodada visível, mesmo com outras escondidas', () => {
    expect(shouldShowHiddenRoundBanner(true, 2, 1)).toBe(false);
  });

  it('nunca mostra pra quem não é o criador, mesmo com rodadas escondidas', () => {
    expect(shouldShowHiddenRoundBanner(false, 0, 3)).toBe(false);
  });
});
