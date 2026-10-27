import { timingSafeEqual } from 'node:crypto';

import { communities, eq, isUuid, withTenantTx, type Db, type Tx } from '@erre/db';
import { Hono, type Context, type MiddlewareHandler, type Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import cron from 'node-cron';
import { z } from 'zod';

import { CORE_PERMISSIONS, type PermissionDef } from '../../shared/community';
import type { ModuleManifest } from '../../shared/manifest';
import type { Auth } from '../auth/auth';
import { seedRolePermissions } from '../communities';
import { requireCommunity, type CommunityEnv } from '../context';
import { AppError, errors } from '../errors';
import type { MembershipHooks } from '../hooks';
import { errorHandler } from '../http';
import { createMembersApi } from '../members';
import {
  createNotifier,
  type ExpoTransport,
  type NotificationType,
  type NotifyInput,
  type WebPushTransport,
} from '../notifications';
import { coreProfiles } from '../schema';
import { deleteUserData, exportUserData, type ModuleDataEntry } from '../privacy';
import { createRateLimiter, rateLimit, type RateLimitRule } from '../rate-limit';
import { requireSession, type SessionEnv } from '../session';
import { validate } from '../validate';
import type { AnonEnv, ModuleApi, ModuleContext, ModuleEnv, Notify } from './define';
import { moduleProblems } from './validate';

type Log = { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };

export type ModuleRuntimeDeps = {
  db: Db;
  /** erre_jobs pool: only lists communities (D-013). */
  jobsDb: Db;
  auth: Auth;
  modules: readonly ModuleApi[];
  enabled: ReadonlySet<string>;
  /** Bearer token for POST /v1/internal/jobs/:id/run; without it the route is off. */
  cronSecret?: string | undefined;
  /** Bearer token for POST /v1/internal/users/:id/delete (LGPD, operator only); without it the route is off. */
  adminSecret?: string | undefined;
  /** Time zone of job schedules (D-020). */
  timezone?: string;
  log: Log;
  /** Push transports and the global kill switch (PUSH_ENABLED, P-007). Without it, notify() only logs. */
  push?: {
    enabled: boolean;
    webPush?: WebPushTransport | undefined;
    expo?: ExpoTransport | undefined;
    receiptDelayMs?: number;
  };
  /**
   * Request limits (Sprint 19): per person on module routes, stricter on token issuance, per community on
   * anonymous routes (never per IP: they don't know who calls). Defaults below; `false` turns them off (tests).
   */
  rateLimits?: Partial<ModuleRateLimits> | false;
};

export type ModuleRateLimits = { user: RateLimitRule; token: RateLimitRule; anon: RateLimitRule };

export const DEFAULT_MODULE_RATE_LIMITS: ModuleRateLimits = {
  user: { windowMs: 60_000, max: 300 },
  // A person needs one token per round or event; retries after an error stay well under this.
  token: { windowMs: 60_000, max: 10 },
  // A whole community voting at the same time (50 voters, a few requests each), with room for retries.
  anon: { windowMs: 60_000, max: 600 },
};

class Rollback extends Error {}

/** Headers an anonymous route may see. Cookies, Authorization and client IP never reach it (D-010). */
const ANON_HEADERS = ['content-type', 'accept', 'accept-language'];

/**
 * The route a push opens, in the community it came from: the app switches to `?comunidade=<id>` before opening it
 * (apps/mobile/src/app/(app)/_layout.tsx), so a person in several communities lands in the right one. Modules
 * pass the plain route (Sprint 20, [contrato]); a route that already names the community is kept.
 */
export function routeInCommunity(route: string, communityId: string): string {
  const [path = '/', query = ''] = route.split('?', 2);
  const params = new URLSearchParams(query);
  if (params.has('comunidade')) return route;
  params.set('comunidade', communityId);
  return `${path}?${params.toString()}`;
}

export function createModuleRuntime(deps: ModuleRuntimeDeps) {
  const { db, jobsDb, auth, modules, enabled, log } = deps;
  const problems = moduleProblems(modules);
  if (problems.length) throw new Error(`Invalid modules:\n- ${problems.join('\n- ')}`);

  const enabledModules = modules.filter((m) => enabled.has(m.manifest.id));
  const isEnabled = (id: string) => enabled.has(id);

  const notificationTypes: NotificationType[] = enabledModules.flatMap((m) =>
    m.manifest.notifications.map((n) => ({
      id: n.id,
      label: n.label,
      module: m.manifest.id,
      defaultEnabled: n.defaultEnabled,
    })),
  );
  const notifier = createNotifier({
    db,
    types: notificationTypes,
    enabled: deps.push?.enabled ?? false,
    webPush: deps.push?.webPush,
    expo: deps.push?.expo,
    log,
    ...(deps.push?.receiptDelayMs !== undefined ? { receiptDelayMs: deps.push.receiptDelayMs } : {}),
  });

  /**
   * notify() for one transaction: collects messages and hands them to the notifier after commit. A no-op
   * for disabled modules (ARQUITETURA §5.4); the type's prefix names the module.
   */
  function collector(communityId: string): { notify: Notify; pending: NotifyInput[] } {
    const pending: NotifyInput[] = [];
    return {
      pending,
      notify: async (input) => {
        if (!isEnabled(input.type.split('.')[0] ?? '')) return;
        pending.push({ ...input, route: routeInCommunity(input.route ?? '/', communityId) });
      },
    };
  }

  /** Core + every registered module (schema and permissions don't depend on the flag). */
  const permissions: PermissionDef[] = [...CORE_PERMISSIONS, ...modules.flatMap((m) => m.manifest.permissions)];

  const hooks: MembershipHooks = {
    // Intents only for enabled modules: a disabled module neither shows nor runs its intent.
    intents: enabledModules.flatMap((m) =>
      m.manifest.joinIntents.map((i) => ({ id: i.id, label: i.label, onApproved: m.onJoinApproved![i.id]! })),
    ),
    // Leaving runs for every registered module, so module data stays consistent if it is turned back on.
    onMemberLeft: modules.flatMap((m) => (m.onMemberLeft ? [m.onMemberLeft] : [])),
  };

  const session = requireSession(auth);
  const community = requireCommunity(db);
  const limits = deps.rateLimits === false ? null : { ...DEFAULT_MODULE_RATE_LIMITS, ...deps.rateLimits };
  const limiter = createRateLimiter();
  const pass: MiddlewareHandler = async (_c, next) => next();
  const perUser = limits ? rateLimit<Context<SessionEnv>>(limiter, limits.user, (c) => `user:${c.var.user.id}`) : pass;
  const perUserToken = limits
    ? rateLimit<Context<SessionEnv>>(limiter, limits.token, (c) =>
        /\/token$/.test(c.req.path) && c.req.method === 'POST' ? `token:${c.var.user.id}` : null,
      )
    : pass;
  const perCommunityAnon = limits
    ? rateLimit(limiter, limits.anon, (c) => `anon:${c.req.param('communityId') ?? ''}`)
    : pass;

  async function buildContext(v: CommunityEnv['Variables']): Promise<ModuleContext> {
    const { tx, community: cc, user, can, afterCommit } = v;
    const { notify, pending } = collector(cc.id);
    afterCommit(() => notifier.dispatch(pending));
    const [row] = await tx
      .select({ slug: communities.slug, name: communities.name, createdAt: communities.createdAt })
      .from(communities)
      .where(eq(communities.id, cc.id));
    const [profile] = await tx
      .select({ name: coreProfiles.displayName })
      .from(coreProfiles)
      .where(eq(coreProfiles.userId, user.id));
    return {
      user: { id: user.id, displayName: profile?.name ?? user.name },
      community: { id: cc.id, slug: row?.slug ?? '', name: row?.name ?? '', createdAt: row?.createdAt ?? new Date(0) },
      can,
      tx,
      notify,
      members: createMembersApi(tx, cc.id),
    };
  }

  const moduleContext = createMiddleware<CommunityEnv & ModuleEnv>(async (c, next) => {
    c.set('ctx', await buildContext(c.var));
    await next();
  });

  /** Opens the community's transaction for an anonymous route; 404 when the community doesn't exist. */
  const anonContext = createMiddleware<AnonEnv>(async (c: Context<AnonEnv>, next: Next) => {
    const communityId = c.req.param('communityId') ?? '';
    if (!isUuid(communityId)) throw errors.notFound();
    try {
      await withTenantTx(db, { communityId, userId: null }, async (tx: Tx) => {
        const [row] = await tx
          .select({ createdAt: communities.createdAt })
          .from(communities)
          .where(eq(communities.id, communityId));
        if (!row) throw errors.notFound();
        c.set('ctx', { community: { id: communityId, createdAt: row.createdAt }, tx });
        await next();
        if (c.error || c.res.status >= 400) throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  });

  const app = new Hono();

  for (const mod of modules) {
    const id = mod.manifest.id;
    app.use(`/v1/${id}/*`, async (c, next) => {
      if (!isEnabled(id))
        return c.json({ code: 'MODULE_DISABLED', message: 'Essa funcionalidade não está disponível.' }, 404);
      await next();
    });

    // Anonymous routes run in their own app, on a copy of the request without identifying headers.
    const anonRoot = new Hono()
      .use(`/v1/${id}/anon/c/:communityId/*`, perCommunityAnon, anonContext)
      // Sub-apps carry their own Env types; the runtime mounts them as plain apps.
      .route(`/v1/${id}/anon/c/:communityId`, (mod.anon ?? new Hono()) as unknown as Hono)
      .notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Rota não encontrada.' }, 404))
      .onError(errorHandler(log));
    app.all(`/v1/${id}/anon/*`, async (c) => {
      const headers = new Headers();
      for (const name of ANON_HEADERS) {
        const v = c.req.header(name);
        if (v) headers.set(name, v);
      }
      const method = c.req.method;
      const body = method === 'GET' || method === 'HEAD' ? undefined : await c.req.raw.arrayBuffer();
      return anonRoot.fetch(new Request(c.req.url, { method, headers, ...(body ? { body } : {}) }));
    });

    if (mod.api) {
      const authed = new Hono<CommunityEnv & ModuleEnv>()
        .use('*', session, perUser, perUserToken, community, moduleContext)
        .route('/', mod.api as unknown as Hono<CommunityEnv & ModuleEnv>);
      app.route(`/v1/${id}`, authed);
    }
  }

  // Manifests of enabled modules: the app builds its menu from this (∩ its UI registry).
  app.get('/v1/modules', (c) => c.json(enabledModules.map((m) => m.manifest)));

  // Profile sections of the enabled modules for a member of the current community (D-018).
  const sections = enabledModules.flatMap((m) =>
    (m.profileSections ?? []).map((s) => ({ module: m.manifest.id, ...s })),
  );
  app.get(
    '/v1/profile/:userId/sections',
    session,
    community,
    moduleContext,
    validate('param', z.object({ userId: z.uuid() })),
    async (c) => {
      const ctx = c.var.ctx;
      const { userId } = c.req.valid('param');
      if (!(await ctx.members.isApprovedMember(userId))) throw errors.notFound('Membro não encontrado.');
      const out: { id: string; module: string; data: unknown }[] = [];
      for (const s of sections) {
        try {
          const data = await ctx.tx.transaction((sp) =>
            s.load({ ...ctx, tx: sp, members: createMembersApi(sp, ctx.community.id) }, userId),
          );
          if (data !== null && data !== undefined) out.push({ id: s.id, module: s.module, data });
        } catch (err) {
          log.error({ section: s.id, err: { name: (err as Error).name } }, 'profile section failed');
        }
      }
      return c.json(out);
    },
  );

  // ---- jobs (D-013) ----
  const jobs = enabledModules.flatMap((m) => m.jobs ?? []);

  /** Runs a job once per community, each in its own tenant transaction; one failure doesn't stop the rest. */
  async function runJob(jobId: string, now: Date = new Date()) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Tarefa não encontrada.');
    const lockClient = await db.$client.connect();
    try {
      const { rows } = await lockClient.query<{ ok: boolean }>('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [
        `job:${jobId}`,
      ]);
      if (!rows[0]?.ok) return { job: jobId, skipped: true, communities: 0, failed: 0 };
      try {
        const list = await jobsDb
          .select({
            id: communities.id,
            slug: communities.slug,
            name: communities.name,
            createdAt: communities.createdAt,
          })
          .from(communities);
        let failed = 0;
        for (const community of list) {
          const { id } = community;
          try {
            const { notify, pending } = collector(id);
            await withTenantTx(db, { communityId: id, userId: null }, (tx) =>
              job.run({ community, tx, notify, members: createMembersApi(tx, id), now }),
            );
            notifier.dispatch(pending);
          } catch (err) {
            failed += 1;
            log.error(
              { job: jobId, community: id, err: { name: (err as Error).name, message: (err as Error).message } },
              'job failed for a community',
            );
          }
        }
        log.info({ job: jobId, communities: list.length, failed }, 'job finished');
        return { job: jobId, skipped: false, communities: list.length, failed };
      } finally {
        await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`job:${jobId}`]);
      }
    } finally {
      lockClient.release();
    }
  }

  /** Bearer secret check in constant time; a route whose secret is not configured doesn't exist. */
  function requireBearer(c: Context, secret: string | undefined) {
    if (!secret) throw errors.notFound();
    const given = Buffer.from((c.req.header('authorization') ?? '').replace(/^Bearer /, ''));
    const expected = Buffer.from(secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      throw errors.unauthenticated('Credencial inválida.');
  }

  app.post('/v1/internal/jobs/:id/run', async (c) => {
    requireBearer(c, deps.cronSecret);
    return c.json(await runJob(c.req.param('id')));
  });

  // ---- LGPD (Sprint 19): every registered module, on or off, so nothing is left behind ----
  const dataEntries: ModuleDataEntry[] = modules.flatMap((m) =>
    m.data ? [{ module: m.manifest.id, data: m.data }] : [],
  );

  app.get('/v1/me/export', session, async (c) => {
    const user = c.var.user;
    c.header('content-disposition', 'attachment; filename="meus-dados.json"');
    return c.json(await exportUserData(db, user, dataEntries));
  });

  app.post('/v1/internal/users/:id/delete', validate('param', z.object({ id: z.uuid() })), async (c) => {
    requireBearer(c, deps.adminSecret);
    const result = await deleteUserData(db, c.req.valid('param').id, dataEntries);
    if (result.ok) {
      log.info({ communities: result.communities }, 'user data deleted');
      return c.json({ deleted: true, communities: result.communities });
    }
    if (result.code === 'NOT_FOUND') throw errors.notFound('Pessoa não encontrada.');
    throw errors.conflict(
      'SOLE_OWNER',
      `Essa pessoa é a única dona de: ${result.communities.join(', ')}. Passe a propriedade antes de excluir.`,
    );
  });

  /** Schedules the jobs of enabled modules. Returns a function that stops them. */
  function startJobs(): () => void {
    const tasks = jobs.map((job) =>
      cron.schedule(
        job.schedule,
        () =>
          void runJob(job.id).catch((err: unknown) =>
            log.error({ job: job.id, err: { name: (err as Error).name } }, 'job crashed'),
          ),
        {
          timezone: deps.timezone ?? 'America/Sao_Paulo',
          name: job.id,
        },
      ),
    );
    return () => {
      for (const t of tasks) void t.stop();
    };
  }

  /** Inserts missing default role permissions in every community (idempotent; never removes). */
  async function syncPermissions(): Promise<number> {
    const list = await jobsDb.select({ id: communities.id }).from(communities);
    for (const { id } of list)
      await withTenantTx(db, { communityId: id, userId: null }, (tx) => seedRolePermissions(tx, id, permissions));
    return list.length;
  }

  return {
    app,
    notifier,
    notificationTypes,
    hooks,
    permissions,
    enabledManifests: enabledModules.map((m) => m.manifest) as ModuleManifest[],
    scheduledJobs: jobs.map((j) => j.id),
    runJob,
    startJobs,
    syncPermissions,
  };
}

export type ModuleRuntime = ReturnType<typeof createModuleRuntime>;
