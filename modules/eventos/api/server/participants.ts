// Event participation: members sign up while the event is live; participants vote and are targets
// (R-EVT-07). Ported from queridometro@7c5c5bf:src/lib/events/event-participation.ts, with P-014 provisionally
// answered B: only approved members of the community take part (no participation on visit, no pending
// membership created by the event link).
import type { Member, MembersApi } from '@erre/core/server';
import { and, eq, inArray, sql, type Tx } from '@erre/db';

import { events, participants } from '../../db/schema';
import { liveEvent, type EventRow } from './events';

export async function isParticipant(tx: Tx, communityId: string, eventId: string, userId: string) {
  const [row] = await tx
    .select({ userId: participants.userId })
    .from(participants)
    .where(
      and(
        eq(participants.communityId, communityId),
        eq(participants.eventId, eventId),
        eq(participants.userId, userId),
      ),
    );
  return row !== undefined;
}

export async function participantIds(tx: Tx, communityId: string, eventId: string): Promise<string[]> {
  const rows = await tx
    .select({ userId: participants.userId })
    .from(participants)
    .where(and(eq(participants.communityId, communityId), eq(participants.eventId, eventId)));
  return rows.map((r) => r.userId);
}

/** Participants who are still approved members, alphabetical: the targets of the ballot. */
export async function participantMembers(
  tx: Tx,
  communityId: string,
  eventId: string,
  members: MembersApi,
): Promise<Member[]> {
  const ids = new Set(await participantIds(tx, communityId, eventId));
  return (await members.list())
    .filter((m) => ids.has(m.userId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

/** Signing up is possible while the event is live (accepting applications or open). Idempotent. */
export async function signUp(tx: Tx, communityId: string, event: EventRow, userId: string) {
  if (event.status !== 'accepting_applications' && event.status !== 'open') return false;
  await tx.insert(participants).values({ communityId, eventId: event.id, userId }).onConflictDoNothing();
  return true;
}

/**
 * Join intent "eventos.participar" (D-023, P-014 B): approving the community request also signs the person up
 * for the live event, when there is one. Nothing to do otherwise (the join still succeeds).
 */
export async function participateOnJoin(tx: Tx, communityId: string, userId: string) {
  const event = await liveEvent(tx, communityId);
  if (event) await signUp(tx, communityId, event, userId);
}

/**
 * The person left the community, was removed or rejected: they leave the events still running, so the
 * anonymous ballot (which can't see members) stops accepting them as a target. Closed events keep their
 * participants: their result is frozen.
 */
export async function participationOnLeave(tx: Tx, communityId: string, userId: string) {
  const running = tx
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.communityId, communityId), sql`${events.status} <> 'closed'`));
  await tx
    .delete(participants)
    .where(
      and(
        eq(participants.communityId, communityId),
        eq(participants.userId, userId),
        inArray(participants.eventId, running),
      ),
    );
}
