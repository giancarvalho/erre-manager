// What the app may import from the core: pure rules and API types. Never server code (ARQUITETURA §3).
export { AVATAR_VARIANTS, deriveAvatarVariantFromSeed, isAvatarVariant, type AvatarVariant } from '../shared/avatar';
export { ASSIGNABLE_ROLES, CommunityNameSchema, ROLES, type Role } from '../shared/community';
export { DisplayNameSchema } from '../shared/display-name';
export { safeAppPath } from '../shared/redirect';
export type {
  CommunityDetails,
  InvitePreview,
  InviteView,
  JoinRequest,
  Me,
  Member,
  MembershipStatus,
  MyCommunity,
  MyRequest,
} from '../shared/types';
