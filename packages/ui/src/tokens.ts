// Design tokens, exactly as docs/design/DESIGN.md §13 (plus `label`, see below).
// Change the DESIGN.md first, then this file.

// Os dois temas têm exatamente as mesmas chaves; um teste garante isso.
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
    scrim: 'rgba(0,0,0,0.6)',
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
    glowRgb: '34 211 238',
  },
  trophy: { gold: '#fbbf24', goldStrong: '#f59e0b', silver: '#cbd5e1', goldSubtle: 'rgba(245,158,11,0.08)' },
  danger: { text: '#f87171', subtle: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  warning: { text: '#fcd34d', subtle: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  success: { text: '#34d399' },
  shadow: { color: '#000000', opacity: 0.5 },
  statusBar: 'light',
} as const;

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
    scrim: 'rgba(9,9,11,0.4)',
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
    glowRgb: '6 182 212',
  },
  trophy: { gold: '#d97706', goldStrong: '#f59e0b', silver: '#64748b', goldSubtle: 'rgba(245,158,11,0.1)' },
  danger: { text: '#b91c1c', subtle: 'rgba(239,68,68,0.08)', border: 'rgba(185,28,28,0.3)' },
  warning: { text: '#92400e', subtle: 'rgba(245,158,11,0.12)', border: 'rgba(180,83,9,0.25)' },
  success: { text: '#047857' },
  shadow: { color: '#000000', opacity: 0.12 },
  statusBar: 'dark',
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : Widen<T[K]> };
export type ThemeColors = Widen<typeof dark>;
export type ThemeName = 'dark' | 'light';
export type ThemePreference = ThemeName | 'system';

export const themes: Record<ThemeName, ThemeColors> = { dark, light };
export const DEFAULT_THEME: ThemeName = 'dark';
// Preferência salva no dispositivo; "system" segue Appearance/prefers-color-scheme.

// Iguais nos dois temas
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

export const AVATAR_VARIANT_NAMES = Object.keys(avatar) as (keyof typeof avatar)[];

export const space = { 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const;
export const layout = { screenPadding: 16, screenPaddingWide: 20, contentMaxWidth: 512, minTouch: 48 } as const;

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '700', letterSpacing: -0.5 },
  titleLg: { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.3 },
  titleMd: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  // body at 500: labels and buttons (DESIGN §4, "400 ou 500")
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export const motion = {
  press: { duration: 100, scaleSmall: 0.95, scaleWide: 0.98 },
  color: { duration: 150 },
  pop: { duration: 280, easing: [0.34, 1.56, 0.64, 1] },
  fadeUp: { duration: 380, easing: [0.34, 1.56, 0.64, 1], distance: 8, stagger: 35, maxStaggered: 10 },
  expand: { duration: 240, easing: [0.22, 1, 0.36, 1] },
  shake: { duration: 420, easing: [0.36, 0.07, 0.19, 0.97], distance: 6 },
  pulseNeon: { duration: 2200 },
  pulseGold: { duration: 2000 },
} as const;

/**
 * Geist families per weight (DESIGN §4), loaded by the app with expo-font. On native a custom font
 * needs one family per weight; Text maps fontWeight to these.
 */
export const fonts = {
  '400': 'Geist_400Regular',
  '500': 'Geist_500Medium',
  '600': 'Geist_600SemiBold',
  '700': 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
} as const;
