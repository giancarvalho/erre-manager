import type { Db } from '@erre/db';
import { Hono } from 'hono';

import type { Auth } from './auth/auth';
import { callbackGuard } from './auth/redirect';
import { jsonBody } from './http';
import { getOrCreateProfile, ProfilePatchSchema, updateProfile } from './profiles';
import { requireSession, type SessionEnv } from './session';

export type CoreApiDeps = { db: Db; auth: Auth; trustedOrigins: string[] };

/** Core routes, mounted by apps/api under /v1. */
export function createCoreApi({ db, auth, trustedOrigins }: CoreApiDeps) {
  const me = new Hono<SessionEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => c.json(await getOrCreateProfile(db, c.var.user)))
    .patch('/profile', async (c) => c.json(await updateProfile(db, c.var.user, await jsonBody(c, ProfilePatchSchema))));

  return new Hono()
    .use('/auth/*', callbackGuard(trustedOrigins))
    .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
    .route('/me', me);
}

export type CoreApi = ReturnType<typeof createCoreApi>;
