// Design tokens from docs/design/DESIGN.md §13. Sprint 10 completes this package (components, motion, lint).
const dark = {
  bg: {
    canvas: '#09090b',
    surface: 'rgba(24,24,27,0.5)',
    surfacePressed: 'rgba(24,24,27,0.7)',
    raised: '#18181b',
    input: '#18181b',
    control: '#27272a',
    controlSelected: '#3f3f46',
    overlay: 'rgba(9,9,11,0.95)',
  },
  border: { subtle: 'rgba(39,39,42,0.8)', default: '#3f3f46', input: '#71717a', focus: '#a1a1aa' },
  text: { primary: '#fafafa', secondary: '#d4d4d8', muted: '#a1a1aa', disabled: '#52525b', placeholder: '#71717a' },
  primary: { bg: '#f4f4f5', text: '#09090b' },
  accent: {
    solid: '#06b6d4',
    onSolid: '#09090b',
    text: '#67e8f9',
    subtle: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.4)',
    ring: '#22d3ee',
  },
  trophy: { gold: '#fbbf24', goldStrong: '#f59e0b', silver: '#cbd5e1', goldSubtle: 'rgba(245,158,11,0.08)' },
  danger: { text: '#f87171' },
  success: { text: '#34d399' },
  statusBar: 'light' as 'light' | 'dark',
};

export type ThemeColors = typeof dark;

const light: ThemeColors = {
  bg: {
    canvas: '#fafafa',
    surface: '#ffffff',
    surfacePressed: '#f4f4f5',
    raised: '#ffffff',
    input: '#ffffff',
    control: '#f4f4f5',
    controlSelected: '#e4e4e7',
    overlay: 'rgba(250,250,250,0.95)',
  },
  border: { subtle: '#e4e4e7', default: '#d4d4d8', input: '#71717a', focus: '#52525b' },
  text: { primary: '#09090b', secondary: '#3f3f46', muted: '#52525b', disabled: '#a1a1aa', placeholder: '#71717a' },
  primary: { bg: '#18181b', text: '#fafafa' },
  accent: {
    solid: '#06b6d4',
    onSolid: '#09090b',
    text: '#0e7490',
    subtle: 'rgba(6,182,212,0.12)',
    border: 'rgba(8,145,178,0.4)',
    ring: '#0891b2',
  },
  trophy: { gold: '#d97706', goldStrong: '#f59e0b', silver: '#64748b', goldSubtle: 'rgba(245,158,11,0.1)' },
  danger: { text: '#b91c1c' },
  success: { text: '#047857' },
  statusBar: 'dark',
};

export const themes = { dark, light } as const;
export type ThemeName = keyof typeof themes;
export type ThemePreference = ThemeName | 'system';

export const avatar = {
  indigo: { bg: '#4f46e5', text: '#e0e7ff' },
  violet: { bg: '#7c3aed', text: '#ede9fe' },
  emerald: { bg: '#059669', text: '#d1fae5' },
  amber: { bg: '#f59e0b', text: '#451a03' },
  sky: { bg: '#0284c7', text: '#e0f2fe' },
  rose: { bg: '#e11d48', text: '#ffe4e6' },
  slate: { bg: '#475569', text: '#f1f5f9' },
  teal: { bg: '#0d9488', text: '#ccfbf1' },
} as const;
export type AvatarVariant = keyof typeof avatar;

export const space = { 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const;
export const minTouch = 48;

export const type = {
  titleLg: { fontSize: 24, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.3 },
  titleMd: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};
