// Portado de queridometro@7c5c5bf:src/lib/trophies/trophy-catalog.ts
/** Funny per-emoji trophy name — shown wherever a round/all-time trophy winner is displayed. */
export const TROPHY_NAMES: Record<string, string> = {
  asno: 'Troféu Rei dos Asnos',
  biscoito: 'Troféu Biscoiteiro Oficial',
  bocao: 'Troféu Que Mel é Esse?!',
  bolo: 'Troféu de Confeiteiro',
  cobra: 'Troféu Língua de Cobra',
  coracao: 'Troféu Queridão da Galera',
  'coracao-partido': 'Troféu Balde de Água Fria',
  mala: 'Troféu Mala sem Alça',
  mentiroso: 'Troféu Nariz de Pinóquio',
  planta: 'Troféu Vaso Decorativo',
  vomito: 'Troféu Cadê o Balde',
};

/** Fallback for an emoji added to EMOJI_OPTIONS before it gets a punny name — see trophy-catalog.test.ts. */
export const DEFAULT_TROPHY_NAME = 'Troféu Misterioso';

export function trophyNameForEmoji(emojiId: string): string {
  return TROPHY_NAMES[emojiId] ?? DEFAULT_TROPHY_NAME;
}

/**
 * "R G B" triplet (Tailwind-style, no commas) matching each emoji's own
 * color association — used to tint the pulsing glow on a trophy win (the
 * gold ring/border itself stays gold; only the glow color changes). Picked
 * for thematic resonance and to stay visually distinct from neighbors.
 */
export const TROPHY_GLOW_RGB: Record<string, string> = {
  asno: '148 163 184', // slate-400
  biscoito: '251 146 60', // orange-400
  bocao: '232 121 249', // fuchsia-400
  bolo: '244 114 182', // pink-400
  cobra: '34 197 94', // green-500
  coracao: '239 68 68', // red-500
  'coracao-partido': '56 189 248', // sky-400 (tears)
  mala: '168 162 158', // stone-400
  mentiroso: '234 88 12', // orange-600 (Pinóquio's nose)
  planta: '45 212 191', // teal-400
  vomito: '163 230 53', // lime-400
};

/** Fallback: the same amber used for the gold ring, so an unmapped emoji still looks intentional. */
export const DEFAULT_TROPHY_GLOW_RGB = '245 158 11';

export function trophyGlowRgbForEmoji(emojiId: string): string {
  return TROPHY_GLOW_RGB[emojiId] ?? DEFAULT_TROPHY_GLOW_RGB;
}
