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

export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'removed';

/** GET /v1/invites/:code (public; myStatus only with a session) */
export type InvitePreview = {
  community: { id: string; name: string };
  intent: { id: string; label: string } | null;
  myStatus: MembershipStatus | null;
};

/** GET /v1/me/requests */
export type MyRequest = { id: string; name: string; requestedAt: string };

/** GET /v1/communities/:id/members */
export type Member = { userId: string; displayName: string; avatarVariant: AvatarVariant; role: Role };

/** GET /v1/communities/:id/requests */
export type JoinRequest = {
  userId: string;
  displayName: string;
  avatarVariant: AvatarVariant;
  requestedAt: string;
  intent: string | null;
};

/** GET /v1/communities/:id/invites */
export type InviteView = { id: string; code: string; intent: string | null; createdAt: string };
