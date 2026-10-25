// Migration runner (PLANO, Sprint 4, task 6). Each owner (db, core, each module) has its own folder of
// `<owner>_<NNNN>_<description>.sql` files. Order: db → core → other owners alphabetically, then by number.
// A file may have a `-- migrate:down` section, used only by `rollbackLast` in development.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import pg from 'pg';

export type MigrationSource = { owner: string; dir: string };

export type Migration = {
  owner: string;
  seq: number;
  name: string;
  up: string;
  down: string | null;
  checksum: string;
};

export class MigrationError extends Error {
  override name = 'MigrationError';
}

const DOWN_MARKER = /^--\s*migrate:down\s*$/m;
const OWNER_RE = /^[a-z][a-z0-9]*$/;

export function ownerRank(owner: string): string {
  if (owner === 'db') return '0';
  if (owner === 'core') return '1';
  return `2${owner}`;
}

export function sortSources(sources: MigrationSource[]): MigrationSource[] {
  return [...sources].sort((a, b) => ownerRank(a.owner).localeCompare(ownerRank(b.owner)));
}

export function parseMigration(owner: string, file: string, content: string): Migration {
  if (!OWNER_RE.test(owner)) throw new MigrationError(`invalid owner "${owner}"`);
  const match = new RegExp(`^${owner}_(\\d{4})_[a-z0-9_]+\\.sql$`).exec(file);
  if (!match?.[1]) {
    throw new MigrationError(`${file}: expected name ${owner}_<NNNN>_<description>.sql (lowercase, underscores)`);
  }
  const [up = '', down] = content.split(DOWN_MARKER);
  if (!up.trim()) throw new MigrationError(`${file}: empty migration`);
  return {
    owner,
    seq: Number(match[1]),
    name: file,
    up,
    down: down?.trim() ? down : null,
    checksum: createHash('sha256').update(content).digest('hex'),
  };
}

export async function loadMigrations(sources: MigrationSource[]): Promise<Migration[]> {
  const owners = new Set<string>();
  const result: Migration[] = [];
  for (const source of sortSources(sources)) {
    if (owners.has(source.owner)) throw new MigrationError(`owner "${source.owner}" listed twice`);
    owners.add(source.owner);
    const files = (await readdir(source.dir)).filter((f) => f.endsWith('.sql')).sort();
    const seqs = new Set<number>();
    for (const file of files) {
      const m = parseMigration(source.owner, file, await readFile(path.join(source.dir, file), 'utf8'));
      if (seqs.has(m.seq)) throw new MigrationError(`${file}: number ${m.seq} used twice by ${m.owner}`);
      seqs.add(m.seq);
      result.push(m);
    }
  }
  return result;
}

/** Migration folders in the workspace: packages/db, packages/core and modules/<name>/db. */
export function discoverSources(root: string): MigrationSource[] {
  const candidates: MigrationSource[] = [
    { owner: 'db', dir: path.join(root, 'packages/db/migrations') },
    { owner: 'core', dir: path.join(root, 'packages/core/migrations') },
  ];
  const modulesDir = path.join(root, 'modules');
  if (existsSync(modulesDir)) {
    const names = readdirSync(modulesDir).filter((n) => statSync(path.join(modulesDir, n)).isDirectory());
    for (const name of names.sort()) {
      candidates.push({ owner: name, dir: path.join(modulesDir, name, 'db/migrations') });
    }
  }
  return sortSources(candidates.filter((s) => existsSync(s.dir)));
}

type Applied = { owner: string; name: string; checksum: string };

const LOCK_KEY = 'erre_migrations';

async function withClient<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, application_name: 'erre-migrate' });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS erre_migrations (
        owner text NOT NULL,
        name text NOT NULL,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner, name)
      );
      REVOKE ALL ON erre_migrations FROM erre_app, erre_jobs;
    `);
    return await fn(client);
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}

export type MigrateOptions = { log?: (message: string) => void };

/** Applies pending migrations, each in its own transaction. Run as erre_migrator. Returns the applied names. */
export async function migrate(
  url: string,
  sources: MigrationSource[],
  { log }: MigrateOptions = {},
): Promise<string[]> {
  const migrations = await loadMigrations(sources);
  return withClient(url, async (client) => {
    const { rows } = await client.query<Applied>('SELECT owner, name, checksum FROM erre_migrations');
    const applied = new Map(rows.map((r) => [r.name, r]));
    const onDisk = new Set(migrations.map((m) => m.name));
    const known = new Set(migrations.map((m) => m.owner));

    for (const r of rows) {
      if (known.has(r.owner) && !onDisk.has(r.name)) {
        throw new MigrationError(`${r.name} was applied but its file is missing`);
      }
    }

    const done: string[] = [];
    const maxApplied = new Map<string, number>();
    for (const m of migrations) {
      const prev = applied.get(m.name);
      if (prev) {
        if (prev.checksum !== m.checksum) {
          throw new MigrationError(`${m.name} changed after being applied; write a new migration instead`);
        }
        maxApplied.set(m.owner, Math.max(maxApplied.get(m.owner) ?? 0, m.seq));
      }
    }

    for (const m of migrations) {
      if (applied.has(m.name)) continue;
      if ((maxApplied.get(m.owner) ?? 0) > m.seq) {
        throw new MigrationError(`${m.name} is older than an applied migration of ${m.owner}; renumber it`);
      }
      try {
        await client.query('BEGIN');
        await client.query(m.up);
        await client.query('INSERT INTO erre_migrations (owner, name, checksum) VALUES ($1, $2, $3)', [
          m.owner,
          m.name,
          m.checksum,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new MigrationError(`${m.name} failed: ${(err as Error).message}`, { cause: err });
      }
      log?.(`applied ${m.name}`);
      done.push(m.name);
    }
    return done;
  });
}

/** Development only: reverts the last applied migration of an owner using its `-- migrate:down` section. */
export async function rollbackLast(url: string, sources: MigrationSource[], owner: string): Promise<string> {
  const migrations = await loadMigrations(sources);
  return withClient(url, async (client) => {
    const { rows } = await client.query<Applied>(
      'SELECT owner, name, checksum FROM erre_migrations WHERE owner = $1 ORDER BY name DESC LIMIT 1',
      [owner],
    );
    const last = rows[0];
    if (!last) throw new MigrationError(`no applied migration for ${owner}`);
    const m = migrations.find((x) => x.name === last.name);
    if (!m) throw new MigrationError(`${last.name}: file not found`);
    if (!m.down) throw new MigrationError(`${m.name} has no -- migrate:down section`);
    try {
      await client.query('BEGIN');
      await client.query(m.down);
      await client.query('DELETE FROM erre_migrations WHERE owner = $1 AND name = $2', [owner, m.name]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new MigrationError(`rollback of ${m.name} failed: ${(err as Error).message}`, { cause: err });
    }
    return m.name;
  });
}
