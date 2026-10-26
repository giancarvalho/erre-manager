// Drizzle implementations of the @erre/anon-vote repositories over the Errômetro tables, inside the
// community transaction the module receives.
import type { AnonVote, AnonVoteRepository, SigningKeyRepository, TokenIssuanceRepository } from '@erre/anon-vote';
import { generateSigningKeyPair } from '@erre/anon-vote/server';
import { and, eq, inArray, sql, type Tx } from '@erre/db';

import { signingKeys, tokenIssuances, votes } from '../../db/schema';

export function signingKeyRepository(tx: Tx, communityId: string): SigningKeyRepository {
  const find = async (period: string) => {
    const [row] = await tx
      .select()
      .from(signingKeys)
      .where(and(eq(signingKeys.communityId, communityId), eq(signingKeys.period, period)));
    return row;
  };
  return {
    async getOrCreateKeyPair(period) {
      const existing = await find(period);
      if (existing) return { publicKeyJwk: existing.publicKeyJwk, privateKeyJwk: existing.privateKeyJwk };
      const fresh = await generateSigningKeyPair();
      // Concurrent first requests converge on whichever pair was stored first.
      await tx
        .insert(signingKeys)
        .values({ communityId, period, ...fresh })
        .onConflictDoNothing();
      const row = await find(period);
      if (!row) throw new Error('signing key not stored');
      return { publicKeyJwk: row.publicKeyJwk, privateKeyJwk: row.privateKeyJwk };
    },
    async getPublicKey(period) {
      return (await find(period))?.publicKeyJwk ?? null;
    },
  };
}

export function tokenIssuanceRepository(tx: Tx, communityId: string): TokenIssuanceRepository {
  return {
    async tryClaimIssuance(userId, period) {
      const rows = await tx
        .insert(tokenIssuances)
        .values({ communityId, userId, period })
        .onConflictDoNothing()
        .returning({ userId: tokenIssuances.userId });
      return rows.length === 1;
    },
  };
}

export function voteRepository(tx: Tx, communityId: string): AnonVoteRepository {
  const byTag = (period: string, voterTag: string) =>
    and(eq(votes.communityId, communityId), eq(votes.period, period), eq(votes.voterTag, voterTag));
  return {
    async saveVotes(period: string, rows: AnonVote[]) {
      if (rows.length === 0) return;
      await tx
        .insert(votes)
        .values(
          rows.map((v) => ({ communityId, period, voterTag: v.voterTag, targetId: v.targetId, emojiId: v.emojiId })),
        )
        .onConflictDoUpdate({
          target: [votes.communityId, votes.period, votes.voterTag, votes.targetId],
          set: { emojiId: sql`excluded.emoji_id`, votedAt: sql`now()` },
        });
    },
    async getVotesByTag(period, voterTag) {
      const rows = await tx
        .select({ targetId: votes.targetId, emojiId: votes.emojiId })
        .from(votes)
        .where(byTag(period, voterTag));
      return Object.fromEntries(rows.map((r) => [r.targetId, r.emojiId]));
    },
    async deleteVotesForTargets(period, voterTag, targetIds) {
      if (targetIds.length === 0) return 0;
      const rows = await tx
        .delete(votes)
        .where(and(byTag(period, voterTag), inArray(votes.targetId, targetIds)))
        .returning({ t: votes.targetId });
      return rows.length;
    },
    async deleteVotesForTag(voterTag) {
      const rows = await tx
        .delete(votes)
        .where(and(eq(votes.communityId, communityId), eq(votes.voterTag, voterTag)))
        .returning({ t: votes.targetId });
      return rows.length;
    },
  };
}
