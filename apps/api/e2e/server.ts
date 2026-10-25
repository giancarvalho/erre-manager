// Test-only API for the app's Playwright e2e: disposable database and a fake Google token endpoint.
// Never used in production (not part of the build). Run: pnpm --filter @erre/api exec tsx e2e/server.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAuth, createCoreApi } from '@erre/core/server';
import { installFakeGoogle } from '@erre/core/testing';
import { closeDb, createDb } from '@erre/db';
import { createTestDatabase } from '@erre/db/testing';
import { serve } from '@hono/node-server';

import { createApp } from '../src/app';
import { createLogger } from '../src/logger';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const port = Number(process.env.E2E_API_PORT ?? 3000);
const webOrigin = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:8081';
const clientId = 'e2e-client.apps.googleusercontent.com';

// Fixed name: Playwright may kill this process before shutdown runs; the next start drops the leftover.
const testDb = await createTestDatabase({ root, name: 'erre_e2e' });
const db = createDb(testDb.urls.app);
const google = installFakeGoogle(clientId, { acceptEncodedCodes: true });
const trustedOrigins = [webOrigin, 'erre://'];
const logger = createLogger({ level: 'warn' });
const auth = createAuth({
  db,
  baseURL: `http://localhost:${port}`,
  secret: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
  google: { clientId, clientSecret: 'e2e' },
  trustedOrigins,
  rateLimit: { enabled: false },
  log: (level, message) => logger[level](message),
});
const app = createApp({ logger, core: createCoreApi({ db, auth, trustedOrigins }), webOrigins: [webOrigin] });
const server = serve({ fetch: app.fetch, port }, () => console.warn(`e2e api on http://localhost:${port}`));

async function shutdown() {
  server.close();
  google.restore();
  await closeDb(db);
  await testDb.drop();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
