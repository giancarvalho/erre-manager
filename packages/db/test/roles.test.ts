import { describe, expect, it, inject } from 'vitest';
import pg from 'pg';

const urls = inject('db');

async function query<T extends pg.QueryResultRow>(url: string, text: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<T>(text)).rows;
  } finally {
    await client.end();
  }
}

describe('database roles', () => {
  it('erre_app is not superuser, has no BYPASSRLS and owns nothing', async () => {
    const [role] = await query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }>(
      urls.app,
      'SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = current_user',
    );
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false });
    const owned = await query(
      urls.admin,
      "SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname IN ('erre_app', 'erre_jobs')",
    );
    expect(owned).toEqual([]);
  });

  it('erre_app cannot create tables, change RLS or read the migrations table', async () => {
    await expect(query(urls.app, 'CREATE TABLE intruso (id int)')).rejects.toThrow(/permission denied/);
    await expect(query(urls.app, 'ALTER TABLE test_tenant_items DISABLE ROW LEVEL SECURITY')).rejects.toThrow(
      /must be owner/,
    );
    await expect(query(urls.app, 'SELECT * FROM erre_migrations')).rejects.toThrow(/permission denied/);
    await expect(query(urls.app, "SELECT erre_tenant_table('communities')")).rejects.toThrow(/permission denied/);
  });

  it('erre_jobs only reads communities', async () => {
    await expect(query(urls.jobs, 'SELECT id FROM communities')).resolves.toBeInstanceOf(Array);
    // Checked through the catalog: a plain SELECT fails earlier, at planning, on the unset app.community_id.
    const [priv] = await query<{ select: boolean; insert: boolean }>(
      urls.jobs,
      "SELECT has_table_privilege('test_tenant_items', 'SELECT') AS select, has_table_privilege('communities', 'INSERT') AS insert",
    );
    expect(priv).toEqual({ select: false, insert: false });
    await expect(
      query(
        urls.jobs,
        "SET app.community_id = '00000000-0000-0000-0000-000000000000'; SELECT * FROM test_tenant_items",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(query(urls.jobs, "INSERT INTO communities (slug, name) VALUES ('j', 'J')")).rejects.toThrow(
      /permission denied/,
    );
  });
});
