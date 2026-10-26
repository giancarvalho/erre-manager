// What the app may import from the core: pure rules and API types. Never server code (ARQUITETURA §3).
export { AVATAR_VARIANTS, deriveAvatarVariantFromSeed, isAvatarVariant, type AvatarVariant } from '../shared/avatar';
export { ASSIGNABLE_ROLES, CommunityNameSchema, ROLES, type Role } from '../shared/community';
export { DisplayNameSchema } from '../shared/display-name';
export {
  defineManifest,
  ManifestSchema,
  manifestProblems,
  RESERVED_MODULE_IDS,
  type ModuleManifest,
  type ModuleManifestInput,
} from '../shared/manifest';
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
export {
  defineModuleUi,
  HOST_STORAGE_KEY,
  ModuleHostProvider,
  useModuleClient,
  useModuleHost,
  type HostCommunity,
  type HostStorage,
  type HubSectionProps,
  type ModuleHost,
  type ModuleUi,
  type ModuleUiDefinition,
  type ProfileSectionProps,
} from './host';
