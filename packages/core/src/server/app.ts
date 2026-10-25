import type { Db } from '@erre/db';
import { Hono } from 'hono';
import { z } from 'zod';

import { ASSIGNABLE_ROLES, CommunityNameSchema } from '../shared/community';
import type { Auth } from './auth/auth';
import { callbackGuard } from './auth/redirect';
import { changeMemberRole, createCommunity, getCommunityDetails, listMyCommunities } from './communities';
import { requireCommunity, requirePermission } from './context';
import { errors } from './errors';
import { NO_HOOKS, type MembershipHooks } from './hooks';
import { createInvite, joinByInvite, listInvites, previewInvite, revokeInvite } from './invites';
import {
  approveRequest,
  createMembersApi,
  leaveCommunity,
  listMyRequests,
  listRequests,
  rejectRequest,
  removeMember,
} from './members';
import { getOrCreateProfile, ProfilePatchSchema, updateProfile } from './profiles';
import { optionalSession, requireSession } from './session';
import { validate } from './validate';

export type CoreApiDeps = {
  db: Db;
  auth: Auth;
  trustedOrigins: string[];
  /** Join intents and member hooks declared by modules (Sprint 8 fills them from the manifests). */
  hooks?: MembershipHooks;
  log?: (message: string, err: unknown) => void;
};

const CreateCommunitySchema = z.object({ name: CommunityNameSchema }).strict();
const CommunityParams = z.object({ id: z.uuid() });
const MemberParams = z.object({ id: z.uuid(), userId: z.uuid() });
const RolePatchSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) }).strict();
const InviteParams = z.object({ id: z.uuid(), inviteId: z.uuid() });
const CreateInviteSchema = z.object({ intent: z.string().min(1).max(100).nullable().optional() }).strict();
const CodeParams = z.object({ code: z.string().min(1).max(64) });

/** Core routes, mounted by apps/api under /v1. */
export function createCoreApi({ db, auth, trustedOrigins, hooks = NO_HOOKS, log }: CoreApiDeps) {
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
    .get('/communities', session, async (c) => c.json(await listMyCommunities(db, c.var.user.id)))
    .get('/requests', session, async (c) => {
      const rows = await listMyRequests(db, c.var.user.id);
      return c.json(rows.map((r) => ({ ...r, requestedAt: r.requestedAt.toISOString() })));
    });

  const invitesApi = new Hono()
    .get('/:code', optionalSession(auth), validate('param', CodeParams), async (c) =>
      c.json(await previewInvite(db, hooks, c.req.valid('param').code, c.var.user?.id ?? null)),
    )
    .post('/:code/join', session, validate('param', CodeParams), async (c) =>
      c.json(await joinByInvite(db, c.req.valid('param').code, c.var.user.id)),
    );

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
    )
    .get('/:id/members', session, community, validate('param', CommunityParams), async (c) => {
      sameCommunity(c.req.valid('param').id, c.var.community.id);
      return c.json(await createMembersApi(c.var.tx, c.var.community.id).list());
    })
    .post('/:id/leave', session, community, validate('param', CommunityParams), async (c) => {
      sameCommunity(c.req.valid('param').id, c.var.community.id);
      return c.json(await leaveCommunity(c.var.tx, hooks, c.var.community.id, c.var.user.id, c.var.community.role));
    })
    .get('/:id/requests', session, community, validate('param', CommunityParams), async (c) => {
      sameCommunity(c.req.valid('param').id, c.var.community.id);
      await requirePermission(c, 'core.membros.gerenciar');
      return c.json(await listRequests(c.var.tx, c.var.community.id));
    })
    .post('/:id/requests/:userId/approve', session, community, validate('param', MemberParams), async (c) => {
      const { id, userId } = c.req.valid('param');
      sameCommunity(id, c.var.community.id);
      await requirePermission(c, 'core.membros.gerenciar');
      return c.json(await approveRequest(c.var.tx, hooks, id, userId, c.var.user.id, log));
    })
    .post('/:id/requests/:userId/reject', session, community, validate('param', MemberParams), async (c) => {
      const { id, userId } = c.req.valid('param');
      sameCommunity(id, c.var.community.id);
      await requirePermission(c, 'core.membros.gerenciar');
      return c.json(await rejectRequest(c.var.tx, hooks, id, userId, c.var.user.id));
    })
    .post('/:id/members/:userId/remove', session, community, validate('param', MemberParams), async (c) => {
      const { id, userId } = c.req.valid('param');
      sameCommunity(id, c.var.community.id);
      await requirePermission(c, 'core.membros.gerenciar');
      return c.json(await removeMember(c.var.tx, hooks, id, userId, c.var.user.id));
    })
    .get('/:id/invites', session, community, validate('param', CommunityParams), async (c) => {
      sameCommunity(c.req.valid('param').id, c.var.community.id);
      await requirePermission(c, 'core.convites.gerenciar');
      return c.json(await listInvites(c.var.tx, c.var.community.id));
    })
    .post(
      '/:id/invites',
      session,
      community,
      validate('param', CommunityParams),
      validate('json', CreateInviteSchema),
      async (c) => {
        sameCommunity(c.req.valid('param').id, c.var.community.id);
        await requirePermission(c, 'core.convites.gerenciar');
        const intent = c.req.valid('json').intent ?? null;
        return c.json(await createInvite(c.var.tx, hooks, c.var.community.id, c.var.user.id, intent), 201);
      },
    )
    .post('/:id/invites/:inviteId/revoke', session, community, validate('param', InviteParams), async (c) => {
      const { id, inviteId } = c.req.valid('param');
      sameCommunity(id, c.var.community.id);
      await requirePermission(c, 'core.convites.gerenciar');
      await revokeInvite(c.var.tx, id, inviteId);
      return c.json({ ok: true });
    });

  return new Hono()
    .use('/auth/*', callbackGuard(trustedOrigins))
    .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
    .route('/me', me)
    .route('/communities', communities)
    .route('/invites', invitesApi);
}

export type CoreApi = ReturnType<typeof createCoreApi>;
