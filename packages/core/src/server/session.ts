import { createMiddleware } from 'hono/factory';

import type { Auth } from './auth/auth';
import { errors } from './errors';

export type SessionUser = { id: string; email: string; name: string };
export type SessionEnv = { Variables: { user: SessionUser } };

/** 401 without a valid session; otherwise `c.var.user`. Revoked or expired sessions are rejected. */
export function requireSession(auth: Auth) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!result) throw errors.unauthenticated();
    c.set('user', { id: result.user.id, email: result.user.email, name: result.user.name });
    await next();
  });
}

export type OptionalSessionEnv = { Variables: { user: SessionUser | null } };

/** Like requireSession, but lets the request through without a session (`c.var.user` is null). */
export function optionalSession(auth: Auth) {
  return createMiddleware<OptionalSessionEnv>(async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('user', result ? { id: result.user.id, email: result.user.email, name: result.user.name } : null);
    await next();
  });
}
