// Local development seed: two communities and one person per role in each. Never in production.
// Usage: DATABASE_URL=postgres://erre_app:erre_app@localhost:5432/erre pnpm --filter @erre/core seed:dev
// People get a Google account id `dev-<role>-<n>` so a fake Google (apps/api/e2e/server.ts) can sign them in.
import { closeDb, communities, createDb, eq, withTenantTx } from '@erre/db';

import { seedRolePermissions } from '../src/server/communities';
import { authAccount, authUser, coreProfiles, memberships } from '../src/server/schema';
import { deriveAvatarVariantFromSeed } from '../src/shared/avatar';
import { CORE_PERMISSIONS, type Role } from '../src/shared/community';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)) {
  throw new Error('seed-dev only runs against a local database');
}

const db = createDb(url);
const roles: Role[] = ['owner', 'admin', 'moderador', 'membro'];

async function person(key: string, name: string): Promise<string> {
  const email = `${key}@example.com`;
  const [existing] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email));
  if (existing) return existing.id;
  const [u] = await db.insert(authUser).values({ name, email, emailVerified: true }).returning({ id: authUser.id });
  const id = u!.id;
  await db.insert(authAccount).values({ userId: id, accountId: key, providerId: 'google' });
  await db.insert(coreProfiles).values({
    userId: id,
    displayName: name,
    avatarVariant: deriveAvatarVariantFromSeed(id),
    nameConfirmedAt: new Date(),
  });
  return id;
}

for (const [n, slug] of ['comunidade-um', 'comunidade-dois'].entries()) {
  const people = await Promise.all(roles.map((role) => person(`dev-${role}-${n + 1}`, `${role} ${n + 1}`)));
  const [existing] = await db.select({ id: communities.id }).from(communities).where(eq(communities.slug, slug));
  const communityId = existing?.id ?? crypto.randomUUID();
  await withTenantTx(db, { communityId, userId: people[0]! }, async (tx) => {
    if (!existing) await tx.insert(communities).values({ id: communityId, slug, name: slug });
    for (const [i, role] of roles.entries()) {
      await tx
        .insert(memberships)
        .values({ communityId, userId: people[i]!, role, status: 'approved', reviewedAt: new Date() })
        .onConflictDoNothing();
    }
    await seedRolePermissions(tx, communityId, CORE_PERMISSIONS);
  });
  console.warn(`${slug}: ${roles.map((r) => `${r}=dev-${r}-${n + 1}`).join(', ')}`);
}
await closeDb(db);
