import { describe, expect, it } from 'vitest';

import { contrast } from '../src/contrast';
import { avatar, themes, type ThemeColors } from '../src/tokens';

const TEXT = 4.5; // normal text
const UI = 3; // large text, icons, borders that identify a control

// [foreground, background, minimum, what]
function pairs(c: ThemeColors): [string, string, number, string][] {
  return [
    [c.text.primary, c.bg.canvas, TEXT, 'text.primary on canvas'],
    [c.text.secondary, c.bg.canvas, TEXT, 'text.secondary on canvas'],
    [c.text.muted, c.bg.canvas, TEXT, 'text.muted on canvas'],
    [c.text.primary, c.bg.control, TEXT, 'text.primary on control'],
    [c.text.muted, c.bg.control, TEXT, 'text.muted on control'],
    [c.text.secondary, c.bg.surface, TEXT, 'text.secondary on surface'],
    [c.text.muted, c.bg.surface, TEXT, 'text.muted on surface'],
    [c.text.primary, c.bg.raised, TEXT, 'text.primary on raised'],
    [c.text.muted, c.bg.raised, TEXT, 'text.muted on raised'],
    [c.text.placeholder, c.bg.input, UI, 'placeholder on input'],
    [c.border.input, c.bg.input, UI, 'input border on input'],
    [c.border.focus, c.bg.canvas, UI, 'focus ring on canvas'],
    [c.primary.text, c.primary.bg, TEXT, 'primary button'],
    [c.accent.onSolid, c.accent.solid, TEXT, 'accent button'],
    [c.accent.text, c.bg.canvas, TEXT, 'accent text on canvas'],
    [c.accent.text, c.accent.subtle, TEXT, 'accent text on accent.subtle'],
    [c.accent.ring, c.bg.canvas, UI, 'selection ring on canvas'],
    [c.danger.text, c.bg.canvas, TEXT, 'danger text on canvas'],
    [c.danger.text, c.danger.subtle, TEXT, 'danger text on danger.subtle'],
    [c.warning.text, c.warning.subtle, TEXT, 'warning text on warning.subtle'],
    [c.success.text, c.bg.canvas, TEXT, 'success text on canvas'],
    [c.trophy.gold, c.bg.canvas, UI, 'gold ring on canvas'],
    [c.trophy.silver, c.bg.canvas, UI, 'silver ring on canvas'],
    [c.text.primary, c.trophy.goldSubtle, TEXT, 'text on trophy winner row'],
  ];
}

describe.each(Object.entries(themes))('WCAG AA, %s theme', (_name, colors) => {
  it.each(pairs(colors))('%s on %s ≥ %s (%s)', (fg, bg, min) => {
    expect(contrast(fg, bg, colors.bg.canvas)).toBeGreaterThanOrEqual(min);
  });
});

describe('avatars (same in both themes)', () => {
  it.each(Object.entries(avatar))('%s initials reach large-text contrast', (_v, { bg, text }) => {
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(UI);
  });
});

describe('contrast function', () => {
  it('matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#fafafa', '#09090b')).toBeCloseTo(19.1, 1); // DESIGN §3.2
    expect(contrast('#09090b', '#06b6d4')).toBeCloseTo(8.2, 1);
  });
});
