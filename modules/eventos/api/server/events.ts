// Events: reads, drafts, roster and the lifecycle transitions. Ported from queridometro@7c5c5bf:
// src/lib/events/voting-events.ts, src/lib/events/voting-event-emoji-config.ts, src/lib/events/close-voting-event.ts
// (openApplications, openVoting, deleteVotingEvent) and src/infrastructure/events/postgres-voting-event.repository.ts.
import { and, asc, desc, eq, inArray, isNull, lte, type Tx } from '@erre/db';

import { resolveEventEmoji, type EventEmojiRow } from '../../domain/emoji-config';
import { type EventFields, type EventStatus, publishProblem } from '../../domain/lifecycle';
import type { VotingType } from '../../domain/snapshot';
import { emojiConfig, events } from '../../db/schema';
import { lockLiveSlot } from './lock';

export type EventRow = typeof events.$inferSelect;

const LIVE: EventStatus[] = ['accepting_applications', 'open'];

const notDeleted = (communityId: string) => and(eq(events.communityId, communityId), isNull(events.deletedAt));

/** The event, or null when it doesn't exist here or was deleted (a deleted event is simply gone). */
export async function loadEvent(tx: Tx, communityId: string, eventId: string): Promise<EventRow | null> {
  const [row] = await tx
    .select()
    .from(events)
    .where(and(notDeleted(communityId), eq(events.id, eventId)));
  return row ?? null;
}

/** Events of the community, newest first. Drafts only for whoever can create or moderate. */
export async function listEvents(tx: Tx, communityId: string, includeDrafts: boolean): Promise<EventRow[]> {
  const rows = await tx.select().from(events).where(notDeleted(communityId)).orderBy(desc(events.createdAt));
  return includeDrafts ? rows : rows.filter((r) => r.status !== 'draft');
}

/** The live event (accepting_applications or open), if any: at most one per community (R-EVT-03). */
export async function liveEvent(tx: Tx, communityId: string): Promise<EventRow | null> {
  const [row] = await tx
    .select()
    .from(events)
    .where(and(notDeleted(communityId), inArray(events.status, LIVE)));
  return row ?? null;
}

export async function createEvent(
  tx: Tx,
  communityId: string,
  input: { fields: EventFields; votingType: VotingType; createdBy: string },
): Promise<EventRow> {
  const [row] = await tx
    .insert(events)
    .values({ communityId, ...input.fields, votingType: input.votingType, status: 'draft', createdBy: input.createdBy })
    .returning();
  return row!;
}

/** Writes draft fields, only while the event is still a draft (the WHERE closes the check-then-act gap). */
export async function updateDraft(tx: Tx, communityId: string, eventId: string, fields: EventFields) {
  const [row] = await tx
    .update(events)
    .set(fields)
    .where(and(notDeleted(communityId), eq(events.id, eventId), eq(events.status, 'draft')))
    .returning();
  return row ?? null;
}

export async function loadRosterRows(tx: Tx, communityId: string, eventId: string): Promise<EventEmojiRow[]> {
  return tx
    .select({
      emojiId: emojiConfig.emojiId,
      sortOrder: emojiConfig.sortOrder,
      isCustom: emojiConfig.isCustom,
      char: emojiConfig.char,
      label: emojiConfig.label,
      trophyName: emojiConfig.trophyName,
      description: emojiConfig.description,
      glowRgb: emojiConfig.glowRgb,
      scaleMax: emojiConfig.scaleMax,
    })
    .from(emojiConfig)
    .where(and(eq(emojiConfig.communityId, communityId), eq(emojiConfig.eventId, eventId)))
    .orderBy(asc(emojiConfig.sortOrder));
}

export async function loadRoster(tx: Tx, communityId: string, eventId: string) {
  return (await loadRosterRows(tx, communityId, eventId)).map(resolveEventEmoji);
}

/** Full replace of a draft's roster. The caller locked the event row as a draft (see saveRosterIfDraft). */
async function replaceRoster(tx: Tx, communityId: string, eventId: string, rows: EventEmojiRow[]) {
  await tx.delete(emojiConfig).where(and(eq(emojiConfig.communityId, communityId), eq(emojiConfig.eventId, eventId)));
  if (rows.length > 0) await tx.insert(emojiConfig).values(rows.map((r) => ({ communityId, eventId, ...r })));
}

/**
 * Saves the roster only if the event is still a draft, re-checked under a row lock in the same transaction:
 * closes the race the legacy left open between publishing and a stale draft editor saving (KNOWN GAP in
 * `legado:src/lib/events/voting-event-emoji-config.ts`).
 */
export async function saveRosterIfDraft(tx: Tx, communityId: string, eventId: string, rows: EventEmojiRow[]) {
  const [locked] = await tx
    .select({ status: events.status })
    .from(events)
    .where(and(notDeleted(communityId), eq(events.id, eventId)))
    .for('update');
  if (!locked) return 'NOT_FOUND' as const;
  if (locked.status !== 'draft') return 'NOT_DRAFT' as const;
  await replaceRoster(tx, communityId, eventId, rows);
  return 'OK' as const;
}

export type TransitionResult =
  | { ok: true; event: EventRow }
  | { ok: false; code: 'NOT_FOUND' | 'INVALID_TRANSITION' | 'LIVE_EVENT_EXISTS' | 'PUBLISH_RULE'; message?: string };

async function lockedEvent(tx: Tx, communityId: string, eventId: string) {
  const [row] = await tx
    .select()
    .from(events)
    .where(and(notDeleted(communityId), eq(events.id, eventId)))
    .for('update');
  return row ?? null;
}

/**
 * Publish (draft → accepting_applications): link live, members sign up, nobody votes yet. Needs a roster,
 * valid scheduled dates, and no other live event in the community (R-EVT-02, R-EVT-03).
 */
export async function publish(tx: Tx, communityId: string, eventId: string, now: Date): Promise<TransitionResult> {
  await lockLiveSlot(tx, communityId);
  const event = await lockedEvent(tx, communityId, eventId);
  if (!event) return { ok: false, code: 'NOT_FOUND' };
  if (event.status !== 'draft') return { ok: false, code: 'INVALID_TRANSITION' };
  if (await liveEvent(tx, communityId)) return { ok: false, code: 'LIVE_EVENT_EXISTS' };
  const problem = publishProblem(event, (await loadRosterRows(tx, communityId, eventId)).length, now);
  if (problem) return { ok: false, code: 'PUBLISH_RULE', message: problem };
  const [updated] = await tx
    .update(events)
    .set({ status: 'accepting_applications' })
    .where(and(eq(events.communityId, communityId), eq(events.id, eventId)))
    .returning();
  return { ok: true, event: updated! };
}

/**
 * Open voting (accepting_applications → open). An admin may open early even when scheduled (R-EVT-06); the
 * job opens scheduled events once scheduled_open_at passes.
 */
export async function openVoting(tx: Tx, communityId: string, eventId: string, now: Date): Promise<TransitionResult> {
  const event = await lockedEvent(tx, communityId, eventId);
  if (!event) return { ok: false, code: 'NOT_FOUND' };
  if (event.status !== 'accepting_applications') return { ok: false, code: 'INVALID_TRANSITION' };
  const [updated] = await tx
    .update(events)
    .set({ status: 'open', openedAt: now })
    .where(and(eq(events.communityId, communityId), eq(events.id, eventId)))
    .returning();
  return { ok: true, event: updated! };
}

/** Soft delete, at any status (R-EVT-01). Nothing is removed; every read stops seeing it. */
export async function softDelete(tx: Tx, communityId: string, eventId: string, now: Date) {
  const rows = await tx
    .update(events)
    .set({ deletedAt: now })
    .where(and(notDeleted(communityId), eq(events.id, eventId)))
    .returning({ id: events.id });
  return rows.length > 0;
}

/** Scheduled events due to open or close by `now` (the jobs). */
export async function dueScheduledEvents(tx: Tx, communityId: string, kind: 'open' | 'close', now: Date) {
  const condition =
    kind === 'open'
      ? and(eq(events.status, 'accepting_applications'), lte(events.scheduledOpenAt, now))
      : and(eq(events.status, 'open'), lte(events.scheduledReleaseAt, now));
  return tx
    .select({ id: events.id })
    .from(events)
    .where(and(notDeleted(communityId), eq(events.releaseMode, 'scheduled'), condition))
    .orderBy(asc(events.createdAt));
}
