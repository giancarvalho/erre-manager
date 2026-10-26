/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { indexHtml, webManifest } from '../src/web/index-html';

test('public/index.html is up to date with the tokens (pnpm gen:html)', () => {
  const file = readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  expect(file).toBe(indexHtml());
});

test('public/manifest.webmanifest is up to date (pnpm gen:html) and points at icons that exist', () => {
  const file = readFileSync(path.join(__dirname, '../public/manifest.webmanifest'), 'utf8');
  expect(file).toBe(webManifest());
  const manifest = JSON.parse(file) as { icons: { src: string; purpose: string }[]; display: string };
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i) => i.purpose)).toContain('maskable');
  for (const icon of manifest.icons) expect(existsSync(path.join(__dirname, '../public', icon.src))).toBe(true);
});
