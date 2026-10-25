// Test helpers for packages that use the database: disposable databases and schema drift checks.
// Never point DATABASE_ADMIN_URL at a production server: these helpers create and drop databases.
import { randomBytes } from 'node:crypto';

import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import pg from 'pg';

import { bootstrapRoles, withCredentials } from './bootstrap';
import { discoverSources, migrate, type MigrationSource } from './migrations';

export const DEFAULT_ADMIN_URL = 'postgres://postgres:postgres@localhost:5432/postgres';

/** Test role passwords. Roles are cluster-wide, so every test database shares them. */
export const TEST_PASSWORDS = { migrator: 'erre_migrator', app: 'erre_app', jobs: 'erre_jobs' } as const;

export type TestDatabaseUrls = { admin: string; migrator: string; app: string; jobs: string };
export type TestDatabase = { name: string; urls: TestDatabaseUrls; drop: () => Promise<void> };

async function adminQuery(url: string, text: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

// Parallel test runs (turbo runs packages concurrently) can race on the cluster-wide roles.
const RETRYABLE = new Set(['42710', '23505', 'XX000', '40001']);

async function bootstrapWithRetry(url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await bootstrapRoles(url, TEST_PASSWORDS);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (attempt >= 5 || !RETRYABLE.has(code)) throw err;
      await new Promise((r) => setTimeout(r, 100 * attempt));
    }
  }
}

/**
 * Creates a fresh database, bootstraps the roles and applies every migration of the workspace
 * (plus `extraSources`, e.g. test-only tables).
 */
export async function createTestDatabase({
  root,
  extraSources = [],
  skipMigrations = false,
  name: fixedName,
  adminUrl = process.env.DATABASE_ADMIN_URL ?? DEFAULT_ADMIN_URL,
}: {
  root: string;
  extraSources?: MigrationSource[];
  /** Only create the database and the grants (for testing the migration runner itself). */
  skipMigrations?: boolean;
  /**
   * Fixed name (lowercase letters, digits, underscores), dropped first if it exists. For long-running test
   * servers that may be killed without cleanup (e2e). Default: a random erre_test_* name.
   */
  name?: string;
  adminUrl?: string;
}): Promise<TestDatabase> {
  if (fixedName !== undefined && !/^erre_[a-z0-9_]+$/.test(fixedName)) throw new Error('invalid test database name');
  const name = fixedName ?? `erre_test_${randomBytes(6).toString('hex')}`;
  if (fixedName) await adminQuery(adminUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await adminQuery(adminUrl, `CREATE DATABASE ${name}`);
  const dbUrl = new URL(adminUrl);
  dbUrl.pathname = `/${name}`;
  const admin = dbUrl.toString();
  const urls: TestDatabaseUrls = {
    admin,
    migrator: withCredentials(admin, 'erre_migrator', TEST_PASSWORDS.migrator),
    app: withCredentials(admin, 'erre_app', TEST_PASSWORDS.app),
    jobs: withCredentials(admin, 'erre_jobs', TEST_PASSWORDS.jobs),
  };
  const drop = () => adminQuery(adminUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  try {
    await bootstrapWithRetry(admin);
    if (!skipMigrations) await migrate(urls.migrator, [...discoverSources(root), ...extraSources]);
  } catch (err) {
    await drop();
    throw err;
  }
  return { name, urls, drop };
}

function normalizeType(t: string): string {
  return t
    .toLowerCase()
    .replace(/^varchar/, 'character varying')
    .replace(/^char\b/, 'character')
    .replace(/^bigserial$/, 'bigint')
    .replace(/^serial$/, 'integer')
    .replace(/^smallserial$/, 'smallint')
    .replace(/^timestamp( \(\d\))?$/, 'timestamp$1 without time zone')
    .replace(/^timestamp \((\d)\)/, 'timestamp($1)')
    .replace(/^time( \(\d\))?$/, 'time$1 without time zone')
    .replace(/\s+/g, ' ');
}

/**
 * Compares Drizzle table definitions with the real database (columns, types, nullability, named indexes
 * and unique constraints). Returns the differences; an empty list means the schema matches.
 */
export async function schemaDifferences(url: string, tables: PgTable[]): Promise<string[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const problems: string[] = [];
    for (const table of tables) {
      const cfg = getTableConfig(table);
      const { rows: cols } = await client.query<{ name: string; type: string; notnull: boolean }>(
        `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull
           FROM pg_attribute a
          WHERE a.attrelid = to_regclass($1) AND a.attnum > 0 AND NOT a.attisdropped`,
        [cfg.name],
      );
      if (cols.length === 0) {
        problems.push(`${cfg.name}: table not found`);
        continue;
      }
      const dbCols = new Map(cols.map((c) => [c.name, c]));
      for (const col of cfg.columns) {
        const db = dbCols.get(col.name);
        if (!db) {
          problems.push(`${cfg.name}.${col.name}: missing in the database`);
          continue;
        }
        dbCols.delete(col.name);
        if (normalizeType(col.getSQLType()) !== normalizeType(db.type)) {
          problems.push(`${cfg.name}.${col.name}: type ${col.getSQLType()} in Drizzle, ${db.type} in the database`);
        }
        if (col.notNull !== db.notnull) {
          problems.push(`${cfg.name}.${col.name}: notNull ${col.notNull} in Drizzle, ${db.notnull} in the database`);
        }
      }
      for (const extra of dbCols.keys()) problems.push(`${cfg.name}.${extra}: missing in Drizzle`);

      const names = [...cfg.indexes.map((i) => i.config.name), ...cfg.uniqueConstraints.map((u) => u.getName())].filter(
        (n): n is string => !!n,
      );
      if (names.length) {
        const { rows } = await client.query<{ relname: string }>(
          `SELECT relname FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'i'`,
          [names],
        );
        const found = new Set(rows.map((r) => r.relname));
        for (const n of names) if (!found.has(n)) problems.push(`${cfg.name}: index or constraint ${n} not found`);
      }
    }
    return problems;
  } finally {
    await client.end();
  }
}
