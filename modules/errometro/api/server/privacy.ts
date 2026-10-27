// LGPD (Sprint 19): what the Errômetro keeps about a person in a community. Votes never come in: nothing links
// them to anyone (R-ANON-03). Erasing takes the participation, the token gate rows and the comments by and about
// the person; votes and frozen results that name the person as a target keep an id that no longer points to anyone.
import type { ModuleData } from '@erre/core/server';
import { and, eq, or } from '@erre/db';

import { comments, participants, tokenIssuances } from '../../db/schema';
import { memberTrophies } from './results';

export const errometroData: ModuleData = {
  async export({ tx, communityId }, userId) {
    const [participation] = await tx
      .select({
        status: participants.status,
        requestedAt: participants.requestedAt,
        reviewedAt: participants.reviewedAt,
      })
      .from(participants)
      .where(and(eq(participants.communityId, communityId), eq(participants.userId, userId)));
    const written = await tx
      .select({
        period: comments.period,
        text: comments.text,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(and(eq(comments.communityId, communityId), eq(comments.authorId, userId)));
    const trophies = await memberTrophies(tx, communityId, userId);
    if (!participation && written.length === 0 && !trophies) return null;
    return {
      participation: participation ?? null,
      // Who a comment was about is someone else's data: only the round and the text.
      comments: written,
      trophies: trophies ?? [],
    };
  },

  async delete({ tx, communityId }, userId) {
    await tx
      .delete(participants)
      .where(and(eq(participants.communityId, communityId), eq(participants.userId, userId)));
    await tx
      .delete(tokenIssuances)
      .where(and(eq(tokenIssuances.communityId, communityId), eq(tokenIssuances.userId, userId)));
    await tx
      .delete(comments)
      .where(
        and(eq(comments.communityId, communityId), or(eq(comments.authorId, userId), eq(comments.targetId, userId))),
      );
  },
};
