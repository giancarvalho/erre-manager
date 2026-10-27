// pnpm --filter @erre/db db:bootstrap | db:migrate | db:rollback <owner>
// Local and development databases only. Production is run by a human (AGENTS.md, rule 1).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootstrapRoles } from './bootstrap';
import { discoverSources, migrate, rollbackLast } from './migrations';

// MIGRATIONS_ROOT: folder laid out like the repo (packages/*/migrations, modules/*/db/migrations). Set by the
// migrate image (apps/api/Dockerfile), where this file is bundled and no longer sits inside the repo.
const root = process.env.MIGRATIONS_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see packages/db/.env.example)`);
  return value;
}

function isLocal(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'postgres';
}

function password(name: string, role: string, url: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isLocal(url)) return role;
  throw new Error(`${name} is required outside localhost`);
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  if (command === 'bootstrap') {
    const url = env('DATABASE_ADMIN_URL');
    await bootstrapRoles(url, {
      migrator: password('ERRE_MIGRATOR_PASSWORD', 'erre_migrator', url),
      app: password('ERRE_APP_PASSWORD', 'erre_app', url),
      jobs: password('ERRE_JOBS_PASSWORD', 'erre_jobs', url),
    });
    console.warn('roles ok');
  } else if (command === 'migrate') {
    const applied = await migrate(env('DATABASE_MIGRATOR_URL'), discoverSources(root), { log: console.warn });
    console.warn(applied.length ? `${applied.length} migration(s) applied` : 'up to date');
  } else if (command === 'rollback' && arg) {
    console.warn(`reverted ${await rollbackLast(env('DATABASE_MIGRATOR_URL'), discoverSources(root), arg)}`);
  } else {
    console.error('usage: cli.ts bootstrap | migrate | rollback <owner>');
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
