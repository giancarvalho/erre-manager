import { moduleProblems } from '@erre/core/server';
import { tablePrefixProblems } from '@erre/core/testing';
import { schemaDifferences } from '@erre/db/testing';
import pg from 'pg';
import { describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { tables } from '../../db/schema';
import manifest from '../../manifest';

async function columns(table: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: inject('db').admin });
  await client.connect();
  try {
    const { rows } = await client.query<{ column_name: string }>(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [table],
    );
    return rows.map((r) => r.column_name);
  } finally {
    await client.end();
  }
}

describe('errometro module contract', () => {
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
    expect(await columns('errometro_token_issuances')).toEqual(['community_id', 'user_id', 'period']);
    const voteColumns = await columns('errometro_votes');
    expect(voteColumns).not.toContain('user_id');
    expect(voteColumns).toEqual(['community_id', 'period', 'voter_tag', 'target_id', 'emoji_id', 'voted_at']);
  });
});
