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
