import { createAuth, createCoreApi } from '@erre/core/server';
import { installFakeGoogle, signInWithGoogle } from '@erre/core/testing';
import { closeDb, createDb } from '@erre/db';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import { createApp } from '../../src/app';
import { createLogger } from '../../src/logger';

const ORIGIN = 'http://localhost:8081';
const db = createDb(inject('db').app);
const google = installFakeGoogle('cid');
const auth = createAuth({
  db,
  baseURL: 'http://localhost:3000',
  secret: 'x'.repeat(40),
  google: { clientId: 'cid', clientSecret: 'cs' },
  trustedOrigins: [ORIGIN, 'erre://'],
  rateLimit: { enabled: false },
});
const app = createApp({
  logger: createLogger({ level: 'silent' }),
  core: createCoreApi({ db, auth, trustedOrigins: [ORIGIN, 'erre://'] }),
  webOrigins: [ORIGIN],
});

beforeAll(() => undefined);
afterAll(async () => {
  google.restore();
  await closeDb(db);
});

describe('API with the core mounted', () => {
  it('signs in with Google and reads /v1/me', async () => {
    const email = `api-${Date.now()}@example.com`;
    const { cookie } = await signInWithGoogle(
      app,
      google,
      { sub: `s-${Date.now()}`, email, name: 'Bia' },
      { origin: ORIGIN },
    );
    const res = await app.request('/v1/me', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email, displayName: 'Bia' });
  });

  it('allows CORS with credentials only for trusted web origins', async () => {
    const pre = (origin: string) =>
      app.request('/v1/me', {
        method: 'OPTIONS',
        headers: { origin, 'access-control-request-method': 'PATCH' },
      });
    const ok = await pre(ORIGIN);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true');
    const bad = await pre('https://evil.example');
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});
