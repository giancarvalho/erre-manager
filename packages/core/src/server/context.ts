import { and, eq, isUuid, withTenantTx, type Db, type Tx } from '@erre/db';
import { createMiddleware } from 'hono/factory';

import type { Role } from '../shared/community';
import { errors } from './errors';
import { memberships, rolePermissions } from './schema';
import type { SessionUser } from './session';

export type CommunityContext = { id: string; role: Role };

export type CommunityEnv = {
  Variables: {
    user: SessionUser;
    community: CommunityContext;
    /** Drizzle transaction with RLS scoped to the community. Commits when the route succeeds. */
    tx: Tx;
    can: (permission: string) => Promise<boolean>;
    /** Runs `fn` after the transaction commits (never on rollback). For side effects like notifications. */
    afterCommit: (fn: () => void) => void;
  };
};

export const COMMUNITY_HEADER = 'x-community-id';

class Rollback extends Error {}

const forbidden = () => errors.forbidden('Você não tem acesso a esta comunidade.');

/**
 * Request context (ARQUITETURA §4.4). Runs after requireSession. Reads X-Community-Id, opens the tenant
 * transaction and, before anything else in it, checks the person's own membership: only `approved`
 * opens the context. The transaction rolls back when the route throws or answers with an error status.
 */
export function requireCommunity(db: Db) {
  return createMiddleware<CommunityEnv>(async (c, next) => {
    const communityId = c.req.header(COMMUNITY_HEADER) ?? '';
    if (!isUuid(communityId)) throw forbidden();
    const user = c.var.user;
    const committed: (() => void)[] = [];
    c.set('afterCommit', (fn) => committed.push(fn));
    try {
      await withTenantTx(db, { communityId, userId: user.id }, async (tx) => {
        const [m] = await tx
          .select({ role: memberships.role })
          .from(memberships)
          .where(
            and(
              eq(memberships.communityId, communityId),
              eq(memberships.userId, user.id),
              eq(memberships.status, 'approved'),
            ),
          );
        if (!m) throw forbidden();
        const granted = new Map<string, boolean>();
        c.set('community', { id: communityId, role: m.role });
        c.set('tx', tx);
        c.set('can', async (permission) => {
          const hit = granted.get(permission);
          if (hit !== undefined) return hit;
          const rows = await tx
            .select({ p: rolePermissions.permission })
            .from(rolePermissions)
            .where(and(eq(rolePermissions.role, m.role), eq(rolePermissions.permission, permission)));
          granted.set(permission, rows.length > 0);
          return rows.length > 0;
        });
        await next();
        if (c.error || c.res.status >= 400) throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
      return;
    }
    for (const fn of committed) fn();
  });
}

/** Throws 403 unless the person's role has the permission. */
export async function requirePermission(c: { var: { can: (p: string) => Promise<boolean> } }, permission: string) {
  if (!(await c.var.can(permission))) throw errors.forbidden();
}
