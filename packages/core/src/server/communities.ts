import { randomUUID } from 'node:crypto';

import { and, communities, count, eq, gt, withTenantTx, withUserTx, type Db, type Tx } from '@erre/db';

import { CORE_PERMISSIONS, type PermissionDef, type Role } from '../shared/community';
import type { CommunityDetails, MyCommunity } from '../shared/types';
import { AppError, errors } from './errors';
import { memberships, rolePermissions } from './schema';

/** Communities a person may create per 24 h (D-022: creation is open, so it needs a limit). */
export const CREATE_LIMIT_PER_DAY = 5;

export async function seedRolePermissions(tx: Tx, communityId: string, permissions: readonly PermissionDef[]) {
  const rows = permissions.flatMap((p) => p.defaultRoles.map((role) => ({ communityId, role, permission: p.id })));
  if (rows.length) await tx.insert(rolePermissions).values(rows).onConflictDoNothing();
}

/**
 * Creates a community with the creator as owner. Only route without a community context: the transaction
 * is opened for the new community's id, so RLS keeps every write inside it.
 */
export async function createCommunity(
  db: Db,
  userId: string,
  name: string,
  permissions: readonly PermissionDef[] = CORE_PERMISSIONS,
): Promise<MyCommunity> {
  const id = randomUUID();
  return withTenantTx(db, { communityId: id, userId }, async (tx) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recent] = await tx
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.role, 'owner'), gt(memberships.requestedAt, since)));
    if ((recent?.n ?? 0) >= CREATE_LIMIT_PER_DAY) {
      throw new AppError(429, 'TOO_MANY_COMMUNITIES', 'Você criou muitas comunidades hoje. Tente de novo amanhã.');
    }
    const inserted = await tx
      .insert(communities)
      .values({ id, slug: name, name })
      .onConflictDoNothing()
      .returning({ id: communities.id });
    if (inserted.length === 0) throw errors.conflict('COMMUNITY_NAME_TAKEN', 'Esse nome já existe. Tente outro.');
    await tx.insert(memberships).values({
      communityId: id,
      userId,
      role: 'owner',
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: userId,
    });
    await seedRolePermissions(tx, id, permissions);
    return { id, slug: name, name, role: 'owner' };
  });
}

/** Approved memberships of a person, across communities (own-rows policy). */
export async function listMyCommunities(db: Db, userId: string): Promise<MyCommunity[]> {
  return withUserTx(db, userId, (tx) =>
    tx
      .select({ id: communities.id, slug: communities.slug, name: communities.name, role: memberships.role })
      .from(memberships)
      .innerJoin(communities, eq(communities.id, memberships.communityId))
      .where(and(eq(memberships.userId, userId), eq(memberships.status, 'approved')))
      .orderBy(communities.name),
  );
}

export async function getCommunityDetails(tx: Tx, communityId: string, role: Role): Promise<CommunityDetails> {
  const [c] = await tx.select().from(communities).where(eq(communities.id, communityId));
  if (!c) throw errors.notFound('Comunidade não encontrada.');
  const perms = await tx
    .select({ p: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role));
  return { id: c.id, slug: c.slug, name: c.name, role, permissions: perms.map((r) => r.p).sort() };
}

/**
 * Changes a member's role. The caller already has core.membros.gerenciar. An admin cannot change an owner;
 * nobody becomes owner here (no ownership transfer in v1), and the owner keeps the role.
 */
export async function changeMemberRole(
  tx: Tx,
  actor: { id: string; role: Role },
  communityId: string,
  targetUserId: string,
  role: Exclude<Role, 'owner'>,
) {
  const [target] = await tx
    .select({ role: memberships.role, status: memberships.status })
    .from(memberships)
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, targetUserId)));
  if (!target || target.status !== 'approved') throw errors.notFound('Membro não encontrado.');
  if (target.role === 'owner') {
    if (actor.role !== 'owner') throw errors.forbidden('Só quem é dono pode mudar o papel do dono.');
    throw errors.rule('OWNER_REQUIRED', 'A comunidade precisa de um dono. Transferir a posse ainda não é possível.');
  }
  await tx
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, targetUserId)));
  return { userId: targetUserId, role };
}
