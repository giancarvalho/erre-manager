import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export type Db = NodePgDatabase & { $client: pg.Pool };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type DbOptions = { max?: number; applicationName?: string };

/**
 * Opens a pool. The API uses two: `erre_app` for requests and per-community jobs, and `erre_jobs`
 * only to list communities (ARQUITETURA §4.3). Modules never call this: they get a `tx` from the core.
 */
export function createDb(url: string, { max = 10, applicationName = 'erre' }: DbOptions = {}): Db {
  const pool = new pg.Pool({ connectionString: url, max, application_name: applicationName });
  return drizzle({ client: pool });
}

export async function closeDb(db: Db): Promise<void> {
  await db.$client.end();
}
