import { Hono } from 'hono';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

import { AppError, type ErrorBody } from './errors';
import { createLogger } from './logger';

export type AppDeps = { logger?: Logger };

export function createApp({ logger = createLogger() }: AppDeps = {}) {
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

  app.notFound((c) => c.json<ErrorBody>({ code: 'NOT_FOUND', message: 'Rota não encontrada.' }, 404));

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(err.toBody(), err.status);
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const where = first?.path.length ? ` (${first.path.join('.')})` : '';
      return c.json<ErrorBody>({ code: 'VALIDATION_ERROR', message: `Dados inválidos${where}.` }, 400);
    }
    logger.error({ err, method: c.req.method, path: c.req.path }, 'unhandled error');
    return c.json<ErrorBody>({ code: 'INTERNAL_ERROR', message: 'Erro inesperado. Tente de novo.' }, 500);
  });

  const routes = app.get('/v1/health', (c) => c.json({ status: 'ok' as const }));

  return routes;
}

export type ApiApp = ReturnType<typeof createApp>;
