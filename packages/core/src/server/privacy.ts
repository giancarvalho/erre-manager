// LGPD (Sprint 19): a person's data, exported to them and erased on request. Modules declare their part with
// `data` in defineModuleApi; the core runs it in each community the person ever belonged to.
import { and, communities, eq, ne, withTenantTx, withUserTx, type Db } from '@erre/db';

import type { ModuleData } from './modules/define';
import { authUser, coreProfiles, memberships, notificationPreferences, pushSubscriptions } from './schema';

export type ModuleDataEntry = { module: string; data: ModuleData };

/** Every membership the person has or had (any status), across communities, with the community name. */
async function membershipsOf(db: Db, userId: string) {
  return withUserTx(db, userId, (tx) =>
    tx
      .select({
        communityId: memberships.communityId,
        community: communities.name,
        role: memberships.role,
        status: memberships.status,
        requestedAt: memberships.requestedAt,
        reviewedAt: memberships.reviewedAt,
      })
      .from(memberships)
      .innerJoin(communities, eq(communities.id, memberships.communityId))
      .where(eq(memberships.userId, userId)),
  );
}

/** GET /v1/me/export: everything about the person, readable JSON. */
export async function exportUserData(db: Db, user: { id: string; email: string }, modules: readonly ModuleDataEntry[]) {
  const [profile] = await db.select().from(coreProfiles).where(eq(coreProfiles.userId, user.id));
  const [account] = await db.select({ createdAt: authUser.createdAt }).from(authUser).where(eq(authUser.id, user.id));
  const prefs = await db
    .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id));
  const devices = await db
    .select({ kind: pushSubscriptions.kind, createdAt: pushSubscriptions.createdAt })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));
  const communityData = [];
  for (const m of await membershipsOf(db, user.id)) {
    const byModule = await withTenantTx(db, { communityId: m.communityId }, async (tx) => {
      const out: Record<string, unknown> = {};
      for (const { module, data } of modules) {
        const value = await data.export({ tx, communityId: m.communityId }, user.id);
        if (value !== null && value !== undefined) out[module] = value;
      }
      return out;
    });
    communityData.push({
      community: m.community,
      role: m.role,
      status: m.status,
      requestedAt: m.requestedAt.toISOString(),
      reviewedAt: m.reviewedAt?.toISOString() ?? null,
      modules: byModule,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    account: {
      email: user.email,
      displayName: profile?.displayName ?? null,
      avatarVariant: profile?.avatarVariant ?? null,
      createdAt: account?.createdAt.toISOString() ?? null,
    },
    notificationPreferences: prefs,
    // Device tokens are credentials of the push service, not data about the person: only kind and date.
    pushDevices: devices.map((d) => ({ kind: d.kind, createdAt: d.createdAt.toISOString() })),
    communities: communityData,
    votes:
      'Votos não entram: são anônimos. O servidor guarda só um código derivado do token cego, sem ligação com a pessoa.',
  };
}

export type DeleteResult =
  | { ok: true; communities: number }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'SOLE_OWNER'; communities: string[] };

/**
 * Erases a person (acionado por quem opera o sistema, v1): each module's part in every community, then the
 * account (sessions, Google link, profile, memberships, devices and preferences go with it by cascade). Refused
 * while the person is the only owner of a community that still has other approved members: ownership is
 * passed on first, so no community is left without an owner.
 */
export async function deleteUserData(
  db: Db,
  userId: string,
  modules: readonly ModuleDataEntry[],
): Promise<DeleteResult> {
  const [user] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, userId));
  if (!user) return { ok: false, code: 'NOT_FOUND' };
  const mine = await membershipsOf(db, userId);
  const blocked: string[] = [];
  for (const m of mine.filter((x) => x.role === 'owner' && x.status === 'approved')) {
    const others = await withTenantTx(db, { communityId: m.communityId }, async (tx) => {
      const rows = await tx
        .select({ userId: memberships.userId, role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.status, 'approved'), ne(memberships.userId, userId)));
      return { members: rows.length, owners: rows.filter((r) => r.role === 'owner').length };
    });
    if (others.members > 0 && others.owners === 0) blocked.push(m.community);
  }
  if (blocked.length > 0) return { ok: false, code: 'SOLE_OWNER', communities: blocked };

  for (const m of mine) {
    await withTenantTx(db, { communityId: m.communityId }, async (tx) => {
      for (const { data } of modules) await data.delete({ tx, communityId: m.communityId }, userId);
      await tx.delete(memberships).where(eq(memberships.userId, userId));
    });
  }
  await db.delete(authUser).where(eq(authUser.id, userId));
  return { ok: true, communities: mine.length };
}
