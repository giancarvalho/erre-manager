import { eq } from '@erre/db';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import { SESSION_EXPIRES_IN } from '../src/server/auth/auth';
import { authAccount, authSession, authUser, coreProfiles } from '../src/server/schema';
import { signInWithGoogle } from '../src/server/testing';
import { CLIENT_ID, ORIGIN, setupCore } from './helpers';

const urls = inject('db');
let core: ReturnType<typeof setupCore>;
let n = 0;
const person = (name = 'Ana Souza') => {
  n += 1;
  return { sub: `google-${Date.now()}-${n}`, email: `pessoa${n}.${Date.now()}@example.com`, name };
};

beforeAll(() => {
  core = setupCore(urls.app);
});
afterAll(() => core.close());

const me = (cookie?: string) => core.app.request('/v1/me', { headers: cookie ? { cookie } : {} });
const patchProfile = (cookie: string, body: unknown) =>
  core.app.request('/v1/me/profile', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(body),
  });

describe('Google sign-in', () => {
  it('creates the user, redirects to the callback and opens a session', async () => {
    const p = person();
    const res = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN, callbackURL: `${ORIGIN}/inicio` });
    expect(res.status).toBe(302);
    expect(res.location).toBe(`${ORIGIN}/inicio`);
    expect(res.cookie).toContain('erre.session_token=');

    const r = await me(res.cookie);
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ email: p.email, displayName: 'Ana Souza', nameConfirmed: false });
    expect(typeof body.avatarVariant).toBe('string');
  });

  it('signing in again with the same Google account reuses the user', async () => {
    const p = person();
    const first = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    const second = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    const a = (await (await me(first.cookie)).json()) as { id: string };
    const b = (await (await me(second.cookie)).json()) as { id: string };
    expect(a.id).toBe(b.id);
  });

  it('rejects an ID token issued for another client or already expired', async () => {
    for (const claims of [{ aud: 'other-client' }, { iss: 'https://evil.example' }, { exp: 1 }]) {
      const res = await signInWithGoogle(core.app, core.google, person(), { origin: ORIGIN, claims });
      expect(res.cookie, JSON.stringify(claims)).toBe('');
      expect(res.location ?? '', JSON.stringify(claims)).toContain('error=');
    }
    expect(CLIENT_ID).toBeTruthy();
  });

  it('stores sessions for ~400 days, without IP or user agent', async () => {
    const p = person();
    const res = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    expect(res.cookie).toBeTruthy();
    const [user] = await core.db.select().from(authUser).where(eq(authUser.email, p.email));
    const [session] = await core.db.select().from(authSession).where(eq(authSession.userId, user!.id));
    expect(session).toMatchObject({ ipAddress: null, userAgent: null });
    const days = (session!.expiresAt.getTime() - Date.now()) / 1000 / SESSION_EXPIRES_IN;
    expect(days).toBeGreaterThan(0.99);
    expect(days).toBeLessThanOrEqual(1);
  });
});

describe('sessions', () => {
  it('returns 401 in the standard format without a session', async () => {
    const r = await me();
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: 'UNAUTHENTICATED', message: 'Você precisa entrar para continuar.' });
    expect((await me('erre.session_token=forjado.assinatura')).status).toBe(401);
  });

  it('sign-out ends the session', async () => {
    const { cookie } = await signInWithGoogle(core.app, core.google, person(), { origin: ORIGIN });
    const out = await core.app.request('/v1/auth/sign-out', { method: 'POST', headers: { cookie, origin: ORIGIN } });
    expect(out.status).toBe(200);
    expect((await me(cookie)).status).toBe(401);
  });

  it('revoke-sessions ends every session of the person', async () => {
    const p = person();
    const a = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    const b = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    expect((await me(b.cookie)).status).toBe(200);
    const r = await core.app.request('/v1/auth/revoke-sessions', {
      method: 'POST',
      headers: { cookie: a.cookie, origin: ORIGIN, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(200);
    expect((await me(a.cookie)).status).toBe(401);
    expect((await me(b.cookie)).status).toBe(401);
  });
});

describe('profile', () => {
  it('validates the display name and confirms it', async () => {
    const { cookie } = await signInWithGoogle(core.app, core.google, person(), { origin: ORIGIN });
    const short = await patchProfile(cookie, { displayName: ' a ' });
    expect(short.status).toBe(400);
    expect(await short.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Mínimo 2 caracteres.' });
    expect((await patchProfile(cookie, { displayName: 'x'.repeat(33) })).status).toBe(400);
    expect((await patchProfile(cookie, { displayName: 'Ana', admin: true })).status).toBe(400);

    const ok = await patchProfile(cookie, { displayName: '  Aninha  ' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ displayName: 'Aninha', nameConfirmed: true });
    expect(await (await me(cookie)).json()).toMatchObject({ displayName: 'Aninha', nameConfirmed: true });
  });

  it('changes the avatar color alone, without confirming the name; refuses an unknown color or nothing', async () => {
    const { cookie } = await signInWithGoogle(core.app, core.google, person(), { origin: ORIGIN });
    const ok = await patchProfile(cookie, { avatarVariant: 'teal' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ avatarVariant: 'teal', nameConfirmed: false });
    expect((await patchProfile(cookie, { avatarVariant: 'gold' })).status).toBe(400);
    expect((await patchProfile(cookie, {})).status).toBe(400);
    const both = await patchProfile(cookie, { displayName: 'Bia', avatarVariant: 'rose' });
    expect(await both.json()).toMatchObject({ displayName: 'Bia', avatarVariant: 'rose', nameConfirmed: true });
  });

  it('uses the e-mail when Google has no name', async () => {
    const p = { ...person(''), email: `Jo.Silva+x${Date.now()}@example.com` };
    const { cookie } = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    const body = (await (await me(cookie)).json()) as { displayName: string };
    expect(body.displayName).toMatch(/^josilvax\d+$/);
    expect(body.displayName.length).toBeLessThanOrEqual(20);
  });
});

describe('redirect and origin checks', () => {
  const start = (callbackURL: string, headers: Record<string, string> = {}) =>
    core.app.request('/v1/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: JSON.stringify({ provider: 'google', callbackURL }),
    });

  it('accepts the web origin and the app scheme', async () => {
    expect((await start(`${ORIGIN}/x`)).status).toBe(200);
    expect((await start('erre://inicio', { 'expo-origin': 'erre://' })).status).toBe(200);
  });

  it('rejects untrusted, protocol-relative and look-alike callbacks', async () => {
    for (const cb of [
      'https://evil.example/steal',
      '//evil.example/x',
      'http://localhost:8081.evil.example/',
      'erre-evil://x',
      '/\\evil.example',
    ]) {
      const r = await start(cb);
      expect(r.status, cb).toBe(403);
      expect(await r.json()).toMatchObject({ code: 'INVALID_CALLBACK_URL' });
    }
  });

  it('Better Auth rejects an untrusted origin when cookies are present', async () => {
    const r = await start(`${ORIGIN}/`, { origin: 'https://evil.example', cookie: 'x=1' });
    expect(r.status).toBe(403);
  });
});

describe('logs', () => {
  it('never contain session tokens, codes or e-mails', async () => {
    const p = person();
    const { cookie } = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    await me(cookie);
    const token = cookie.split('=')[1]?.split('.')[0] ?? 'missing';
    const all = core.logs.join('\n');
    expect(all).not.toContain(token);
    expect(all).not.toContain(p.email);
  });
});

// Assumptions of the data plan (D-016, MAPEAMENTO-DADOS.md): the ETL keeps the legacy user ids and writes
// auth_user + core_profiles (+ auth_account when the legacy row has google_id) before anyone signs in.
describe('users created by the data migration', () => {
  async function legacyUser(p: { email: string; name: string }, googleSub?: string) {
    const id = crypto.randomUUID();
    await core.db.insert(authUser).values({ id, name: p.name, email: p.email, emailVerified: true });
    if (googleSub) await core.db.insert(authAccount).values({ userId: id, accountId: googleSub, providerId: 'google' });
    await core.db
      .insert(coreProfiles)
      .values({ userId: id, displayName: 'Nome do legado', avatarVariant: 'emerald', nameConfirmedAt: new Date() });
    return id;
  }

  it('a legacy Google user signs in as the same id, keeping the profile', async () => {
    const p = person();
    const id = await legacyUser(p, p.sub);
    const res = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    expect(await (await me(res.cookie)).json()).toMatchObject({
      id,
      displayName: 'Nome do legado',
      avatarVariant: 'emerald',
      nameConfirmed: true,
    });
  });

  it('a user created with only an e-mail is linked on the first Google sign-in with that e-mail', async () => {
    const p = person();
    const id = await legacyUser(p);
    const res = await signInWithGoogle(core.app, core.google, p, { origin: ORIGIN });
    expect(((await (await me(res.cookie)).json()) as { id: string }).id).toBe(id);
    const accounts = await core.db.select().from(authAccount).where(eq(authAccount.userId, id));
    expect(accounts.map((a) => [a.providerId, a.accountId])).toEqual([['google', p.sub]]);
  });
});
