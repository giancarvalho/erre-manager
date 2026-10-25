import {
  createAuth,
  createCoreApi,
  createModuleRuntime,
  expoTransport,
  parseEnabledModules,
  webPushTransport,
} from '@erre/core/server';
import { createDb } from '@erre/db';
import { serve } from '@hono/node-server';

import { createApp } from './app';
import { parseEnv } from './env';
import { createLogger } from './logger';
import { MODULES } from './modules';

const env = parseEnv();
const logger = createLogger({ level: env.LOG_LEVEL });
const db = createDb(env.DATABASE_URL, { applicationName: 'erre-api' });
const auth = createAuth({
  db,
  baseURL: env.PUBLIC_API_URL,
  secret: env.BETTER_AUTH_SECRET,
  google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  trustedOrigins: env.TRUSTED_ORIGINS,
  log: (level, message) => logger[level === 'debug' ? 'debug' : level](message),
});
// Web Push only when the three VAPID variables are set (like the legacy app: otherwise a silent no-op).
const vapid =
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
    ? { publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }
    : null;
const jobsDb = createDb(env.DATABASE_JOBS_URL, { max: 2, applicationName: 'erre-jobs' });
const runtime = createModuleRuntime({
  db,
  jobsDb,
  auth,
  modules: MODULES,
  enabled: parseEnabledModules(env.MODULES_ENABLED, MODULES),
  cronSecret: env.CRON_SECRET,
  timezone: env.VOTING_TIMEZONE,
  log: logger,
  push: {
    enabled: env.PUSH_ENABLED,
    webPush: vapid ? webPushTransport(vapid) : undefined,
    expo: expoTransport(env.EXPO_ACCESS_TOKEN),
  },
});
const core = createCoreApi({
  db,
  auth,
  trustedOrigins: env.TRUSTED_ORIGINS,
  hooks: runtime.hooks,
  permissions: runtime.permissions,
  notifications: {
    types: runtime.notificationTypes,
    pushEnabled: env.PUSH_ENABLED,
    webPushPublicKey: vapid?.publicKey ?? null,
  },
  log: (message, err) => logger.error({ err: { name: (err as Error).name } }, message),
});
const webOrigins = env.TRUSTED_ORIGINS.filter((o) => /^https?:\/\//.test(o));

await runtime.syncPermissions();
runtime.startJobs();
logger.info({ modules: runtime.enabledManifests.map((m) => m.id), jobs: runtime.scheduledJobs }, 'modules ready');

serve({ fetch: createApp({ logger, core, modules: runtime.app, webOrigins }).fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
