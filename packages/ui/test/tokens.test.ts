import { describe, expect, it } from 'vitest';

import { themes } from '../src/tokens';

type Tree = { [k: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe('tokens', () => {
  it('dark and light themes define the same keys', () => {
    expect(keys(themes.light as unknown as Tree).sort()).toEqual(keys(themes.dark as unknown as Tree).sort());
  });

  it('every color is a hex or rgba value', () => {
    for (const theme of Object.values(themes)) {
      for (const [k, v] of Object.entries(theme)) {
        if (k === 'statusBar') continue;
        for (const value of Object.values(v as Record<string, string>)) {
          expect(value).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,(0|1|0?\.\d+)\))$/);
        }
      }
    }
  });
});
