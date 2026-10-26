// ANONYMOUS routes. They never learn who calls (AGENTS.md rule 9, D-010): no session, no cookies, no
// Authorization, no IP (the runtime strips them; erre/no-identity-in-anon guards the code). Eligibility is
// proven only by the blind-signed token, checked against THIS event's key in THIS community, which is also
// what validates the community in the path (ARQUITETURA §4.5).
// Ported from queridometro@7c5c5bf:src/lib/events/anonymous-event-voting.ts (submitAnonymousEventVotes,
// getEventVotesForTag) and src/app/api/events/[id]/{vote,my-votes}/route.ts.
import { verifyBallot } from '@erre/anon-vote/server';
import { AppError, createAnonApp, errors, validate } from '@erre/core/server';
import { and, eq, isNull } from '@erre/db';
import { z } from 'zod';

import { planEventBallot } from '../../domain/ballot';
import { EventBallotSchema, MyVotesSchema } from '../../domain/schemas';
import { events } from '../../db/schema';
import { loadRosterRows } from '../server/events';
import { lockEvent } from '../server/lock';
import { participantIds } from '../server/participants';
import { eventVoteRepository, signingKeyRepository } from '../server/repositories';

const invalidToken = () => new AppError(401, 'INVALID_TOKEN', 'Token inválido.');
const EventParam = z.object({ eventId: z.uuid() });

export const anon = createAnonApp()
  .post('/:eventId/votos', validate('param', EventParam), validate('json', EventBallotSchema), async (c) => {
    const { tx, community } = c.var.ctx;
    const { eventId } = c.req.valid('param');
    const { preparedMsgB64, signatureB64, votes: submission } = c.req.valid('json');

    await lockEvent(tx, eventId, 'shared');
    const [event] = await tx
      .select({ status: events.status, votingType: events.votingType })
      .from(events)
      .where(and(eq(events.communityId, community.id), eq(events.id, eventId), isNull(events.deletedAt)));
    if (!event) throw errors.notFound('Evento não encontrado.');
    if (event.status !== 'open') throw errors.conflict('EVENT_NOT_OPEN', 'Este evento não está aberto para votos.');

    // The tag comes from the verified message, never from the client (R-ANON-03).
    const voterTag = await verifyBallot(
      { keys: signingKeyRepository(tx, community.id) },
      { period: eventId, preparedMsgB64, signatureB64 },
    );
    if (!voterTag) throw invalidToken();

    // Targets are the event's participants, kept in sync with the membership by onMemberLeft (D-043).
    const repo = eventVoteRepository(tx, community.id, eventId);
    const existing = await repo.byTag(voterTag);
    const plan = planEventBallot({
      votingType: event.votingType,
      participants: new Set(await participantIds(tx, community.id, eventId)),
      roster: new Map((await loadRosterRows(tx, community.id, eventId)).map((r) => [r.emojiId, r])),
      submission,
      existing,
    });
    if (plan.save.length === 0) throw errors.rule('NO_VALID_VOTES', 'Nenhum voto válido.');
    await repo.save(voterTag, plan.save);
    await repo.remove(voterTag, plan.remove);
    return c.json({ status: existing.length > 0 ? 'updated' : 'inserted' });
  })

  // The voter's own votes in the event, by the opaque tag the device keeps (R-ANON-07). Anonymous on purpose:
  // with a session, the server would see (person, tag) together.
  .post('/:eventId/meus-votos', validate('param', EventParam), validate('json', MyVotesSchema), async (c) => {
    const { tx, community } = c.var.ctx;
    const { eventId } = c.req.valid('param');
    const votes = await eventVoteRepository(tx, community.id, eventId).byTag(c.req.valid('json').voterTag);
    return c.json({ votes });
  });
