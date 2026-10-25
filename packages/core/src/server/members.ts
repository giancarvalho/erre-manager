import { and, communities, count, eq, withUserTx, type Db, type Tx } from '@erre/db';

import { isAvatarVariant, deriveAvatarVariantFromSeed, type AvatarVariant } from '../shared/avatar';
import type { Role } from '../shared/community';
import type { JoinRequest, Member } from '../shared/types';
import { AppError, errors } from './errors';
import type { MembershipHooks } from './hooks';
import { coreProfiles, memberships } from './schema';

/** Approved members per community (D-027, legacy R-MEM-03). Pending requests have no limit. */
export const MAX_MEMBERS = 300;

export type { JoinRequest, Member } from '../shared/types';

const variant = (userId: string, v: string): AvatarVariant =>
  isAvatarVariant(v) ? v : deriveAvatarVariantFromSeed(userId);

/**
 * Public members API for modules (ctx.members, ARQUITETURA §5.1). Reads only approved members of the
 * transaction's community; modules never read core tables themselves.
 */
export function createMembersApi(tx: Tx, communityId: string) {
  const base = () =>
    tx
      .select({
        userId: memberships.userId,
        role: memberships.role,
        displayName: coreProfiles.displayName,
        avatarVariant: coreProfiles.avatarVariant,
      })
      .from(memberships)
      .innerJoin(coreProfiles, eq(coreProfiles.userId, memberships.userId));
  const toMember = (r: { userId: string; role: Role; displayName: string; avatarVariant: string }): Member => ({
    userId: r.userId,
    role: r.role,
    displayName: r.displayName,
    avatarVariant: variant(r.userId, r.avatarVariant),
  });
  return {
    async list(): Promise<Member[]> {
      const rows = await base()
        .where(and(eq(memberships.communityId, communityId), eq(memberships.status, 'approved')))
        .orderBy(coreProfiles.displayName);
      return rows.map(toMember);
    },
    async get(userId: string): Promise<Member | null> {
      const [r] = await base().where(
        and(
          eq(memberships.communityId, communityId),
          eq(memberships.userId, userId),
          eq(memberships.status, 'approved'),
        ),
      );
      return r ? toMember(r) : null;
    },
    async isApprovedMember(userId: string): Promise<boolean> {
      const [r] = await tx
        .select({ s: memberships.status })
        .from(memberships)
        .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, userId)));
      return r?.s === 'approved';
    },
  };
}

export type MembersApi = ReturnType<typeof createMembersApi>;

export async function listRequests(tx: Tx, communityId: string): Promise<JoinRequest[]> {
  const rows = await tx
    .select({
      userId: memberships.userId,
      displayName: coreProfiles.displayName,
      avatarVariant: coreProfiles.avatarVariant,
      requestedAt: memberships.requestedAt,
      intent: memberships.joinIntent,
    })
    .from(memberships)
    .innerJoin(coreProfiles, eq(coreProfiles.userId, memberships.userId))
    .where(and(eq(memberships.communityId, communityId), eq(memberships.status, 'pending')))
    .orderBy(memberships.requestedAt);
  return rows.map((r) => ({
    ...r,
    avatarVariant: variant(r.userId, r.avatarVariant),
    requestedAt: r.requestedAt.toISOString(),
  }));
}

async function current(tx: Tx, communityId: string, userId: string) {
  const [m] = await tx
    .select()
    .from(memberships)
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, userId)));
  return m ?? null;
}

const invalid = () => errors.conflict('INVALID_TRANSITION', 'Essa ação não vale para a situação atual dessa pessoa.');

/** pending → approved, then the module of the request's intent (savepoint, failure isolated). */
export async function approveRequest(
  tx: Tx,
  hooks: MembershipHooks,
  communityId: string,
  userId: string,
  actorId: string,
  log: (msg: string, err: unknown) => void = () => undefined,
) {
  const m = await current(tx, communityId, userId);
  if (!m) throw errors.notFound('Pedido não encontrado.');
  if (m.status !== 'pending') throw invalid();
  const [approved] = await tx
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.communityId, communityId), eq(memberships.status, 'approved')));
  if ((approved?.n ?? 0) >= MAX_MEMBERS) {
    throw errors.rule('COMMUNITY_FULL', `A comunidade já tem ${MAX_MEMBERS} membros. O pedido continua na fila.`);
  }
  await tx
    .update(memberships)
    .set({ status: 'approved', reviewedAt: new Date(), reviewedBy: actorId })
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, userId)));
  const intent = m.joinIntent ? hooks.intents.find((i) => i.id === m.joinIntent) : undefined;
  if (intent) {
    try {
      await tx.transaction((sp) => intent.onApproved({ tx: sp, communityId, userId, actorId }));
    } catch (err) {
      log(`join intent ${intent.id} failed`, err);
    }
  }
  return { userId, status: 'approved' as const };
}

async function leave(
  tx: Tx,
  hooks: MembershipHooks,
  communityId: string,
  userId: string,
  actorId: string,
  status: 'rejected' | 'removed',
) {
  await tx
    .update(memberships)
    .set({ status, reviewedAt: new Date(), reviewedBy: actorId, joinIntent: null })
    .where(and(eq(memberships.communityId, communityId), eq(memberships.userId, userId)));
  for (const hook of hooks.onMemberLeft) await hook({ tx, communityId, userId, actorId });
  return { userId, status };
}

/** pending → rejected */
export async function rejectRequest(
  tx: Tx,
  hooks: MembershipHooks,
  communityId: string,
  userId: string,
  actorId: string,
) {
  const m = await current(tx, communityId, userId);
  if (!m) throw errors.notFound('Pedido não encontrado.');
  if (m.status !== 'pending') throw invalid();
  return leave(tx, hooks, communityId, userId, actorId, 'rejected');
}

/** approved → removed, by a manager. The owner can't be removed. */
export async function removeMember(
  tx: Tx,
  hooks: MembershipHooks,
  communityId: string,
  userId: string,
  actorId: string,
) {
  const m = await current(tx, communityId, userId);
  if (!m) throw errors.notFound('Membro não encontrado.');
  if (m.status !== 'approved') throw invalid();
  if (m.role === 'owner') throw errors.rule('OWNER_CANNOT_LEAVE', 'Quem é dono da comunidade não pode ser removido.');
  return leave(tx, hooks, communityId, userId, actorId, 'removed');
}

/** approved → removed, by the person. Legacy R-MEM-06: the creator (owner) can't leave. */
export async function leaveCommunity(tx: Tx, hooks: MembershipHooks, communityId: string, userId: string, role: Role) {
  if (role === 'owner') throw new AppError(422, 'OWNER_CANNOT_LEAVE', 'Quem criou a comunidade não pode sair dela.');
  return leave(tx, hooks, communityId, userId, userId, 'removed');
}

/** Pending requests of a person, with the community name (home: "aguardando aprovação"). */
export async function listMyRequests(db: Db, userId: string) {
  return withUserTx(db, userId, (tx) =>
    tx
      .select({ id: communities.id, name: communities.name, requestedAt: memberships.requestedAt })
      .from(memberships)
      .innerJoin(communities, eq(communities.id, memberships.communityId))
      .where(and(eq(memberships.userId, userId), eq(memberships.status, 'pending')))
      .orderBy(communities.name),
  );
}
