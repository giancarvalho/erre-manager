import type { MiddlewareHandler } from 'hono';

/**
 * Better Auth validates callbackURL only when the request carries cookies (its CSRF path); a first
 * sign-in has none. So every redirect target is checked here before reaching Better Auth (D-031).
 */
export function isTrustedRedirect(target: unknown, trustedOrigins: readonly string[]): boolean {
  if (target === undefined || target === null || target === '') return true; // Better Auth's default
  if (typeof target !== 'string') return false;
  if (target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) return true;
  return trustedOrigins.some((o) => target === o || target.startsWith(o.endsWith('/') ? o : `${o}/`));
}

const REDIRECT_KEYS = ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL'] as const;

export function callbackGuard(trustedOrigins: readonly string[]): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === 'POST' && c.req.header('content-type')?.includes('application/json')) {
      const body = (await c.req.raw
        .clone()
        .json()
        .catch(() => ({}))) as Record<string, unknown>;
      for (const key of REDIRECT_KEYS) {
        if (!isTrustedRedirect(body[key], trustedOrigins)) {
          return c.json({ code: 'INVALID_CALLBACK_URL', message: 'Endereço de retorno não permitido.' }, 403);
        }
      }
    }
    for (const key of REDIRECT_KEYS) {
      if (!isTrustedRedirect(c.req.query(key), trustedOrigins)) {
        return c.json({ code: 'INVALID_CALLBACK_URL', message: 'Endereço de retorno não permitido.' }, 403);
      }
    }
    await next();
  };
}
