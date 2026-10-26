// Portado de queridometro@7c5c5bf:src/domain/events/calculator.ts
/**
 * What every event voting type implements: a flat vote list into a per-target tally, then the tally into
 * trophies. Never sees who voted. `TTrophyExtra` is one extra piece of read-only context for the trophies
 * (only the scale calculator uses it: the scale_max of each axis).
 */
export interface VotingTypeCalculator<TVote, TTargetResult, TTrophyResult, TTrophyExtra = never> {
  tally(votes: readonly TVote[]): TTargetResult[];
  computeTrophies(targets: readonly TTargetResult[], extra?: TTrophyExtra): TTrophyResult[];
}
