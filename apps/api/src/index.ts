import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createLogger } from './logger';

const logger = createLogger();
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: createApp({ logger }).fetch, port }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
