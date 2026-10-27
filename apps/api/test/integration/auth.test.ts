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

describe('session cookie in production (HTTPS)', () => {
  it('is HttpOnly, Secure and SameSite=Lax, with the __Secure- prefix', async () => {
    const httpsAuth = createAuth({
      db,
      baseURL: 'https://api.example.com',
      secret: 'x'.repeat(40),
      google: { clientId: 'cid', clientSecret: 'cs' },
      trustedOrigins: ['https://app.example.com'],
      rateLimit: { enabled: false },
    });
    const httpsApp = createApp({
      logger: createLogger({ level: 'silent' }),
      core: createCoreApi({ db, auth: httpsAuth, trustedOrigins: ['https://app.example.com'] }),
      webOrigins: ['https://app.example.com'],
    });
    const start = await httpsApp.request('https://api.example.com/v1/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.example.com' },
      body: JSON.stringify({ provider: 'google', callbackURL: 'https://app.example.com/' }),
    });
    const state = new URL(((await start.json()) as { url: string }).url).searchParams.get('state') ?? '';
    const startCookies = start.headers.getSetCookie().map((c) => c.split(';')[0]!);
    const code = google.codeFor({ sub: `https-${Date.now()}`, email: `https-${Date.now()}@example.com`, name: 'Cia' });
    const callback = await httpsApp.request(
      `https://api.example.com/v1/auth/callback/google?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      { headers: { cookie: startCookies.join('; ') } },
    );
    const session = callback.headers
      .getSetCookie()
      .find((c) => c.includes('session_token=') && !c.includes('session_token=;'));
    expect(session, callback.headers.getSetCookie().join('\n')).toBeDefined();
    expect(session).toMatch(/^__Secure-erre\.session_token=/);
    expect(session).toMatch(/; HttpOnly/i);
    expect(session).toMatch(/; Secure/i);
    expect(session).toMatch(/; SameSite=Lax/i);
  });
});
