import { eq, type Db } from '@erre/db';
import { z } from 'zod';

import { deriveAvatarVariantFromSeed, isAvatarVariant } from '../shared/avatar';
import { DisplayNameSchema, initialDisplayName } from '../shared/display-name';
import type { Me } from '../shared/types';
import { coreProfiles } from './schema';
import type { SessionUser } from './session';

type ProfileRow = typeof coreProfiles.$inferSelect;

function toMe(user: SessionUser, p: ProfileRow): Me {
  return {
    id: user.id,
    email: user.email,
    displayName: p.displayName,
    avatarVariant: isAvatarVariant(p.avatarVariant) ? p.avatarVariant : deriveAvatarVariantFromSeed(user.id),
    nameConfirmed: p.nameConfirmedAt !== null,
  };
}

/** The profile is created on first read, from the Google name (legacy rule), unconfirmed. */
export async function getOrCreateProfile(db: Db, user: SessionUser): Promise<Me> {
  const [existing] = await db.select().from(coreProfiles).where(eq(coreProfiles.userId, user.id));
  if (existing) return toMe(user, existing);
  await db
    .insert(coreProfiles)
    .values({
      userId: user.id,
      displayName: initialDisplayName(user.name, user.email),
      avatarVariant: deriveAvatarVariantFromSeed(user.id),
    })
    .onConflictDoNothing();
  const [created] = await db.select().from(coreProfiles).where(eq(coreProfiles.userId, user.id));
  if (!created) throw new Error('profile not created');
  return toMe(user, created);
}

export const ProfilePatchSchema = z.object({ displayName: DisplayNameSchema }).strict();

export async function updateProfile(db: Db, user: SessionUser, patch: z.output<typeof ProfilePatchSchema>) {
  await getOrCreateProfile(db, user);
  const [row] = await db
    .update(coreProfiles)
    .set({ displayName: patch.displayName, nameConfirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(coreProfiles.userId, user.id))
    .returning();
  if (!row) throw new Error('profile not updated');
  return toMe(user, row);
}
