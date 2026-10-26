// Portado de queridometro@7c5c5bf:src/domain/voting/{signing-key-repository,token-issuance-repository,vote-repository}.ts.
// Interfaces only: each module implements them with its own tables, inside the community transaction it
// receives (so the community is implicit). `period` is the module's unit: a round, an event.

import type { SigningKeyPair } from './server';

export interface SigningKeyRepository {
  /** The key pair for the period, created and stored on first use. Concurrent callers converge on one pair. */
  getOrCreateKeyPair(period: string): Promise<SigningKeyPair>;
  /** Public key only, to verify a token at vote time. Null if never created. */
  getPublicKey(period: string): Promise<JsonWebKey | null>;
}

export interface TokenIssuanceRepository {
  /**
   * Atomically claims the (user, period) slot: true on the first claim, false if already claimed (the
   * anti-ballot-stuffing gate). The ONLY place a person is linked to voting; never joined with votes,
   * and stored without a timestamp, so it can't be used to deanonymize a vote.
   */
  tryClaimIssuance(userId: string, period: string): Promise<boolean>;
}

/** One anonymous vote: no user, only the voter tag derived from the signed token. */
export type AnonVote = { voterTag: string; targetId: string; emojiId: string };

/**
 * Votes keyed by voter tag (the blind-signature subset of the legacy IVoteRepository; the methods keyed
 * by userId belonged to the HMAC demo path and are not ported). Implemented by each module with its own
 * table; anonymous routes call it without knowing who votes.
 */
export interface AnonVoteRepository {
  /** Inserts or updates one row per (period, voterTag, targetId). */
  saveVotes(period: string, votes: AnonVote[]): Promise<void>;
  /** targetId -> emojiId for a voter tag, to prefill the voting screen on update. */
  getVotesByTag(period: string, voterTag: string): Promise<Record<string, string>>;
  /** Removes a voter's rows for targets deselected on resubmission. Returns rows removed. */
  deleteVotesForTargets(period: string, voterTag: string, targetIds: string[]): Promise<number>;
  /** Admin annulment: every row of the voter tag, never followed by a reissue. Returns rows removed. */
  deleteVotesForTag(voterTag: string): Promise<number>;
}
