/// <reference types="node" />
// After `expo export`: deploy-time values into dist/ (see src/web/well-known.ts). Reads only public values:
// EXPO_PUBLIC_WEB_URL, APPLE_TEAM_ID and ANDROID_CERT_SHA256 (comma separated). Missing ones are skipped.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { absolutizeShareTags, appleAppSiteAssociation, assetLinks } from '../src/web/well-known';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const { EXPO_PUBLIC_WEB_URL: webUrl, APPLE_TEAM_ID: teamId, ANDROID_CERT_SHA256: certs } = process.env;

if (webUrl) {
  const file = path.join(dist, 'index.html');
  writeFileSync(file, absolutizeShareTags(readFileSync(file, 'utf8'), webUrl));
}
if (teamId || certs) mkdirSync(path.join(dist, '.well-known'), { recursive: true });
if (teamId) writeFileSync(path.join(dist, '.well-known/apple-app-site-association'), appleAppSiteAssociation(teamId));
if (certs)
  writeFileSync(
    path.join(dist, '.well-known/assetlinks.json'),
    assetLinks(
      certs
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  );
