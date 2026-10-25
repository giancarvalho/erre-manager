import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { fillPsqlVariables, withCredentials } from '../src/bootstrap';
import { migrate, parseMigration, rollbackLast, sortSources, type MigrationSource } from '../src/migrations';
import { createTestDatabase, type TestDatabase } from '../src/testing';
import { root } from './global-setup';

describe('migration files', () => {
  it('parses name, number and down section', () => {
    const m = parseMigration('core', 'core_0002_add_x.sql', 'CREATE TABLE x();\n-- migrate:down\nDROP TABLE x;\n');
    expect(m).toMatchObject({ owner: 'core', seq: 2, name: 'core_0002_add_x.sql' });
    expect(m.up.trim()).toBe('CREATE TABLE x();');
    expect(m.down?.trim()).toBe('DROP TABLE x;');
  });

  it.each(['core_2_x.sql', 'errometro_0001_x.sql', 'core_0001_Add.sql', 'core_0001-x.sql'])('rejects %s', (file) => {
    expect(() => parseMigration('core', file, 'SELECT 1;')).toThrow(/expected name/);
  });

  it('orders db, core, then modules alphabetically', () => {
    const s = (owner: string): MigrationSource => ({ owner, dir: owner });
    expect(sortSources([s('eventos'), s('core'), s('errometro'), s('db')]).map((x) => x.owner)).toEqual([
      'db',
      'core',
      'errometro',
      'eventos',
    ]);
  });

  it('fills psql variables with escaped literals', () => {
    expect(fillPsqlVariables("SELECT :'a', :'b';", { a: "it's", b: 'x' })).toBe("SELECT 'it''s', 'x';");
    expect(() => fillPsqlVariables(":'missing'", {})).toThrow(/missing/);
  });

  it('replaces credentials in a URL', () => {
    expect(withCredentials('postgres://u:p@h:5432/d?ssl=1', 'erre_app', 'p@ss')).toBe(
      'postgres://erre_app:p%40ss@h:5432/d?ssl=1',
    );
  });
});

describe('migration runner', () => {
  let db: TestDatabase;
  let dir: string;
  const source = (): MigrationSource[] => [{ owner: 'demo', dir }];
  const write = (name: string, body: string) => writeFile(path.join(dir, name), body);

  async function tablesNamed(prefix: string): Promise<string[]> {
    const client = new pg.Client({ connectionString: db.urls.admin });
    await client.connect();
    try {
      const { rows } = await client.query<{ t: string }>(
        "SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE $1 ORDER BY 1",
        [`${prefix}%`],
      );
      return rows.map((r) => r.t);
    } finally {
      await client.end();
    }
  }

  beforeAll(async () => {
    db = await createTestDatabase({ root, skipMigrations: true });
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'erre-mig-'));
    return () => rm(dir, { recursive: true, force: true });
  });

  it('applies in order, once, and rolls back with the down section', async () => {
    await write('demo_0001_a.sql', 'CREATE TABLE demo_a (id int);\n-- migrate:down\nDROP TABLE demo_a;');
    await write('demo_0002_b.sql', 'CREATE TABLE demo_b (id int);\n-- migrate:down\nDROP TABLE demo_b;');
    expect(await migrate(db.urls.migrator, source())).toEqual(['demo_0001_a.sql', 'demo_0002_b.sql']);
    expect(await migrate(db.urls.migrator, source())).toEqual([]);
    expect(await tablesNamed('demo_')).toEqual(['demo_a', 'demo_b']);

    expect(await rollbackLast(db.urls.migrator, source(), 'demo')).toBe('demo_0002_b.sql');
    expect(await tablesNamed('demo_')).toEqual(['demo_a']);
    expect(await rollbackLast(db.urls.migrator, source(), 'demo')).toBe('demo_0001_a.sql');
    expect(await tablesNamed('demo_')).toEqual([]);
  });

  it('refuses an applied migration that was edited', async () => {
    await write('demo_0001_c.sql', 'CREATE TABLE demo_c (id int);\n-- migrate:down\nDROP TABLE demo_c;');
    await migrate(db.urls.migrator, source());
    await write('demo_0001_c.sql', 'CREATE TABLE demo_c (id bigint);');
    await expect(migrate(db.urls.migrator, source())).rejects.toThrow(/changed after being applied/);
    await write('demo_0001_c.sql', 'CREATE TABLE demo_c (id int);\n-- migrate:down\nDROP TABLE demo_c;');
    await rollbackLast(db.urls.migrator, source(), 'demo');
  });

  it('refuses a migration numbered before an applied one', async () => {
    await write('demo_0005_e.sql', 'CREATE TABLE demo_e (id int);\n-- migrate:down\nDROP TABLE demo_e;');
    await migrate(db.urls.migrator, source());
    await write('demo_0004_d.sql', 'CREATE TABLE demo_d (id int);');
    await expect(migrate(db.urls.migrator, source())).rejects.toThrow(/older than an applied/);
    await rm(path.join(dir, 'demo_0004_d.sql'));
    await rollbackLast(db.urls.migrator, source(), 'demo');
  });

  it('leaves nothing behind when a migration fails', async () => {
    await write('demo_0001_f.sql', 'CREATE TABLE demo_f (id int);\nSELECT 1/0;');
    await expect(migrate(db.urls.migrator, source())).rejects.toThrow(/demo_0001_f.sql failed: division by zero/);
    expect(await tablesNamed('demo_')).toEqual([]);
  });

  it('refuses a tenant table without community_id', async () => {
    const tenant: MigrationSource[] = [
      { owner: 'db', dir: path.join(root, 'packages/db/migrations') },
      { owner: 'demo', dir },
    ];
    await write('demo_0001_g.sql', "CREATE TABLE demo_g (id uuid);\nSELECT erre_tenant_table('demo_g');");
    await expect(migrate(db.urls.migrator, tenant)).rejects.toThrow(/community_id uuid NOT NULL is required/);
  });
});
