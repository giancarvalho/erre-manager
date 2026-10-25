import { describe, expect, it } from 'vitest';
import { app } from '../src/auth';

async function startGoogle(origin: string, callbackURL: string, extraHeaders: Record<string, string> = {}) {
  const res = await app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...extraHeaders },
    body: JSON.stringify({ provider: 'google', callbackURL }),
  });
  return { res, body: (await res.json()) as { url?: string; redirect?: boolean; message?: string } };
}

describe('Better Auth + Google (sem credenciais reais)', () => {
  it('web: start of sign-in redirects to Google with PKCE, state and the right callback', async () => {
    const { res, body } = await startGoogle('http://localhost:8081', 'http://localhost:8081/');
    expect(res.status).toBe(200);
    const url = new URL(body.url!);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('fake-client-id.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/google');
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('native: an app deep link is accepted as callback (expo plugin, trusted scheme)', async () => {
    const { res, body } = await startGoogle('erreprototipo://', 'erreprototipo://home', { 'expo-origin': 'erreprototipo://' });
    expect(res.status).toBe(200);
    expect(body.url).toContain('accounts.google.com');
  });

  it('rejects an untrusted callback even without cookies (our guard)', async () => {
    const { res, body } = await startGoogle('http://localhost:8081', 'https://evil.example/steal');
    expect(res.status).toBe(403);
    expect(body).toMatchObject({ code: 'INVALID_CALLBACK_URL' });
  });

  it('rejects protocol-relative and look-alike callbacks', async () => {
    for (const cb of ['//evil.example/x', 'http://localhost:8081.evil.example/', 'erreprototipo-evil://x']) {
      const { res } = await startGoogle('http://localhost:8081', cb);
      expect(res.status, cb).toBe(403);
    }
  });

  it('Better Auth itself rejects an untrusted origin when cookies are present', async () => {
    const { res } = await startGoogle('https://evil.example', '/', { cookie: 'x=1' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated session read returns no session', async () => {
    const res = await app.request('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
