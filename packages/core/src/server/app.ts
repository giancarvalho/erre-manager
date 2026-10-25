import type { Db } from '@erre/db';
import { Hono } from 'hono';
import { z } from 'zod';

import { ASSIGNABLE_ROLES, CommunityNameSchema } from '../shared/community';
import type { Auth } from './auth/auth';
import { callbackGuard } from './auth/redirect';
import { changeMemberRole, createCommunity, getCommunityDetails, listMyCommunities } from './communities';
import { requireCommunity, requirePermission } from './context';
import { errors } from './errors';
import { getOrCreateProfile, ProfilePatchSchema, updateProfile } from './profiles';
import { requireSession } from './session';
import { validate } from './validate';

export type CoreApiDeps = { db: Db; auth: Auth; trustedOrigins: string[] };

const CreateCommunitySchema = z.object({ name: CommunityNameSchema }).strict();
const CommunityParams = z.object({ id: z.uuid() });
const MemberParams = z.object({ id: z.uuid(), userId: z.uuid() });
const RolePatchSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) }).strict();

/** Core routes, mounted by apps/api under /v1. */
export function createCoreApi({ db, auth, trustedOrigins }: CoreApiDeps) {
  const session = requireSession(auth);
  const community = requireCommunity(db);

  // The :id in the path must be the community of the context (X-Community-Id).
  const sameCommunity = (id: string, contextId: string) => {
    if (id !== contextId) throw errors.forbidden('Você não tem acesso a esta comunidade.');
  };

  const me = new Hono()
    .get('/', session, async (c) => c.json(await getOrCreateProfile(db, c.var.user)))
    .patch('/profile', session, validate('json', ProfilePatchSchema), async (c) =>
      c.json(await updateProfile(db, c.var.user, c.req.valid('json'))),
    )
    .get('/communities', session, async (c) => c.json(await listMyCommunities(db, c.var.user.id)));

  const communities = new Hono()
    // Only authenticated route without a community context (D-022).
    .post('/', session, validate('json', CreateCommunitySchema), async (c) =>
      c.json(await createCommunity(db, c.var.user.id, c.req.valid('json').name), 201),
    )
    .get('/:id', session, community, validate('param', CommunityParams), async (c) => {
      sameCommunity(c.req.valid('param').id, c.var.community.id);
      return c.json(await getCommunityDetails(c.var.tx, c.var.community.id, c.var.community.role));
    })
    .patch(
      '/:id/members/:userId',
      session,
      community,
      validate('param', MemberParams),
      validate('json', RolePatchSchema),
      async (c) => {
        const { id, userId } = c.req.valid('param');
        sameCommunity(id, c.var.community.id);
        await requirePermission(c, 'core.membros.gerenciar');
        const actor = { id: c.var.user.id, role: c.var.community.role };
        return c.json(await changeMemberRole(c.var.tx, actor, id, userId, c.req.valid('json').role));
      },
    );

  return new Hono()
    .use('/auth/*', callbackGuard(trustedOrigins))
    .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
    .route('/me', me)
    .route('/communities', communities);
}

export type CoreApi = ReturnType<typeof createCoreApi>;
