// Test harness for a module: the core API plus the module runtime over a test database, without apps/api.
// Lets a module test its own routes (authenticated, anonymous and jobs) against real Postgres and RLS.
import { closeDb, createDb, type Db } from '@erre/db';
import { Hono } from 'hono';

import { createCoreApi } from './app';
import { createAuth } from './auth/auth';
import { errorHandler } from './http';
import { createModuleRuntime, type ModuleRuntime, type ModuleRuntimeDeps } from './modules/runtime';
import type { ModuleApi } from './modules/define';
import type { WebPushTransport } from './notifications';
import { createRoleFixture, installFakeGoogle, type FakeGoogle, type RoleFixture, type TestUser } from './testing';

export const HARNESS_ORIGIN = 'http://localhost:8081';

export type HarnessRequest = {
  community?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type ModuleHarness = {
  app: Hono;
  db: Db;
  jobsDb: Db;
  google: FakeGoogle;
  runtime: ModuleRuntime;
  /** Request as `user` (or anonymous with null), with X-Community-Id and a JSON body when given. */
  req: (user: TestUser | null, method: string, path: string, opts?: HarnessRequest) => Promise<Response>;
  /** A community with one approved member per role, one pending and one outsider (createRoleFixture). */
  fixture: (name?: string) => Promise<RoleFixture>;
  /** Pushes recorded by the fake Web Push transport (with `recordPush`), after `runtime.notifier.idle()`. */
  pushes: RecordedPush[];
  /** Registers a fake Web Push device for the person, so notify() reaches them (with `recordPush`). */
  subscribe: (user: TestUser) => Promise<void>;
  /**
   * Runs `action` and returns the pushes it sent (with `recordPush` and a `subscribe`d device per person). Waits
   * for the notifier, which sends after the commit.
   */
  pushesAfter: (action: () => Promise<unknown>) => Promise<RecordedPush[]>;
  close: () => Promise<void>;
};

export type RecordedPush = { endpoint: string; userId: string | undefined; title: string; body: string; url: string };

export type HarnessLog = { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };

const silent: HarnessLog = { info: () => {}, error: () => {} };

export function createModuleHarness({
  urls,
  modules,
  enabled = modules.map((m) => m.manifest.id),
  cronSecret,
  adminSecret,
  log = silent,
  recordPush = false,
  rateLimits = false,
}: {
  urls: { app: string; jobs: string };
  modules: readonly ModuleApi[];
  enabled?: readonly string[];
  cronSecret?: string;
  /** Turns on POST /v1/internal/users/:id/delete (LGPD). */
  adminSecret?: string;
  /** Receives the runtime and error logs (e.g. to assert that nothing identifying is logged). */
  log?: HarnessLog;
  /** Turns push on with a fake Web Push transport that records what would be sent. */
  recordPush?: boolean;
  /** Module request limits (Sprint 19); off unless a test sets them. */
  rateLimits?: ModuleRuntimeDeps['rateLimits'];
}): ModuleHarness {
  const pushes: RecordedPush[] = [];
  const endpointOwner = new Map<string, string>();
  const webPush: WebPushTransport = {
    async send(sub, payload) {
      pushes.push({ endpoint: sub.endpoint, userId: endpointOwner.get(sub.endpoint), ...payload });
      return 'sent';
    },
  };
  const db = createDb(urls.app);
  const jobsDb = createDb(urls.jobs, { max: 1 });
  const google = installFakeGoogle('harness-client');
  const auth = createAuth({
    db,
    baseURL: 'http://localhost:3000',
    secret: 'h'.repeat(40),
    google: { clientId: 'harness-client', clientSecret: 'cs' },
    trustedOrigins: [HARNESS_ORIGIN],
    rateLimit: { enabled: false },
  });
  const runtime = createModuleRuntime({
    db,
    jobsDb,
    auth,
    modules,
    enabled: new Set(enabled),
    cronSecret,
    adminSecret,
    log,
    push: recordPush ? { enabled: true, webPush } : { enabled: false },
    rateLimits,
  });
  const core = createCoreApi({
    db,
    auth,
    trustedOrigins: [HARNESS_ORIGIN],
    hooks: runtime.hooks,
    permissions: runtime.permissions,
    notifications: {
      types: runtime.notificationTypes,
      pushEnabled: recordPush,
      webPushPublicKey: recordPush ? 'harness-public-key' : null,
    },
  });
  const app = new Hono();
  app.onError(errorHandler(log));
  app.route('/v1', core);
  app.route('/', runtime.app);

  const req: ModuleHarness['req'] = (user, method, path, opts = {}) =>
    Promise.resolve(
      app.request(path, {
        method,
        headers: {
          origin: HARNESS_ORIGIN,
          ...(user ? { cookie: user.cookie } : {}),
          ...(opts.community ? { 'x-community-id': opts.community } : {}),
          ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...opts.headers,
        },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      }),
    );

  return {
    app,
    db,
    jobsDb,
    google,
    runtime,
    req,
    pushes,
    async pushesAfter(action) {
      await runtime.notifier.idle();
      const before = pushes.length;
      await action();
      await runtime.notifier.idle();
      return pushes.slice(before);
    },
    async subscribe(user) {
      const endpoint = `https://push.example.com/${user.id}`;
      endpointOwner.set(endpoint, user.id);
      const res = await req(user, 'POST', '/v1/push/subscriptions', {
        body: { kind: 'webpush', endpoint, keys: { p256dh: 'p256dh', auth: 'auth' } },
      });
      if (res.status >= 300) throw new Error(`subscribe failed: ${res.status} ${await res.text()}`);
    },
    fixture: (name) => createRoleFixture(app, google, db, { origin: HARNESS_ORIGIN, ...(name ? { name } : {}) }),
    async close() {
      google.restore();
      await closeDb(db);
      await closeDb(jobsDb);
    },
  };
}
