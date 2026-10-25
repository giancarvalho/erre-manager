import { closeDb, createDb, type Db } from '@erre/db';
import { Hono } from 'hono';

import { createAuth, type AuthConfig } from '../src/server/auth/auth';
import { createCoreApi } from '../src/server/app';
import { errorHandler } from '../src/server/http';
import { installFakeGoogle } from '../src/server/testing';

export const ORIGIN = 'http://localhost:8081';
export const TRUSTED = [ORIGIN, 'erre://'];
export const CLIENT_ID = 'test-client.apps.googleusercontent.com';

export function setupCore(dbUrl: string, overrides: Partial<AuthConfig> = {}) {
  const db: Db = createDb(dbUrl);
  const logs: string[] = [];
  const auth = createAuth({
    db,
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-0123456789-0123456789-0123456789',
    google: { clientId: CLIENT_ID, clientSecret: 'test-secret' },
    trustedOrigins: TRUSTED,
    log: (level, message) => logs.push(`${level}: ${message}`),
    rateLimit: { enabled: false },
    ...overrides,
  });
  const app = new Hono()
    .route('/v1', createCoreApi({ db, auth, trustedOrigins: TRUSTED }))
    .onError(errorHandler({ error: (obj, msg) => logs.push(`${msg} ${JSON.stringify(obj)}`) }));
  const google = installFakeGoogle(CLIENT_ID);
  return {
    db,
    auth,
    app,
    google,
    logs,
    close: async () => {
      google.restore();
      await closeDb(db);
    },
  };
}
