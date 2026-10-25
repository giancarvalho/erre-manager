import { describe, expect, it } from 'vitest';

import { isTrustedRedirect } from '../src/server/auth/redirect';
import { AVATAR_VARIANTS, deriveAvatarVariantFromSeed } from '../src/shared/avatar';
import { DisplayNameSchema, initialDisplayName } from '../src/shared/display-name';
import { safeAppPath } from '../src/shared/redirect';

describe('display name', () => {
  it('trims and enforces 2..32 characters', () => {
    expect(DisplayNameSchema.parse('  Ana  ')).toBe('Ana');
    expect(DisplayNameSchema.safeParse('A').success).toBe(false);
    expect(DisplayNameSchema.safeParse('x'.repeat(33)).success).toBe(false);
  });

  it('initial name comes from Google, then from the e-mail', () => {
    expect(initialDisplayName('  Ana Souza ', 'a@b.c')).toBe('Ana Souza');
    expect(initialDisplayName('', 'Jo.Silva+tag@x.com')).toBe('josilvatag');
    expect(initialDisplayName(null, '..@x.com')).toBe('user');
    expect(initialDisplayName('x'.repeat(40), 'a@b.c')).toHaveLength(32);
  });
});

describe('avatar variant', () => {
  // Portado de queridometro@7c5c5bf:src/lib/avatar/variants.test.ts
  it('is stable for the same seed', () => {
    expect(deriveAvatarVariantFromSeed('user-1')).toBe(deriveAvatarVariantFromSeed('user-1'));
  });
  it('returns a known variant key', () => {
    expect(AVATAR_VARIANTS).toContain(deriveAvatarVariantFromSeed('550e8400-e29b-41d4-a716-446655440000'));
  });
});

describe('redirects', () => {
  it('app paths stay internal', () => {
    expect(safeAppPath('/c/abc?x=1')).toBe('/c/abc?x=1');
    for (const bad of [
      null,
      undefined,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil',
      'javascript:alert(1)',
    ]) {
      expect(safeAppPath(bad), String(bad)).toBe('/');
    }
  });

  it('auth callbacks only go to trusted origins', () => {
    const trusted = ['https://app.example', 'erre://'];
    expect(isTrustedRedirect('https://app.example/x', trusted)).toBe(true);
    expect(isTrustedRedirect('erre://inicio', trusted)).toBe(true);
    expect(isTrustedRedirect('/x', trusted)).toBe(true);
    expect(isTrustedRedirect('https://app.example.evil.com/', trusted)).toBe(false);
    expect(isTrustedRedirect(42, trusted)).toBe(false);
  });
});

describe('error logging', () => {
  it('drops query parameters and keeps the Postgres code', async () => {
    const { safeError } = await import('../src/server/http');
    const err = Object.assign(new Error('Failed query: insert into "x" values ($1)\nparams: ana@example.com,tok123'), {
      name: 'DrizzleQueryError',
      cause: { code: '23505' },
    });
    const safe = safeError(err);
    expect(safe).toMatchObject({ name: 'DrizzleQueryError', code: '23505' });
    expect(JSON.stringify(safe)).not.toContain('ana@example.com');
    expect(JSON.stringify(safe)).not.toContain('tok123');
  });
});
