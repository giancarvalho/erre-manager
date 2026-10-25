import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const SCRIPT = fileURLToPath(new URL('../scripts/db-bootstrap-roles.sql', import.meta.url));

export type RolePasswords = { migrator: string; app: string; jobs: string };

/** Fills psql-style `:'name'` variables with quoted literals, so the same file works in psql and here. */
export function fillPsqlVariables(sqlText: string, vars: Record<string, string>): string {
  return sqlText.replace(/:'(\w+)'/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`missing variable ${name}`);
    return `'${value.replaceAll("'", "''")}'`;
  });
}

/** Creates or updates the erre_* roles and grants on the database of `adminUrl` (local/dev; see the SQL file). */
export async function bootstrapRoles(adminUrl: string, passwords: RolePasswords): Promise<void> {
  const text = fillPsqlVariables(await readFile(SCRIPT, 'utf8'), {
    migrator_password: passwords.migrator,
    app_password: passwords.app,
    jobs_password: passwords.jobs,
  });
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

/** Replaces user and password in a connection URL (keeps host, port, database and options). */
export function withCredentials(url: string, user: string, password: string): string {
  const u = new URL(url);
  u.username = encodeURIComponent(user);
  u.password = encodeURIComponent(password);
  return u.toString();
}
