/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { indexHtml } from '../src/web/index-html';

test('public/index.html is up to date with the tokens (pnpm gen:html)', () => {
  const file = readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  expect(file).toBe(indexHtml());
});
