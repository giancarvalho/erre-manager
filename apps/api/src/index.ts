import { createAuth, createCoreApi } from '@erre/core/server';
import { createDb } from '@erre/db';
import { serve } from '@hono/node-server';

import { createApp } from './app';
import { parseEnv } from './env';
import { createLogger } from './logger';

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
const core = createCoreApi({ db, auth, trustedOrigins: env.TRUSTED_ORIGINS });
const webOrigins = env.TRUSTED_ORIGINS.filter((o) => /^https?:\/\//.test(o));

serve({ fetch: createApp({ logger, core, webOrigins }).fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
