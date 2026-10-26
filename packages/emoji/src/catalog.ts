// Portado de queridometro@7c5c5bf:src/lib/emojis.ts e src/lib/emoji-legend.ts.

export type EmojiOption = { id: string; char: string; label: string };

/** Global emoji catalog (the "Clássico" roster). Communities and events pick from it or add their own. */
export const EMOJI_OPTIONS: readonly EmojiOption[] = [
  // Easter egg: char is 🦄 (unicorn), not 🫏 — deliberate; id, label and trophy name stay "Asno".
  { id: 'asno', char: '🦄', label: 'Asno' },
  { id: 'biscoito', char: '🍪', label: 'Biscoito' },
  { id: 'bocao', char: '🫦', label: 'Bocão' },
  { id: 'bolo', char: '🎂', label: 'Bolo' },
  { id: 'cobra', char: '🐍', label: 'Cobra' },
  { id: 'coracao', char: '❤️', label: 'Coração' },
  { id: 'coracao-partido', char: '💔', label: 'Coração partido' },
  { id: 'mala', char: '💼', label: 'Mala' },
  { id: 'mentiroso', char: '🤥', label: 'Mentiroso' },
  { id: 'planta', char: '🪴', label: 'Planta' },
  { id: 'vomito', char: '🤢', label: 'Vômito' },
] as const;

/** Short sense of each emoji, shown in the legend on the voting screen. */
export const EMOJI_DESCRIPTIONS: Record<string, string> = {
  asno: 'Erra com convicção.',
  biscoito: 'Mendiga atenção.',
  bocao: 'Sexy, caliente.',
  bolo: 'Anima o rolê e não aparece.',
  cobra: 'Falso, age pelas costas.',
  coracao: 'Querido.',
  'coracao-partido': 'Me decepcionou.',
  mala: 'Inconveniente, chato, difícil de suportar.',
  mentiroso: 'Nem ele acredita.',
  planta: 'Existe, mas ninguém percebe.',
  vomito: 'Tenho nojo.',
};
