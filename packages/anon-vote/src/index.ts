// Pure part (types, tally, interfaces): safe for the API and the app. Crypto lives in ./client and ./server.
export {
  addToTally,
  tallyToTargetResults,
  tallyVotes,
  type EmojiCount,
  type EmojiTally,
  type RoundTargets,
  type TargetResult,
} from './tally';
export type { AnonVote, AnonVoteRepository, SigningKeyRepository, TokenIssuanceRepository } from './repositories';
