import { expo } from '@better-auth/expo';
import type { Db } from '@erre/db';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { authAccount, authSession, authUser, authVerification } from '../schema';
import { verifiedGoogleUserInfo } from './google';

const DAY = 60 * 60 * 24;

export type AuthConfig = {
  db: Db;
  /** Public URL of the API (e.g. https://api.example.com). OAuth callbacks go to `${baseURL}/v1/auth/...`. */
  baseURL: string;
  secret: string;
  google: { clientId: string; clientSecret: string };
  /** Web origins and the app scheme (e.g. `erre://`). */
  trustedOrigins: string[];
  rateLimit?: BetterAuthOptions['rateLimit'];
  /** Better Auth's internal log lines go here, message only (arguments may carry tokens). */
  log?: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
};

export const SESSION_EXPIRES_IN = 400 * DAY;

export function createAuth({ db, baseURL, secret, google, trustedOrigins, rateLimit, log }: AuthConfig) {
  return betterAuth({
    appName: 'Erre',
    baseURL,
    basePath: '/v1/auth',
    secret,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
    }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        prompt: 'select_account',
        // The app signs in through the browser (Expo plugin), never with a raw ID token.
        disableIdTokenSignIn: true,
        getUserInfo: verifiedGoogleUserInfo(google.clientId),
      },
    },
    plugins: [expo()],
    trustedOrigins,
    // Sliding session like the legacy app (~400 days, the Chrome cookie cap): renewed once a day when used.
    session: { expiresIn: SESSION_EXPIRES_IN, updateAge: DAY },
    // Per IP. Sign-in limits leave room for a group logging in together on the same Wi-Fi.
    rateLimit: rateLimit ?? {
      enabled: true,
      window: 60,
      max: 100,
      customRules: { '/sign-in/social': { window: 60, max: 30 }, '/callback/*': { window: 60, max: 30 } },
    },
    advanced: {
      // Better Auth turns the origin check off under test runners; keep production behaviour (D-031).
      disableOriginCheck: false,
      cookiePrefix: 'erre',
      database: { generateId: 'uuid' },
    },
    databaseHooks: {
      session: {
        // Sessions don't store IP or user agent: not needed, and it is personal data (LGPD).
        create: { before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }) },
      },
    },
    // Unexpected errors go to the API's error handler (sanitized log) instead of better-call's console.error,
    // which prints Drizzle errors with their query parameters (state, codes, e-mails).
    onAPIError: { throw: true },
    logger: {
      level: 'warn',
      log: (level, message) => log?.(level, message),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
