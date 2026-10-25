// Test helpers: a fake Google token endpoint and a real sign-in through Better Auth.
// Used by core, apps/api and module tests to get a session without real Google credentials.
import { randomUUID } from 'node:crypto';

export type FakeGoogleProfile = { sub: string; email: string; name: string; picture?: string };

const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');

/** Unsigned ID token. Enough for the code flow: claims are checked, the signature is not (TLS response). */
export function fakeIdToken(claims: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', kid: 'fake', typ: 'JWT' })}.${b64(claims)}.c2ln`;
}

export type FakeGoogle = {
  /** Registers who signs in with the next authorization code; returns the code. */
  codeFor: (profile: FakeGoogleProfile, overrides?: Record<string, unknown>) => string;
  restore: () => void;
};

/** Authorization code that carries the profile itself (for browser e2e, where the test can't call codeFor). */
export function encodedCode(profile: FakeGoogleProfile): string {
  return `e2e.${Buffer.from(JSON.stringify(profile)).toString('base64url')}`;
}

/**
 * Replaces global fetch for https://oauth2.googleapis.com/token only. With `acceptEncodedCodes`, codes from
 * `encodedCode()` are accepted too.
 */
export function installFakeGoogle(clientId: string, { acceptEncodedCodes = false } = {}): FakeGoogle {
  const original = globalThis.fetch;
  const codes = new Map<string, Record<string, unknown>>();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('https://oauth2.googleapis.com/token')) return original(input, init);
    const body = new URLSearchParams(String(init?.body ?? ''));
    const code = body.get('code') ?? '';
    let claims = codes.get(code);
    if (!claims && acceptEncodedCodes && code.startsWith('e2e.')) {
      const now = Math.floor(Date.now() / 1000);
      const profile = JSON.parse(Buffer.from(code.slice(4), 'base64url').toString('utf8')) as FakeGoogleProfile;
      claims = {
        iss: 'https://accounts.google.com',
        aud: clientId,
        iat: now,
        exp: now + 3600,
        email_verified: true,
        ...profile,
      };
    }
    if (!claims) return Response.json({ error: 'invalid_grant' }, { status: 400 });
    return Response.json({
      access_token: 'fake-access-token',
      id_token: fakeIdToken(claims),
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile',
    });
  }) as typeof fetch;
  return {
    codeFor(profile, overrides = {}) {
      const code = randomUUID();
      const now = Math.floor(Date.now() / 1000);
      codes.set(code, {
        iss: 'https://accounts.google.com',
        aud: clientId,
        iat: now,
        exp: now + 3600,
        email_verified: true,
        ...profile,
        ...overrides,
      });
      return code;
    },
    restore() {
      globalThis.fetch = original;
    },
  };
}

type RequestApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };

function cookiesFrom(res: Response): string[] {
  return res.headers.getSetCookie().map((c) => c.split(';')[0] ?? '');
}

/**
 * Full Google sign-in against the API (start → Google → callback). Returns the cookie header to use in
 * later requests and where Better Auth redirected.
 */
export async function signInWithGoogle(
  app: RequestApp,
  google: FakeGoogle,
  profile: FakeGoogleProfile,
  {
    origin,
    callbackURL = `${origin}/`,
    claims,
  }: { origin: string; callbackURL?: string; claims?: Record<string, unknown> },
): Promise<{ cookie: string; location: string | null; status: number }> {
  const start = await app.request('/v1/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ provider: 'google', callbackURL }),
  });
  if (start.status !== 200) throw new Error(`sign-in start failed: ${start.status} ${await start.text()}`);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state') ?? '';
  const code = google.codeFor(profile, claims);
  const startCookies = cookiesFrom(start);
  const callback = await app.request(
    `/v1/auth/callback/google?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { headers: { cookie: startCookies.join('; ') } },
  );
  const sessionCookies = cookiesFrom(callback).filter((c) => !c.endsWith('='));
  return { cookie: sessionCookies.join('; '), location: callback.headers.get('location'), status: callback.status };
}
