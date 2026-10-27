import type { Tx } from '@erre/db';
import { Hono } from 'hono';

import type { ModuleManifest } from '../../shared/manifest';
import type { MemberHookContext } from '../hooks';
import type { MembersApi } from '../members';

import type { NotifyInput } from '../notifications';

/**
 * notify() (ARQUITETURA §6): `type` is a notification declared in the manifest. Sent after the transaction
 * commits, to the people whose preference allows it; a no-op when the module or push is off.
 */
export type Notify = (input: NotifyInput) => Promise<void>;
export type { NotifyInput };

/** Everything a module route receives (ARQUITETURA §5.1). Nothing else. */
export type ModuleContext = {
  user: { id: string; displayName: string };
  /** `createdAt`: anchors a module's first period before anything happened (e.g. the Errômetro's first round). */
  community: { id: string; slug: string; name: string; createdAt: Date };
  can: (permission: string) => Promise<boolean>;
  /** Drizzle transaction with RLS scoped to the community; commits when the route succeeds. */
  tx: Tx;
  notify: Notify;
  members: MembersApi;
};

/** Anonymous routes (D-010): no user, no session, no identifying headers. */
export type AnonContext = { community: { id: string; createdAt: Date }; tx: Tx };

export type JobContext = {
  community: { id: string; slug: string; name: string; createdAt: Date };
  tx: Tx;
  notify: Notify;
  members: MembersApi;
  now: Date;
};

export type ModuleEnv = { Variables: { ctx: ModuleContext } };
export type AnonEnv = { Variables: { ctx: AnonContext } };

/** Sub-app for a module's authenticated routes, mounted at /v1/<id>. Read the context with c.var.ctx. */
export const createModuleApp = () => new Hono<ModuleEnv>();

/**
 * Sub-app for anonymous routes, mounted at /v1/<id>/anon/c/:communityId. The handler validates the
 * community through the anonymous credential (blind signature, ARQUITETURA §4.5).
 */
export const createAnonApp = () => new Hono<AnonEnv>();

export type ModuleJob = {
  /** `<module id>.<name>` */
  id: string;
  /** Cron expression, in the app's time zone (D-020). */
  schedule: string;
  /** Runs once per community, in that community's transaction. */
  run: (ctx: JobContext) => Promise<void>;
};

export type ProfileSection = {
  /** `<module id>.<name>` */
  id: string;
  /** Data for the person's profile in this community, or null to hide the section. */
  load: (ctx: ModuleContext, userId: string) => Promise<unknown>;
};

// Hono sub-apps of any route shape. The concrete type is exported by each module for its RPC client (D-009).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route schemas vary per module
type AnyApp<E extends { Variables: object }> = Hono<E, any, any>;

export type ModuleApiDefinition = {
  api?: AnyApp<ModuleEnv>;
  anon?: AnyApp<AnonEnv>;
  jobs?: ModuleJob[];
  profileSections?: ProfileSection[];
  /** One handler per join intent declared in the manifest (D-023). */
  onJoinApproved?: Record<string, (ctx: MemberHookContext) => Promise<void>>;
  /** Called when someone leaves the community, is removed or has the request rejected. */
  onMemberLeft?: (ctx: MemberHookContext) => Promise<void>;
  /** LGPD (Sprint 19): the person's data in one community, to export and to erase. */
  data?: ModuleData;
};

/** Runs in the community's transaction (RLS of `communityId`), with no person in the session. */
export type DataContext = { tx: Tx; communityId: string };

export type ModuleData = {
  /**
   * What this module keeps about `userId` in the community, as plain JSON (null when nothing). Anonymous votes
   * never come in: nothing links them to a person (R-ANON-03).
   */
  export: (ctx: DataContext, userId: string) => Promise<unknown>;
  /**
   * Erases what this module keeps about `userId` in the community. Runs before the account is deleted, in the
   * same request; ids left in shared history (votes about the person, frozen results) stop pointing to anyone.
   */
  delete: (ctx: DataContext, userId: string) => Promise<void>;
};

export type ModuleApi = ModuleApiDefinition & { manifest: ModuleManifest };

/** Server half of a module (D-019). Validated with the other modules at boot (validateModules). */
export function defineModuleApi(manifest: ModuleManifest, definition: ModuleApiDefinition): ModuleApi {
  return { manifest, ...definition };
}
