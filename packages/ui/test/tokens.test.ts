import { describe, expect, it } from 'vitest';

import { themes } from '../src/tokens';

type Tree = { [k: string]: string | number | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v !== 'object' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe('tokens', () => {
  it('dark and light themes define the same keys', () => {
    expect(keys(themes.light as unknown as Tree).sort()).toEqual(keys(themes.dark as unknown as Tree).sort());
  });

  it('every color is a hex or rgba value', () => {
    const notColors = new Set(['statusBar', 'accent.glowRgb', 'shadow.opacity']);
    for (const theme of Object.values(themes)) {
      for (const key of keys(theme as unknown as Tree)) {
        if (notColors.has(key)) continue;
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], theme);
        expect(value, key).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,(0|1|0?\.\d+)\))$/);
      }
    }
  });
});
