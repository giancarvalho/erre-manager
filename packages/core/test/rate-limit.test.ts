import { afterAll, beforeAll, expect, it, inject } from 'vitest';

import { ORIGIN, setupCore } from './helpers';

const urls = inject('db');
let core: ReturnType<typeof setupCore>;

beforeAll(() => {
  core = setupCore(urls.app, { rateLimit: { enabled: true, window: 60, max: 3 } });
});
afterAll(() => core.close());

it('limits requests to the auth routes', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await core.app.request('/v1/auth/get-session', {
      headers: { origin: ORIGIN, 'x-forwarded-for': '10.0.0.1' },
    });
    statuses.push(r.status);
  }
  expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
  expect(statuses.at(-1)).toBe(429);
});
