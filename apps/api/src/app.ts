import { errorHandler, type CoreApi } from '@erre/core/server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Logger } from 'pino';

import { createLogger } from './logger';

export type AppDeps = {
  logger?: Logger;
  core?: CoreApi;
  /** Module runtime app (ModuleRuntime.app): module routes, /v1/modules, profile sections, internal jobs. */
  modules?: Hono;
  /** Web origins allowed to call the API with cookies (the app scheme is not an HTTP origin). */
  webOrigins?: string[];
};

export function createApp({ logger = createLogger(), core, modules, webOrigins = [] }: AppDeps = {}) {
  const app = new Hono();

  // Request log: method, path, status and duration only. No headers, query strings or bodies.
  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - start) },
      'request',
    );
  });

  app.use(
    '/v1/*',
    cors({
      origin: (origin) => (webOrigins.includes(origin) ? origin : null),
      credentials: true,
      allowHeaders: ['content-type', 'x-community-id'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      maxAge: 600,
    }),
  );

  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Rota não encontrada.' }, 404));
  app.onError(errorHandler(logger));

  const routes = app.get('/v1/health', (c) => c.json({ status: 'ok' as const }));
  if (core) routes.route('/v1', core);
  if (modules) routes.route('/', modules);
  return routes;
}

export type ApiApp = ReturnType<typeof createApp>;
