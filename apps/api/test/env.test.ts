import { describe, expect, it } from 'vitest';

import { parseEnv } from '../src/env';

const valid = {
  DATABASE_URL: 'postgres://erre_app:pw@localhost:5432/erre',
  PUBLIC_API_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 's'.repeat(32),
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret-value',
  TRUSTED_ORIGINS: 'http://localhost:8081, erre://',
  DATABASE_JOBS_URL: 'postgres://erre_jobs:pw@localhost:5432/erre',
};

describe('env', () => {
  it('parses and splits trusted origins', () => {
    expect(parseEnv(valid)).toMatchObject({ PORT: 3000, TRUSTED_ORIGINS: ['http://localhost:8081', 'erre://'] });
  });

  it('names invalid variables without printing their values', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'short-secret-value' })).toThrow(
      /^Invalid environment: BETTER_AUTH_SECRET$/,
    );
    expect(() => parseEnv({ ...valid, GOOGLE_CLIENT_SECRET: undefined, TRUSTED_ORIGINS: '' })).toThrow(
      /GOOGLE_CLIENT_SECRET, TRUSTED_ORIGINS/,
    );
  });
});
