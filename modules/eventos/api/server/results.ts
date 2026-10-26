// What members read: the event view, the result of a closed event and the profile trophies.
// Ported from queridometro@7c5c5bf:src/app/group/[id]/events/[eventId]/results/page.tsx (dados) and
// src/lib/trophies/event-trophy-wins.ts.
import type { MembersApi } from '@erre/core/server';
import { and, eq, inArray, type Tx } from '@erre/db';

import { resolveEventEmoji, type ResolvedEventEmoji } from '../../domain/emoji-config';
import { memberEventTrophies, type EventInfo } from '../../domain/trophies';
import { emojiConfig, events, snapshots, trophyWins } from '../../db/schema';
import { loadRoster, type EventRow } from './events';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** The public shape of an event. */
export function eventView(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    votingType: row.votingType,
    status: row.status,
    releaseMode: row.releaseMode,
    scheduledOpenAt: iso(row.scheduledOpenAt),
    scheduledReleaseAt: iso(row.scheduledReleaseAt),
    bannerRgb: row.bannerRgb,
    createdAt: row.createdAt.toISOString(),
    openedAt: iso(row.openedAt),
    closedAt: iso(row.closedAt),
  };
}

/**
 * Result of a closed event: the frozen payload, the roster that resolves its emojis and the names of the
 * targets who are still members (a target who left shows without a name, like the legacy "Alguém").
 */
export async function loadEventResults(tx: Tx, communityId: string, event: EventRow, members: MembersApi) {
  const [snapshot] = await tx
    .select({ payload: snapshots.payload, createdAt: snapshots.createdAt })
    .from(snapshots)
    .where(and(eq(snapshots.communityId, communityId), eq(snapshots.eventId, event.id)));
  if (!snapshot) return null;
  const targetIds = new Set<string>(snapshot.payload.targets.map((t) => t.targetId));
  const people = Object.fromEntries(
    (await members.list())
      .filter((m) => targetIds.has(m.userId))
      .map((m) => [m.userId, { displayName: m.displayName, avatarVariant: m.avatarVariant }]),
  );
  return {
    event: eventView(event),
    emojis: await loadRoster(tx, communityId, event.id),
    result: snapshot.payload,
    releasedAt: snapshot.createdAt.toISOString(),
    people,
  };
}

/** A member's event trophies (profile section eventos.trofeus), or null when none. */
export async function memberTrophies(tx: Tx, communityId: string, userId: string) {
  const wins = await tx
    .select({
      eventId: trophyWins.eventId,
      emojiId: trophyWins.emojiId,
      votingType: trophyWins.votingType,
      magnitude: trophyWins.magnitude,
      wonAt: trophyWins.wonAt,
      title: events.title,
      deletedAt: events.deletedAt,
    })
    .from(trophyWins)
    .innerJoin(events, and(eq(events.communityId, trophyWins.communityId), eq(events.id, trophyWins.eventId)))
    .where(and(eq(trophyWins.communityId, communityId), eq(trophyWins.winnerUserId, userId)));
  // A deleted event is gone everywhere, its trophies included.
  const live = wins.filter((w) => w.deletedAt === null);
  if (live.length === 0) return null;

  const eventIds = [...new Set(live.map((w) => w.eventId))];
  const rosterRows = await tx
    .select()
    .from(emojiConfig)
    .where(and(eq(emojiConfig.communityId, communityId), inArray(emojiConfig.eventId, eventIds)));
  const rosters = new Map<string, ResolvedEventEmoji[]>();
  for (const r of rosterRows) rosters.set(r.eventId, [...(rosters.get(r.eventId) ?? []), resolveEventEmoji(r)]);
  const info = new Map<string, EventInfo>(
    live.map((w) => [w.eventId, { title: w.title, roster: rosters.get(w.eventId) ?? [] }]),
  );

  return memberEventTrophies(
    live.map((w) => ({ ...w, magnitude: Number(w.magnitude) })),
    info,
  );
}
