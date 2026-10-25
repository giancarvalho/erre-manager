import { sql, type BuildExtraConfigColumns } from 'drizzle-orm';
import {
  index,
  pgTable,
  unique,
  uuid,
  type AnyPgColumn,
  type PgColumnBuilderBase,
  type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core';

import type { Db, Tx } from './client';
import { communities } from './schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_RE.test(value);

const tenantColumns = () => ({
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id),
});
type TenantColumns<T extends Record<string, PgColumnBuilderBase>> = ReturnType<typeof tenantColumns> & T;

/**
 * Drizzle definition of a community table: adds `communityId` (FK to communities), the index on it
 * and UNIQUE (community_id, id) when there is an `id` column.
 *
 * The database side (RLS enabled and forced, isolation policy) comes from the migration, which must
 * call `SELECT erre_tenant_table('<name>')` right after CREATE TABLE. The RLS coverage and schema
 * drift tests catch a table that skips either half.
 */
export function createTenantTable<TName extends string, TColumns extends Record<string, PgColumnBuilderBase>>(
  name: TName,
  columns: TColumns,
  extraConfig?: (self: BuildExtraConfigColumns<TName, TenantColumns<TColumns>, 'pg'>) => PgTableExtraConfigValue[],
) {
  const all = { ...tenantColumns(), ...columns } as TenantColumns<TColumns>;
  return pgTable(name, all, (t) => {
    const config: PgTableExtraConfigValue[] = [index(`${name}_community_id_idx`).on(t.communityId)];
    const id = (t as Record<string, AnyPgColumn | undefined>).id;
    if (id) config.push(unique(`${name}_community_id_id_key`).on(t.communityId, id));
    return [...config, ...(extraConfig?.(t) ?? [])];
  });
}

export type TenantContext = {
  communityId: string;
  /** Absent in anonymous routes: app.user_id stays empty and any policy that reads it fails closed. */
  userId?: string | null;
};

/**
 * Runs `fn` in a transaction scoped to one community. `app.community_id` and `app.user_id` are set with
 * `set_config(..., true)`, local to the transaction, so nothing leaks to the next use of the connection.
 * The caller must already have validated the community (core middleware, or the blind signature in
 * anonymous routes).
 */
export async function withTenantTx<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!isUuid(ctx.communityId)) throw new TypeError('withTenantTx: communityId must be a uuid');
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.community_id', ${ctx.communityId}, true), set_config('app.user_id', ${ctx.userId ?? ''}, true)`,
    );
    return fn(tx);
  });
}

/** No community has this id (gen_random_uuid never returns it). Used by withUserTx. */
export const NO_COMMUNITY = '00000000-0000-0000-0000-000000000000';

/**
 * Transaction scoped to a person, not to a community: `app.user_id` is set and `app.community_id` is the
 * nil uuid, so community policies match nothing while policies on the person's own rows (e.g. "my
 * memberships") work. Unset settings still fail closed.
 */
export async function withUserTx<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!isUuid(userId)) throw new TypeError('withUserTx: userId must be a uuid');
  return withTenantTx(db, { communityId: NO_COMMUNITY, userId }, fn);
}
