/// <reference types="node" />
// Regenerates public/index.html (web SPA template) with the theme boot script from the tokens.
// Run: pnpm --filter @erre/mobile exec tsx scripts/gen-index-html.ts (a test fails when it is stale).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { indexHtml } from '../src/web/index-html';

writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/index.html'), indexHtml());
