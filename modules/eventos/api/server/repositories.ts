// Drizzle implementations of the @erre/anon-vote repositories over the Eventos tables (the "period" of an
// event is its id: one key and one issuance per event), plus the event votes, inside the community transaction.
import type { SigningKeyRepository, TokenIssuanceRepository } from '@erre/anon-vote';
import { generateSigningKeyPair } from '@erre/anon-vote/server';
import { and, eq, or, sql, type Tx } from '@erre/db';

import type { StoredEventVote } from '../../domain/snapshot';
import { signingKeys, tokenIssuances, votes } from '../../db/schema';

export function signingKeyRepository(tx: Tx, communityId: string): SigningKeyRepository {
  const find = async (eventId: string) => {
    const [row] = await tx
      .select()
      .from(signingKeys)
      .where(and(eq(signingKeys.communityId, communityId), eq(signingKeys.eventId, eventId)));
    return row;
  };
  return {
    async getOrCreateKeyPair(eventId) {
      const existing = await find(eventId);
      if (existing) return { publicKeyJwk: existing.publicKeyJwk, privateKeyJwk: existing.privateKeyJwk };
      const fresh = await generateSigningKeyPair();
      // Concurrent first requests converge on whichever pair was stored first.
      await tx
        .insert(signingKeys)
        .values({ communityId, eventId, ...fresh })
        .onConflictDoNothing();
      const row = await find(eventId);
      if (!row) throw new Error('signing key not stored');
      return { publicKeyJwk: row.publicKeyJwk, privateKeyJwk: row.privateKeyJwk };
    },
    async getPublicKey(eventId) {
      return (await find(eventId))?.publicKeyJwk ?? null;
    },
  };
}

export function tokenIssuanceRepository(tx: Tx, communityId: string): TokenIssuanceRepository {
  return {
    async tryClaimIssuance(userId, eventId) {
      const rows = await tx
        .insert(tokenIssuances)
        .values({ communityId, userId, eventId })
        .onConflictDoNothing()
        .returning({ userId: tokenIssuances.userId });
      return rows.length === 1;
    },
  };
}

export function eventVoteRepository(tx: Tx, communityId: string, eventId: string) {
  const ofEvent = and(eq(votes.communityId, communityId), eq(votes.eventId, eventId));
  return {
    async byTag(voterTag: string): Promise<StoredEventVote[]> {
      return tx
        .select({ targetId: votes.targetId, emojiId: votes.emojiId, value: votes.value })
        .from(votes)
        .where(and(ofEvent, eq(votes.voterTag, voterTag)));
    },
    async all(): Promise<StoredEventVote[]> {
      return tx
        .select({ targetId: votes.targetId, emojiId: votes.emojiId, value: votes.value })
        .from(votes)
        .where(ofEvent);
    },
    async save(voterTag: string, rows: readonly StoredEventVote[]) {
      if (rows.length === 0) return;
      await tx
        .insert(votes)
        .values(rows.map((r) => ({ communityId, eventId, voterTag, ...r })))
        .onConflictDoUpdate({
          target: [votes.communityId, votes.eventId, votes.voterTag, votes.targetId, votes.emojiId],
          set: { value: sql`excluded.value`, votedAt: sql`now()` },
        });
    },
    async remove(voterTag: string, pairs: readonly { targetId: string; emojiId: string }[]) {
      if (pairs.length === 0) return;
      await tx
        .delete(votes)
        .where(
          and(
            ofEvent,
            eq(votes.voterTag, voterTag),
            or(...pairs.map((p) => and(eq(votes.targetId, p.targetId), eq(votes.emojiId, p.emojiId)))),
          ),
        );
    },
  };
}
