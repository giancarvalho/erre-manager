// Tables of Mural de avisos. Every table is per community: created with createTenantTable (adds community_id and is
// covered by RLS), named "avisos_<something>", listed in `tables` and created by a migration in db/migrations.
// The contract test fails if this file and the migrations disagree.
import { createTenantTable } from '@erre/db';
import { index, text, timestamp, uuid } from '@erre/db/pg-core';

/** One notice on the community board. `createdBy` is the author (erased with the person, see api/server/privacy.ts). */
export const posts = createTenantTable(
  'avisos_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Indexes always start with community_id. The list is newest first; LGPD looks up by author.
  (t) => [
    index('avisos_posts_community_created_idx').on(t.communityId, t.createdAt),
    index('avisos_posts_community_author_idx').on(t.communityId, t.createdBy),
  ],
);

export const tables = [posts];
