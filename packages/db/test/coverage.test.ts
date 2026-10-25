import pg from 'pg';
import { describe, expect, it, inject } from 'vitest';

import { GLOBAL_TABLES } from '../src/schema';
import { schemaDifferences } from '../src/testing';
import { communities } from '../src/schema';
import { testTenantItems } from './schema';

const urls = inject('db');

type TableInfo = {
  name: string;
  has_community_id: boolean;
  rls: boolean;
  force: boolean;
  policies: number;
  fk_to_communities: boolean;
  community_index: boolean;
};

async function tables(): Promise<TableInfo[]> {
  const client = new pg.Client({ connectionString: urls.admin });
  await client.connect();
  try {
    const { rows } = await client.query<TableInfo>(`
      SELECT c.relname AS name,
             EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'community_id' AND NOT a.attisdropped) AS has_community_id,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS force,
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
             EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f'
                       AND k.confrelid = 'communities'::regclass) AS fk_to_communities,
             EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                      WHERE i.indrelid = c.oid AND a.attname = 'community_id') AS community_index
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       ORDER BY 1`);
    return rows;
  } finally {
    await client.end();
  }
}

describe('RLS coverage', () => {
  it('every table with community_id has forced RLS, a policy, an FK to communities and an index', async () => {
    const tenant = (await tables()).filter((t) => t.has_community_id);
    expect(tenant.length).toBeGreaterThan(0);
    for (const t of tenant) {
      expect({ table: t.name, rls: t.rls, force: t.force, fk: t.fk_to_communities, index: t.community_index }).toEqual({
        table: t.name,
        rls: true,
        force: true,
        fk: true,
        index: true,
      });
      expect(t.policies, t.name).toBeGreaterThan(0);
    }
  });

  it('every table without community_id is in the global allowlist', async () => {
    const global = (await tables()).filter((t) => !t.has_community_id).map((t) => t.name);
    expect(global.filter((name) => !GLOBAL_TABLES.has(name))).toEqual([]);
  });
});

describe('schema drift', () => {
  it('Drizzle definitions match the migrations', async () => {
    expect(await schemaDifferences(urls.admin, [communities, testTenantItems])).toEqual([]);
  });
});
