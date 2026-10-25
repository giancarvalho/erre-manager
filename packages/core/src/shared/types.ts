import type { AvatarVariant } from './avatar';

/** GET /v1/me */
export type Me = {
  id: string;
  email: string;
  displayName: string;
  avatarVariant: AvatarVariant;
  /** False until the person confirms the name on first sign-in (onboarding). */
  nameConfirmed: boolean;
};
