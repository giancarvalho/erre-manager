import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Tenant anchor (migration db_0001). Global table: no community_id, no RLS. */
export const communities = pgTable('communities', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tables without community_id. Adding a global table means adding it here on purpose;
 * the RLS coverage test fails for any other table without community_id.
 */
export const GLOBAL_TABLES: ReadonlySet<string> = new Set(['communities', 'erre_migrations']);
