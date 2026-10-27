import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createRateLimiter, rateLimit } from '../src/server/rate-limit';

describe('rate limiter', () => {
  it('lets `max` hits through per window and key, then says how long to wait', () => {
    const limiter = createRateLimiter();
    const rule = { windowMs: 1000, max: 2 };
    expect(limiter.hit('a', rule, 0).ok).toBe(true);
    expect(limiter.hit('a', rule, 100).ok).toBe(true);
    expect(limiter.hit('a', rule, 200)).toEqual({ ok: false, retryAfterMs: 800 });
    expect(limiter.hit('b', rule, 200).ok).toBe(true); // keys are independent
    expect(limiter.hit('a', rule, 1000).ok).toBe(true); // a new window
  });

  it('middleware answers 429 RATE_LIMITED with Retry-After; a null key is never limited', async () => {
    const app = new Hono()
      .use(
        '/limited',
        rateLimit(createRateLimiter(), { windowMs: 60_000, max: 1 }, () => 'k'),
      )
      .use(
        '/free',
        rateLimit(createRateLimiter(), { windowMs: 60_000, max: 1 }, () => null),
      )
      .get('/limited', (c) => c.text('ok'))
      .get('/free', (c) => c.text('ok'));
    expect((await app.request('/limited')).status).toBe(200);
    const limited = await app.request('/limited');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(await limited.json()).toEqual({
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas. Espere um pouco e tente de novo.',
    });
    expect((await app.request('/free')).status).toBe(200);
    expect((await app.request('/free')).status).toBe(200);
  });
});
