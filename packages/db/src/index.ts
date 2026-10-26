export { closeDb, createDb, type Db, type DbOptions, type Tx } from './client';
export { communities, GLOBAL_TABLES } from './schema';
export { createTenantTable, isUuid, NO_COMMUNITY, withTenantTx, withUserTx, type TenantContext } from './tenant';
export {
  discoverSources,
  loadMigrations,
  migrate,
  MigrationError,
  rollbackLast,
  type Migration,
  type MigrationSource,
} from './migrations';
export { bootstrapRoles, withCredentials, type RolePasswords } from './bootstrap';
// Query helpers re-exported so modules use the same Drizzle instance as the core.
export {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
