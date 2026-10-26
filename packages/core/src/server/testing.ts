// Test helpers: a fake Google token endpoint and a real sign-in through Better Auth.
// Used by core, apps/api and module tests to get a session without real Google credentials.
import { randomUUID } from 'node:crypto';

import { withTenantTx, type Db } from '@erre/db';
import { getTableConfig, type PgTable } from '@erre/db/pg-core';

import type { Role } from '../shared/community';
import { memberships } from './schema';

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
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
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

// ---------------------------------------------------------------------------------------------------------
// Communities and roles (Sprint 6). Module tests reuse these to build a community with a member per role.

export type TestUser = { id: string; cookie: string; email: string };

let userSeq = 0;

/** Signs in a new person through the fake Google and returns their id and cookie. */
export async function createTestUser(
  app: RequestApp,
  google: FakeGoogle,
  { origin, name = 'Pessoa' }: { origin: string; name?: string },
): Promise<TestUser> {
  userSeq += 1;
  const tag = `${Date.now()}-${userSeq}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `user-${tag}@example.com`;
  const { cookie } = await signInWithGoogle(app, google, { sub: `sub-${tag}`, email, name }, { origin });
  const res = await app.request('/v1/me', { headers: { cookie } });
  const me = (await res.json()) as { id: string };
  return { id: me.id, cookie, email };
}

/** Test-only: puts a membership straight in the database (invites arrive in Sprint 7). */
export async function addMember(
  db: Db,
  communityId: string,
  userId: string,
  role: Role,
  status: 'pending' | 'approved' | 'rejected' | 'removed' = 'approved',
): Promise<void> {
  await withTenantTx(db, { communityId, userId }, (tx) =>
    tx
      .insert(memberships)
      .values({ communityId, userId, role, status })
      .onConflictDoUpdate({ target: [memberships.communityId, memberships.userId], set: { role, status } }),
  );
}

export type RoleFixture = {
  communityId: string;
  users: Record<Role | 'pending' | 'outsider', TestUser>;
};

/** A community created through the API, with one approved member per role, one pending and one outsider. */
export async function createRoleFixture(
  app: RequestApp,
  google: FakeGoogle,
  db: Db,
  { origin, name }: { origin: string; name?: string },
): Promise<RoleFixture> {
  const owner = await createTestUser(app, google, { origin, name: 'Dona' });
  const res = await app.request('/v1/communities', {
    method: 'POST',
    headers: { cookie: owner.cookie, origin, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: name ?? `fixture-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    }),
  });
  if (res.status !== 201) throw new Error(`community not created: ${res.status} ${await res.text()}`);
  const { id: communityId } = (await res.json()) as { id: string };
  const make = async (label: string, role: Role, status: 'pending' | 'approved' = 'approved') => {
    const u = await createTestUser(app, google, { origin, name: label });
    await addMember(db, communityId, u.id, role, status);
    return u;
  };
  return {
    communityId,
    users: {
      owner,
      admin: await make('Admin', 'admin'),
      moderador: await make('Moderadora', 'moderador'),
      membro: await make('Membro', 'membro'),
      pending: await make('Pendente', 'membro', 'pending'),
      outsider: await createTestUser(app, google, { origin, name: 'De Fora' }),
    },
  };
}

/**
 * Permission matrix for one route: every role in `allowed` must get past authorization (status ≠ 403);
 * every other role, the pending member and the outsider must get 403. Returns the statuses by role.
 */
export async function permissionMatrix(
  fixture: RoleFixture,
  allowed: readonly Role[],
  request: (user: TestUser, headers: Record<string, string>) => Response | Promise<Response>,
): Promise<{ statuses: Record<string, number>; problems: string[] }> {
  const statuses: Record<string, number> = {};
  const problems: string[] = [];
  for (const [who, user] of Object.entries(fixture.users)) {
    const res = await request(user, { cookie: user.cookie, 'x-community-id': fixture.communityId });
    statuses[who] = res.status;
    const shouldPass = (allowed as readonly string[]).includes(who);
    if (shouldPass && res.status === 403) problems.push(`${who}: expected access, got 403`);
    if (!shouldPass && res.status !== 403) problems.push(`${who}: expected 403, got ${res.status}`);
  }
  return { statuses, problems };
}

/** Module tables must be prefixed with the module id (AGENTS.md conventions; PLANO Sprint 8, task 7). */
export function tablePrefixProblems(manifest: { id: string }, tables: readonly PgTable[]): string[] {
  return tables
    .map((t) => getTableConfig(t).name)
    .filter((name) => !name.startsWith(`${manifest.id}_`))
    .map((name) => `table "${name}" must start with "${manifest.id}_"`);
}

export {
  createModuleHarness,
  HARNESS_ORIGIN,
  type HarnessLog,
  type HarnessRequest,
  type ModuleHarness,
  type RecordedPush,
} from './testing-harness';
