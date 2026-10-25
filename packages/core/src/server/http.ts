import type { Context, ErrorHandler } from 'hono';
import { z, ZodError, type ZodType } from 'zod';

import { AppError, errors, type ErrorBody } from './errors';

// Default Zod messages in Portuguese; schemas with their own message keep it.
z.config(z.locales.pt());

type Logger = { error: (obj: object, msg: string) => void };

/**
 * Error fields safe to log: name, Postgres code, message without query parameters, stack frames
 * without the message. Drizzle puts the query parameters (personal data, tokens) in the message.
 */
export function safeError(err: unknown): { name: string; code?: string; message: string; stack?: string } {
  const e = (err ?? {}) as { name?: unknown; message?: unknown; stack?: unknown; code?: unknown; cause?: unknown };
  const cause = (e.cause ?? {}) as { code?: unknown };
  const code = typeof e.code === 'string' ? e.code : typeof cause.code === 'string' ? cause.code : undefined;
  const message = String(e.message ?? err)
    .replace(/\s*params:[\s\S]*$/, '')
    .slice(0, 500);
  const frames = typeof e.stack === 'string' ? e.stack.split('\n').filter((l) => l.trimStart().startsWith('at ')) : [];
  return {
    name: typeof e.name === 'string' ? e.name : 'Error',
    ...(code ? { code } : {}),
    message,
    ...(frames.length ? { stack: frames.slice(0, 10).join('\n') } : {}),
  };
}

/** Single error format for the API: AppError, Zod (400) or 500 without internal details. */
export function errorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof AppError) return c.json(err.toBody(), err.status);
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return c.json<ErrorBody>({ code: 'VALIDATION_ERROR', message: first?.message ?? 'Dados inválidos.' }, 400);
    }
    logger.error({ err: safeError(err), method: c.req.method, path: c.req.path }, 'unhandled error');
    return c.json<ErrorBody>({ code: 'INTERNAL_ERROR', message: 'Erro inesperado. Tente de novo.' }, 500);
  };
}

/** Parses the JSON body with a Zod schema; invalid JSON or data → 400 VALIDATION_ERROR. */
export async function jsonBody<T extends ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  const raw: unknown = await c.req.json().catch(() => {
    throw errors.validation('Corpo da requisição inválido.');
  });
  return schema.parse(raw);
}
