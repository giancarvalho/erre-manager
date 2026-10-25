import { createAuth, createCoreApi, createModuleRuntime, parseEnabledModules } from '@erre/core/server';
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
});
const core = createCoreApi({
  db,
  auth,
  trustedOrigins: env.TRUSTED_ORIGINS,
  hooks: runtime.hooks,
  permissions: runtime.permissions,
  log: (message, err) => logger.error({ err: { name: (err as Error).name } }, message),
});
const webOrigins = env.TRUSTED_ORIGINS.filter((o) => /^https?:\/\//.test(o));

await runtime.syncPermissions();
runtime.startJobs();
logger.info({ modules: runtime.enabledManifests.map((m) => m.id), jobs: runtime.scheduledJobs }, 'modules ready');

serve({ fetch: createApp({ logger, core, modules: runtime.app, webOrigins }).fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
