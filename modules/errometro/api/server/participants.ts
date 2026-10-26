// Voting participation (legacy group_members.voting_status): request, moderation with the 50-voter cap, and
// the cascade from community membership. Ported from queridometro@7c5c5bf:
// src/infrastructure/groups/postgres-group.repository.ts (requestVotingAccess, moderateVotingMembership and
// the voting part of moderateMembership).
import type { Member, MembersApi } from '@erre/core/server';
import { and, count, eq, sql, type Tx } from '@erre/db';

import { MAX_PARTICIPANTS } from '../../domain/limits';
import { participants, type ParticipantStatus } from '../../db/schema';

export type ModerationAction = 'approve' | 'reject' | 'remove';

const TRANSITIONS: Record<ModerationAction, { from: ParticipantStatus; to: ParticipantStatus }> = {
  approve: { from: 'pending', to: 'approved' },
  reject: { from: 'pending', to: 'rejected' },
  remove: { from: 'approved', to: 'removed' },
};

/** Serializes approvals of one community so two at once can't pass the cap together. */
async function lockApprovals(tx: Tx, communityId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`errometro:participants:${communityId}`}, 0))`);
}

async function approvedCount(tx: Tx, communityId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(participants)
    .where(and(eq(participants.communityId, communityId), eq(participants.status, 'approved')));
  return row?.n ?? 0;
}

export async function getParticipation(tx: Tx, communityId: string, userId: string) {
  const [row] = await tx
    .select()
    .from(participants)
    .where(and(eq(participants.communityId, communityId), eq(participants.userId, userId)));
  return row ?? null;
}

/** Participation status plus whether the cap is full right now (to explain a waiting request). */
export async function participationView(tx: Tx, communityId: string, userId: string) {
  const row = await getParticipation(tx, communityId, userId);
  const approved = await approvedCount(tx, communityId);
  return {
    status: row?.status ?? null,
    approvedCount: approved,
    limit: MAX_PARTICIPANTS,
    full: approved >= MAX_PARTICIPANTS,
  };
}

/**
 * Approved participants who are still approved members (ctx.members): the voting targets. The module keeps
 * the two in sync through onMemberLeft; reading through ctx.members also covers anything the hook missed.
 */
export async function approvedParticipants(tx: Tx, communityId: string, members: MembersApi): Promise<Member[]> {
  const rows = await tx
    .select({ userId: participants.userId })
    .from(participants)
    .where(and(eq(participants.communityId, communityId), eq(participants.status, 'approved')));
  const ids = new Set(rows.map((r) => r.userId));
  return (await members.list()).filter((m) => ids.has(m.userId));
}

/** Every participation row with the member's name, for moderators (pending first, then by name). */
export async function listParticipants(tx: Tx, communityId: string, members: MembersApi) {
  const rows = await tx.select().from(participants).where(eq(participants.communityId, communityId));
  const byId = new Map((await members.list()).map((m) => [m.userId, m]));
  const order: Record<ParticipantStatus, number> = { pending: 0, approved: 1, rejected: 2, removed: 3 };
  return rows
    .flatMap((r) => {
      const m = byId.get(r.userId);
      return m
        ? [
            {
              userId: r.userId,
              displayName: m.displayName,
              avatarVariant: m.avatarVariant,
              status: r.status,
              requestedAt: r.requestedAt.toISOString(),
            },
          ]
        : [];
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

/**
 * An approved member asks to vote. Idempotent while pending or approved; rejected/removed ask again
 * (legacy requestVotingAccess). The caller guarantees an approved membership (requireCommunity).
 */
export async function requestParticipation(tx: Tx, communityId: string, userId: string) {
  const existing = await getParticipation(tx, communityId, userId);
  if (existing && (existing.status === 'pending' || existing.status === 'approved'))
    return { status: existing.status, justRequested: false };
  await tx
    .insert(participants)
    .values({ communityId, userId, status: 'pending' })
    .onConflictDoUpdate({
      target: [participants.communityId, participants.userId],
      set: { status: 'pending', requestedAt: sql`now()`, reviewedAt: null, reviewedBy: null },
    });
  return { status: 'pending' as const, justRequested: true };
}

export type ModerationResult =
  | { ok: true; status: ParticipantStatus }
  | { ok: false; code: 'NOT_FOUND' | 'INVALID_TRANSITION' | 'MEMBERSHIP_REQUIRED' | 'FULL' };

/** Moderates voting access (legacy moderateVotingMembership). Requires an approved membership. */
export async function moderateParticipation(
  tx: Tx,
  communityId: string,
  members: MembersApi,
  input: { userId: string; moderatorId: string; action: ModerationAction },
): Promise<ModerationResult> {
  const transition = TRANSITIONS[input.action];
  if (input.action === 'approve') await lockApprovals(tx, communityId);
  const current = await getParticipation(tx, communityId, input.userId);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  if (!(await members.isApprovedMember(input.userId))) return { ok: false, code: 'MEMBERSHIP_REQUIRED' };
  if (current.status !== transition.from) return { ok: false, code: 'INVALID_TRANSITION' };
  if (input.action === 'approve' && (await approvedCount(tx, communityId)) >= MAX_PARTICIPANTS)
    return { ok: false, code: 'FULL' };
  const updated = await tx
    .update(participants)
    .set({ status: transition.to, reviewedAt: sql`now()`, reviewedBy: input.moderatorId })
    .where(
      and(
        eq(participants.communityId, communityId),
        eq(participants.userId, input.userId),
        eq(participants.status, transition.from),
      ),
    )
    .returning({ status: participants.status });
  return updated[0] ? { ok: true, status: updated[0].status } : { ok: false, code: 'INVALID_TRANSITION' };
}

/**
 * Join intent "errometro.participar" (D-023, R-MEM-05): approving the community request approves the
 * voting too when there is room; when the cap is full the request waits as pending.
 */
export async function participateOnJoin(tx: Tx, communityId: string, userId: string, actorId: string) {
  await lockApprovals(tx, communityId);
  const full = (await approvedCount(tx, communityId)) >= MAX_PARTICIPANTS;
  const values = full
    ? { status: 'pending' as const, reviewedAt: null, reviewedBy: null }
    : { status: 'approved' as const, reviewedAt: new Date(), reviewedBy: actorId };
  await tx
    .insert(participants)
    .values({ communityId, userId, ...values })
    .onConflictDoUpdate({
      target: [participants.communityId, participants.userId],
      set: { ...values, requestedAt: sql`now()` },
    });
}

/**
 * The person left the community, was removed or had the request rejected (R-MEM-05): the voting goes along.
 * A pending request becomes rejected, an approved participation becomes removed.
 */
export async function participationOnLeave(tx: Tx, communityId: string, userId: string, actorId: string) {
  await tx
    .update(participants)
    .set({
      status: sql`CASE ${participants.status} WHEN 'pending' THEN 'rejected' ELSE 'removed' END`,
      reviewedAt: sql`now()`,
      reviewedBy: actorId,
    })
    .where(
      and(
        eq(participants.communityId, communityId),
        eq(participants.userId, userId),
        sql`${participants.status} IN ('pending', 'approved')`,
      ),
    );
}
