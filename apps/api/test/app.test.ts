import { Writable } from 'node:stream';

import { errors } from '@erre/core/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '../src/app';
import { createLogger } from '../src/logger';

function memoryLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  return { logger: createLogger({ level: 'info' }, stream), lines };
}

describe('api app', () => {
  it('answers health', async () => {
    const res = await createApp({ logger: memoryLogger().logger }).request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('sends security headers on every response (Sprint 19)', async () => {
    const res = await createApp({ logger: memoryLogger().logger }).request('/v1/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it('returns 404 in the standard error format', async () => {
    const res = await createApp({ logger: memoryLogger().logger }).request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: 'NOT_FOUND', message: 'Rota não encontrada.' });
  });

  it('maps AppError, ZodError and unknown errors', async () => {
    const { logger, lines } = memoryLogger();
    const app = createApp({ logger });
    app.get('/app-error', () => {
      throw errors.rule('VOTING_CLOSED', 'A votação está fechada.');
    });
    app.get('/zod', () => {
      z.object({ name: z.string() }).parse({ name: 1 });
      return new Response();
    });
    app.get('/boom', () => {
      throw new Error('secret internal detail');
    });

    const a = await app.request('/app-error');
    expect(a.status).toBe(422);
    expect(await a.json()).toEqual({ code: 'VOTING_CLOSED', message: 'A votação está fechada.' });

    const z1 = await app.request('/zod');
    expect(z1.status).toBe(400);
    expect(await z1.json()).toMatchObject({ code: 'VALIDATION_ERROR' });

    const b = await app.request('/boom');
    expect(b.status).toBe(500);
    const body = await b.text();
    expect(body).not.toContain('secret internal detail');
    expect(JSON.parse(body)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(lines.some((l) => l.includes('unhandled error'))).toBe(true);
  });

  it('logs requests without headers or query strings', async () => {
    const { logger, lines } = memoryLogger();
    await createApp({ logger }).request('/v1/health?email=a@b.c', {
      headers: { authorization: 'Bearer abc', cookie: 'session=xyz' },
    });
    const log = lines.join('');
    expect(log).toContain('"path":"/v1/health"');
    expect(log).not.toContain('abc');
    expect(log).not.toContain('xyz');
    expect(log).not.toContain('a@b.c');
  });

  it('redacts sensitive fields in logs', () => {
    const { logger, lines } = memoryLogger();
    logger.info({ user: { email: 'x@y.z', token: 't0k' }, email: 'w@w.w' }, 'msg');
    const log = lines.join('');
    expect(log).not.toContain('x@y.z');
    expect(log).not.toContain('t0k');
    expect(log).not.toContain('w@w.w');
    expect(log).toContain('[redacted]');
  });
});
