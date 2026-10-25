// What the app may import from the core: pure rules and API types. Never server code (ARQUITETURA §3).
export { AVATAR_VARIANTS, deriveAvatarVariantFromSeed, isAvatarVariant, type AvatarVariant } from '../shared/avatar';
export { DisplayNameSchema } from '../shared/display-name';
export { safeAppPath } from '../shared/redirect';
export type { Me } from '../shared/types';
