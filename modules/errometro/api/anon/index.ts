// ANONYMOUS routes. They never learn who calls (AGENTS.md rule 9, D-010): no session, no cookies, no
// Authorization, no IP (the runtime strips them; erre/no-identity-in-anon guards the code). Eligibility is
// proven only by the blind-signed token, checked against THIS community's key for the current round, which
// is also what validates the community in the path (ARQUITETURA §4.5).
// Ported from queridometro@7c5c5bf:src/lib/voting/anonymous-voting.ts (submitAnonymousVotes, getVotesForTag)
// and src/app/api/groups/[id]/{vote,my-votes}/route.ts.
import type { AnonVote } from '@erre/anon-vote';
import { verifyBallot } from '@erre/anon-vote/server';
import { AppError, createAnonApp, errors, validate } from '@erre/core/server';
import { and, eq } from '@erre/db';

import { activeEmojiOptions } from '../../domain/emoji-config';
import { BallotSchema, MyVotesSchema } from '../../domain/schemas';
import { participants } from '../../db/schema';
import { loadEmojiRows } from '../server/emojis';
import { signingKeyRepository, voteRepository } from '../server/repositories';
import { lockRound, resolveRound } from '../server/round';

const invalidToken = () => new AppError(401, 'INVALID_TOKEN', 'Token inválido.');

export const anon = createAnonApp()
  .post('/votos', validate('json', BallotSchema), async (c) => {
    const { tx, community } = c.var.ctx;
    const { preparedMsgB64, signatureB64, votes: voteMap } = c.req.valid('json');
    const entries = Object.entries(voteMap);
    if (entries.length === 0) throw errors.validation('Nenhum voto enviado.');

    await lockRound(tx, community.id, 'shared');
    const round = await resolveRound(tx, community);
    // The tag comes from the verified message, never from the client (R-ANON-03).
    const voterTag = await verifyBallot(
      { keys: signingKeyRepository(tx, community.id) },
      { period: round.label, preparedMsgB64, signatureB64 },
    );
    if (!voterTag) throw invalidToken();

    // Targets who left and emojis switched off are dropped, not fatal (R-ANON-05). Approved participants
    // are kept in sync with the membership by onMemberLeft.
    const targetRows = await tx
      .select({ id: participants.userId })
      .from(participants)
      .where(and(eq(participants.communityId, community.id), eq(participants.status, 'approved')));
    const targets = new Set(targetRows.map((r) => r.id));
    const emojis = new Set(activeEmojiOptions(await loadEmojiRows(tx, community.id)).map((e) => e.id));
    const rows: AnonVote[] = entries
      .filter(([targetId, emojiId]) => targets.has(targetId) && emojis.has(emojiId))
      .map(([targetId, emojiId]) => ({ voterTag, targetId, emojiId }));
    if (rows.length === 0) throw errors.rule('NO_VALID_VOTES', 'Nenhum voto válido.');

    const repo = voteRepository(tx, community.id);
    const existing = await repo.getVotesByTag(round.label, voterTag);
    const status = Object.keys(existing).length > 0 ? 'updated' : 'inserted';
    await repo.saveVotes(round.label, rows);
    // A deselected emoji removes the target from the map: delete its previous vote. Compare with the map
    // the client SENT, not with the valid rows, so a target merely dropped above keeps its vote (R-ANON-06).
    const removed = Object.keys(existing).filter((id) => !(id in voteMap));
    await repo.deleteVotesForTargets(round.label, voterTag, removed);
    return c.json({ status });
  })

  // The voter's own votes in the current round, by the opaque tag the device keeps (R-ANON-07). Anonymous on
  // purpose: with a session, the server would see (person, tag) together. The tag is a 256-bit preimage
  // capability, so it can't be enumerated.
  .post('/meus-votos', validate('json', MyVotesSchema), async (c) => {
    const { tx, community } = c.var.ctx;
    const round = await resolveRound(tx, community);
    const votes = await voteRepository(tx, community.id).getVotesByTag(round.label, c.req.valid('json').voterTag);
    return c.json({ period: round.label, votes });
  });
