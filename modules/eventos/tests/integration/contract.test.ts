import { moduleProblems } from '@erre/core/server';
import { tablePrefixProblems } from '@erre/core/testing';
import { schemaDifferences } from '@erre/db/testing';
import pg from 'pg';
import { describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { tables } from '../../db/schema';
import manifest from '../../manifest';

async function query<T extends pg.QueryResultRow>(text: string, params: unknown[]): Promise<T[]> {
  const client = new pg.Client({ connectionString: inject('db').admin });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

const columns = async (table: string) =>
  (
    await query<{ column_name: string }>(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [table],
    )
  ).map((r) => r.column_name);

describe('eventos module contract', () => {
  it('passes the boot validation', () => {
    expect(moduleProblems([moduleApi])).toEqual([]);
  });

  it('every table has the module prefix', () => {
    expect(tablePrefixProblems(manifest, tables)).toEqual([]);
  });

  it('the Drizzle schema matches the migration', async () => {
    expect(await schemaDifferences(inject('db').admin, tables)).toEqual([]);
  });

  it('anonymity by schema: issuances have no timestamp and votes have no person (R-ANON-02, R-ANON-03)', async () => {
    expect(await columns('eventos_token_issuances')).toEqual(['community_id', 'user_id', 'event_id']);
    expect(await columns('eventos_votes')).toEqual([
      'community_id',
      'event_id',
      'voter_tag',
      'target_id',
      'emoji_id',
      'value',
      'voted_at',
    ]);
  });

  it('children reference the event by (community_id, event_id) (D-015)', async () => {
    const fks = await query<{ table_name: string; columns: string }>(
      `SELECT c.conrelid::regclass::text AS table_name,
              (SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(n, ord)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS columns
         FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = 'eventos_events'::regclass
        ORDER BY 1`,
      [],
    );
    expect(fks.map((f) => f.columns)).toEqual(Array(7).fill('community_id,event_id'));
  });
});
