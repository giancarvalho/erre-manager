import { createTenantTable } from '@erre/db';
import { integer, primaryKey, text, timestamp, uuid } from '@erre/db/pg-core';

export const items = createTenantTable('contratoteste_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const participants = createTenantTable(
  'contratoteste_participants',
  { userId: uuid('user_id').notNull() },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })],
);

export const jobRuns = createTenantTable('contratoteste_job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemsSeen: integer('items_seen').notNull(),
  ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tables = [items, participants, jobRuns];
