export { closeDb, createDb, type Db, type DbOptions, type Tx } from './client';
export { communities, GLOBAL_TABLES } from './schema';
export { createTenantTable, isUuid, withTenantTx, type TenantContext } from './tenant';
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
export { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, not, or, sql } from 'drizzle-orm';
