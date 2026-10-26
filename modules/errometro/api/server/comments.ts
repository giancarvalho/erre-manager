// Comments on a member's result in a round. Ported from queridometro@7c5c5bf:src/app/actions/comments.ts and
// src/infrastructure/comments/postgres-comment.repository.ts. The author's name is read from the members on
// every read (not stored), so a renamed member shows the new name.
import type { MembersApi } from '@erre/core/server';
import { and, asc, eq, sql, type Tx } from '@erre/db';

import { comments } from '../../db/schema';

export const COMMENT_MAX_LENGTH = 280;

/** Shown for comments whose author is no longer a member (the legacy kept the name stored). */
export const FORMER_MEMBER_NAME = 'Ex-membro';

type Row = typeof comments.$inferSelect;

function view(row: Row, names: Map<string, string>) {
  return {
    id: row.id,
    targetId: row.targetId,
    authorId: row.authorId,
    authorName: names.get(row.authorId) ?? FORMER_MEMBER_NAME,
    period: row.period,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

async function names(members: MembersApi) {
  return new Map((await members.list()).map((m) => [m.userId, m.displayName]));
}

export async function listComments(
  tx: Tx,
  communityId: string,
  members: MembersApi,
  input: { targetId: string; period: string },
) {
  const rows = await tx
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.communityId, communityId),
        eq(comments.targetId, input.targetId),
        eq(comments.period, input.period),
      ),
    )
    .orderBy(asc(comments.createdAt));
  const byId = await names(members);
  return rows.map((r) => view(r, byId));
}

export async function addComment(
  tx: Tx,
  communityId: string,
  members: MembersApi,
  input: { authorId: string; targetId: string; period: string; text: string },
) {
  const [row] = await tx
    .insert(comments)
    .values({ communityId, ...input })
    .returning();
  return view(row!, await names(members));
}

/** Only the author edits. Null when not found or not theirs. */
export async function editComment(
  tx: Tx,
  communityId: string,
  members: MembersApi,
  input: { id: string; authorId: string; text: string },
) {
  const [row] = await tx
    .update(comments)
    .set({ text: input.text, updatedAt: sql`now()` })
    .where(and(eq(comments.communityId, communityId), eq(comments.id, input.id), eq(comments.authorId, input.authorId)))
    .returning();
  return row ? view(row, await names(members)) : null;
}

/** The author, or a moderator of this community (legacy: the group's creator), deletes. */
export async function deleteComment(
  tx: Tx,
  communityId: string,
  input: { id: string; actorId: string; isModerator: boolean },
) {
  const rows = await tx
    .delete(comments)
    .where(
      and(
        eq(comments.communityId, communityId),
        eq(comments.id, input.id),
        ...(input.isModerator ? [] : [eq(comments.authorId, input.actorId)]),
      ),
    )
    .returning({ id: comments.id });
  return rows.length > 0;
}
