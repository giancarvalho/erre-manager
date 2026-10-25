import type { AvatarVariant } from './avatar';
import type { Role } from './community';

/** GET /v1/me */
export type Me = {
  id: string;
  email: string;
  displayName: string;
  avatarVariant: AvatarVariant;
  /** False until the person confirms the name on first sign-in (onboarding). */
  nameConfirmed: boolean;
};

/** GET /v1/me/communities (approved memberships only) */
export type MyCommunity = { id: string; slug: string; name: string; role: Role };

/** GET /v1/communities/:id */
export type CommunityDetails = MyCommunity & { permissions: string[] };
