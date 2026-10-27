// Fixed-window request limits in memory (one API instance; a shared store would be needed with several).
// Keys never include an IP on anonymous routes: those are limited per community (D-010, AGENTS.md rule 9).
import type { Context, MiddlewareHandler } from 'hono';

export type RateLimitRule = { windowMs: number; max: number };

export type RateLimiter = {
  /** Counts one hit for `key`; `retryAfterMs` > 0 when over the limit. */
  hit: (key: string, rule: RateLimitRule, now?: number) => { ok: boolean; retryAfterMs: number };
};

/** Above this many keys, expired windows are dropped on the next hit. */
const PRUNE_AT = 10_000;

export function createRateLimiter(): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key, rule, now = Date.now()) {
      if (windows.size > PRUNE_AT) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + rule.windowMs });
        return { ok: true, retryAfterMs: 0 };
      }
      current.count += 1;
      return current.count <= rule.max
        ? { ok: true, retryAfterMs: 0 }
        : { ok: false, retryAfterMs: current.resetAt - now };
    },
  };
}

/**
 * Middleware: 429 RATE_LIMITED with Retry-After when `keyOf` has gone over `rule`. A null key is not limited.
 */
export function rateLimit<C extends Context>(
  limiter: RateLimiter,
  rule: RateLimitRule,
  keyOf: (c: C) => string | null,
): MiddlewareHandler {
  return async (c, next) => {
    const key = keyOf(c as C);
    if (key !== null) {
      const { ok, retryAfterMs } = limiter.hit(key, rule);
      if (!ok)
        return c.json({ code: 'RATE_LIMITED', message: 'Muitas tentativas. Espere um pouco e tente de novo.' }, 429, {
          'retry-after': String(Math.ceil(retryAfterMs / 1000)),
        });
    }
    await next();
  };
}
