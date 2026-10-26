// Closing an event into its frozen snapshot, the trophy ledger and the "resultado saiu" push, plus the
// scheduled open/close jobs. Ported from queridometro@7c5c5bf:src/lib/events/close-voting-event.ts
// (closeVotingEvent), src/lib/jobs/{open,close}-scheduled-events.ts and
// src/infrastructure/events/postgres-event-trophy-win.repository.ts.
import type { MembersApi, Notify } from '@erre/core/server';
import { and, eq, isNull, sql, type Tx } from '@erre/db';

import { computeSnapshotPayload, type EventSnapshotPayload } from '../../domain/snapshot';
import { trophyWinnersFromSnapshot } from '../../domain/trophy-winner';
import { events, snapshots, trophyWins } from '../../db/schema';
import { dueScheduledEvents, loadRosterRows, openVoting, type EventRow } from './events';
import { lockEvent } from './lock';
import { participantIds } from './participants';
import { eventVoteRepository } from './repositories';

/** What closing needs to tell the participants. */
export type EventNotifier = { community: { id: string }; members: MembersApi; notify: Notify };

export type CloseResult =
  | { ok: true; event: EventRow; payload: EventSnapshotPayload }
  | { ok: false; code: 'NOT_FOUND' | 'INVALID_TRANSITION' };

/**
 * Closes an open event (manually, early or not, R-EVT-06; or by the job): tallies every vote with the
 * calculator of its type, freezes the snapshot, flips the status and writes the trophy ledger, all in one
 * transaction under the exclusive event lock, so no ballot lands between the tally and the flip. The legacy
 * wrote snapshot and status separately and had to make a retry reuse the snapshot; here a half-close can't
 * be committed.
 */
export async function closeEvent(tx: Tx, n: EventNotifier, eventId: string, now: Date): Promise<CloseResult> {
  const communityId = n.community.id;
  await lockEvent(tx, eventId, 'exclusive');
  const [event] = await tx
    .select()
    .from(events)
    .where(and(eq(events.communityId, communityId), eq(events.id, eventId), isNull(events.deletedAt)))
    .for('update');
  if (!event) return { ok: false, code: 'NOT_FOUND' };
  if (event.status !== 'open') return { ok: false, code: 'INVALID_TRANSITION' };

  const roster = await loadRosterRows(tx, communityId, eventId);
  const scaleMaxByEmoji = new Map(roster.flatMap((r) => (r.scaleMax === null ? [] : [[r.emojiId, r.scaleMax]])));
  const votes = await eventVoteRepository(tx, communityId, eventId).all();
  const payload = computeSnapshotPayload(event.votingType, votes, scaleMaxByEmoji);

  await tx.insert(snapshots).values({ communityId, eventId, payload, createdAt: now });
  const [updated] = await tx
    .update(events)
    .set({ status: 'closed', closedAt: now })
    .where(and(eq(events.communityId, communityId), eq(events.id, eventId)))
    .returning();
  const winners = trophyWinnersFromSnapshot(payload);
  if (winners.length > 0) {
    await tx.insert(trophyWins).values(
      winners.map((w) => ({
        communityId,
        eventId,
        emojiId: w.emojiId,
        winnerUserId: w.winnerUserId,
        votingType: event.votingType,
        magnitude: w.magnitude.toFixed(2),
        wonAt: now,
      })),
    );
  }
  await notifyResultReady(tx, n, updated!);
  return { ok: true, event: updated!, payload };
}

/**
 * "Resultado saiu" to the participants who are still members, at most once per event (claims notified_at).
 * New in the migration: the legacy had the column but sent no event push (PLANO Sprint 16, D-047).
 */
export async function notifyResultReady(tx: Tx, n: EventNotifier, event: EventRow): Promise<boolean> {
  const claimed = await tx
    .update(snapshots)
    .set({ notifiedAt: sql`now()` })
    .where(
      and(eq(snapshots.communityId, n.community.id), eq(snapshots.eventId, event.id), isNull(snapshots.notifiedAt)),
    )
    .returning({ eventId: snapshots.eventId });
  if (claimed.length === 0) return false;
  const ids = new Set(await participantIds(tx, n.community.id, event.id));
  const userIds = (await n.members.list()).filter((m) => ids.has(m.userId)).map((m) => m.userId);
  if (userIds.length === 0) return false;
  await n.notify({
    userIds,
    type: 'eventos.resultado_pronto',
    title: `Resultado de ${event.title} saiu! 📊`,
    body: 'Veja quem levou cada troféu.',
    route: `/eventos/${event.id}/resultados?comunidade=${n.community.id}`,
  });
  return true;
}

/**
 * Job eventos.abrir_agendados: opens scheduled events whose scheduled_open_at passed. The job runs per
 * community and a community has at most one live event, so the legacy's per-run cap (50 events over every
 * group) has nothing to bound here.
 */
export async function openDueEvents(tx: Tx, communityId: string, now: Date) {
  const due = await dueScheduledEvents(tx, communityId, 'open', now);
  const opened: string[] = [];
  for (const { id } of due) if ((await openVoting(tx, communityId, id, now)).ok) opened.push(id);
  return opened;
}

/** Job eventos.fechar_agendados: closes scheduled events whose scheduled_release_at passed. */
export async function closeDueEvents(tx: Tx, n: EventNotifier, now: Date) {
  const due = await dueScheduledEvents(tx, n.community.id, 'close', now);
  const closed: string[] = [];
  for (const { id } of due) if ((await closeEvent(tx, n, id, now)).ok) closed.push(id);
  return closed;
}
