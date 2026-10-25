import { z } from 'zod';

const list = z
  .string()
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(1)).min(1));

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** erre_app connection (NOSUPERUSER NOBYPASSRLS). */
  DATABASE_URL: z.url(),
  /** Public URL of this API; Google redirects to `${PUBLIC_API_URL}/v1/auth/callback/google`. */
  PUBLIC_API_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  /** Web origins and the app scheme, comma separated (e.g. https://app.example.com,erre://). */
  TRUSTED_ORIGINS: list,
  /** erre_jobs connection: only lists communities for the job runner (D-013). */
  DATABASE_JOBS_URL: z.url(),
  /** Modules turned on, comma separated (D-007). Empty: none. */
  MODULES_ENABLED: z.string().default(''),
  /** Bearer token for POST /v1/internal/jobs/:id/run. Without it the route is off. */
  CRON_SECRET: z.string().min(32).optional(),
  /** Global push kill switch (P-007, decision A). */
  PUSH_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Web Push (VAPID): same names as the legacy app. Generate with `npx web-push generate-vapid-keys`.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  /** Optional Expo access token (push security enabled in the Expo project). */
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  /** Time zone of votes and job schedules (D-020). */
  VOTING_TIMEZONE: z.string().default('America/Sao_Paulo'),
});

export type Env = z.output<typeof EnvSchema>;

/** Validates the environment at boot. Error messages name the variable, never its value. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new Error(`Invalid environment: ${names}`);
  }
  return result.data;
}
