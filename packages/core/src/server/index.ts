export { createAuth, SESSION_EXPIRES_IN, type Auth, type AuthConfig } from './auth/auth';
export { CORE_PERMISSIONS } from '../shared/community';
import { CORE_PERMISSIONS as CP } from '../shared/community';
export const CORE_PERMISSION_IDS: readonly string[] = CP.map((p) => p.id);
export { isTrustedRedirect } from './auth/redirect';
export {
  changeMemberRole,
  createCommunity,
  CREATE_LIMIT_PER_DAY,
  listMyCommunities,
  seedRolePermissions,
} from './communities';
export {
  COMMUNITY_HEADER,
  requireCommunity,
  requirePermission,
  type CommunityContext,
  type CommunityEnv,
} from './context';
export { validate } from './validate';
export { NO_HOOKS, type JoinIntent, type MemberHookContext, type MemberLeftHook, type MembershipHooks } from './hooks';
export { decodeInviteCode, encodeInviteCode, type InvitePreview, type InviteView } from './invites';
export { createMembersApi, MAX_MEMBERS, type JoinRequest, type Member, type MembersApi } from './members';
export { createCoreApi, type CoreApi, type CoreApiDeps } from './app';
export { AppError, errors, type ErrorBody } from './errors';
export { errorHandler, safeError } from './http';
export { optionalSession, requireSession, type SessionEnv, type SessionUser } from './session';
export * as schema from './schema';
export {
  createAnonApp,
  createModuleApp,
  defineModuleApi,
  type AnonContext,
  type AnonEnv,
  type DataContext,
  type JobContext,
  type ModuleApi,
  type ModuleApiDefinition,
  type ModuleContext,
  type ModuleData,
  type ModuleEnv,
  type ModuleJob,
  type Notify,
  type NotifyInput,
  type ProfileSection,
} from './modules/define';
export {
  createModuleRuntime,
  DEFAULT_MODULE_RATE_LIMITS,
  type ModuleRateLimits,
  type ModuleRuntime,
  type ModuleRuntimeDeps,
} from './modules/runtime';
export { moduleProblems, parseEnabledModules } from './modules/validate';
export { defineManifest, type ModuleManifest } from '../shared/manifest';
export {
  createNotifier,
  expoTransport,
  webPushTransport,
  type ExpoTicket,
  type ExpoTransport,
  type NotificationType,
  type Notifier,
  type PushPayload,
  type WebPushSubscription,
  type WebPushTransport,
} from './notifications';
export { createRateLimiter, rateLimit, type RateLimiter, type RateLimitRule } from './rate-limit';
