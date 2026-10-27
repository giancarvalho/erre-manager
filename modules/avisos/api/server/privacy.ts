// LGPD (docs/lgpd.md): what Mural de avisos keeps about a person in a community, and how to erase it. The core calls
// this in every community of the person.
//
// avisos_posts: the notices the person wrote (title and free text, with them as author). Exported and, on erasure,
// deleted: free text written by someone is theirs (same rule as the Errômetro comments), even though the
// community loses the notice. Nothing else in this module is about a person (no reads, no reactions).
import type { ModuleData } from '@erre/core/server';
import { and, asc, eq } from '@erre/db';

import { posts } from '../../db/schema';

export const avisosData: ModuleData = {
  async export({ tx, communityId }, userId) {
    const written = await tx
      .select({ title: posts.title, body: posts.body, createdAt: posts.createdAt })
      .from(posts)
      .where(and(eq(posts.communityId, communityId), eq(posts.createdBy, userId)))
      .orderBy(asc(posts.createdAt));
    return written.length ? { avisosPublicados: written } : null;
  },

  async delete({ tx, communityId }, userId) {
    await tx.delete(posts).where(and(eq(posts.communityId, communityId), eq(posts.createdBy, userId)));
  },
};
