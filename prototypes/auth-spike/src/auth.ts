import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export const TRUSTED_ORIGINS = ['erreprototipo://', 'http://localhost:8081', 'http://localhost:8090'];

const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };

export const auth = betterAuth({
  baseURL: 'http://localhost:3000',
  secret: 'spike-only-secret-not-for-production-0123456789',
  database: memoryAdapter(db),
  socialProviders: {
    google: { clientId: 'fake-client-id.apps.googleusercontent.com', clientSecret: 'fake-secret' },
  },
  plugins: [expo()],
  // Better Auth skips the origin check when it detects a test run (create-context.mjs: isTest()).
  // Pin it so tests exercise the production CSRF behaviour.
  advanced: { disableOriginCheck: false },
  trustedOrigins: TRUSTED_ORIGINS,
});

export const app = new Hono();
app.use('/api/*', cors({ origin: (o) => (TRUSTED_ORIGINS.includes(o) ? o : null), credentials: true }));

// Better Auth only validates callbackURL when the request carries cookies (CSRF path).
// A first sign-in has no cookies, so we validate every redirect target ourselves.
export function isTrustedRedirect(target: unknown): boolean {
  if (typeof target !== 'string' || target.length === 0) return true; // absent: Better Auth uses its default
  if (target.startsWith('/') && !target.startsWith('//')) return true; // same-origin relative path
  return TRUSTED_ORIGINS.some((o) => target === o || target.startsWith(o.endsWith('/') ? o : `${o}/`));
}

app.post('/api/auth/sign-in/social', async (c, next) => {
  const body = (await c.req.raw.clone().json().catch(() => ({}))) as Record<string, unknown>;
  for (const key of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL']) {
    if (!isTrustedRedirect(body[key])) return c.json({ code: 'INVALID_CALLBACK_URL', message: 'Endereço de retorno não permitido.' }, 403);
  }
  await next();
});
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
