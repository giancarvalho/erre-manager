// LGPD (Sprint 19): what Eventos keeps about a person in a community. Votes never come in (R-ANON-03). Erasing
// takes the sign-ups, the token gate rows and the trophies won; events the person created stay (they belong to the
// community), with a creator id that no longer points to anyone.
import type { ModuleData } from '@erre/core/server';
import { and, eq } from '@erre/db';

import { events, participants, tokenIssuances, trophyWins } from '../../db/schema';
import { memberTrophies } from './results';

export const eventosData: ModuleData = {
  async export({ tx, communityId }, userId) {
    const signedUp = await tx
      .select({ event: events.title, appliedAt: participants.appliedAt })
      .from(participants)
      .innerJoin(events, and(eq(events.communityId, participants.communityId), eq(events.id, participants.eventId)))
      .where(and(eq(participants.communityId, communityId), eq(participants.userId, userId)));
    const created = await tx
      .select({ title: events.title, createdAt: events.createdAt })
      .from(events)
      .where(and(eq(events.communityId, communityId), eq(events.createdBy, userId)));
    const trophies = await memberTrophies(tx, communityId, userId);
    if (signedUp.length === 0 && created.length === 0 && !trophies) return null;
    return { participations: signedUp, eventsCreated: created, trophies: trophies ?? { categorical: [], scale: [] } };
  },

  async delete({ tx, communityId }, userId) {
    await tx
      .delete(participants)
      .where(and(eq(participants.communityId, communityId), eq(participants.userId, userId)));
    await tx
      .delete(tokenIssuances)
      .where(and(eq(tokenIssuances.communityId, communityId), eq(tokenIssuances.userId, userId)));
    await tx
      .delete(trophyWins)
      .where(and(eq(trophyWins.communityId, communityId), eq(trophyWins.winnerUserId, userId)));
  },
};
