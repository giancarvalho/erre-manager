/// <reference types="node" />
// Regenerates public/index.html (web SPA template, with the theme boot script) and public/manifest.webmanifest
// from the tokens.
// Run: pnpm --filter @erre/mobile exec tsx scripts/gen-index-html.ts (a test fails when it is stale).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { indexHtml, webManifest } from '../src/web/index-html';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public');
writeFileSync(path.join(publicDir, 'index.html'), indexHtml());
writeFileSync(path.join(publicDir, 'manifest.webmanifest'), webManifest());
