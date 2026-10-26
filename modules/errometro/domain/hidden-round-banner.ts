// Portado de queridometro@7c5c5bf:src/lib/results/hidden-round-banner.ts ("criador" é quem tem errometro.moderar).
/**
 * Whether /results should show the creator-only "essa rodada está
 * escondida" banner instead of the generic "nenhum resultado ainda" empty
 * state. Only true when the group has zero VISIBLE rounds (member-facing
 * `getSnapshotDays` default excludes hidden ones) but has at least one
 * hidden round on record — otherwise the group genuinely never released
 * anything, and the generic message is correct. Never true for a
 * non-creator: hidden rounds must stay indistinguishable from "never
 * released" to members, that's the whole point of hiding one.
 */
export function shouldShowHiddenRoundBanner(
  isCreator: boolean,
  visibleSnapshotDaysCount: number,
  hiddenSnapshotDaysCount: number,
): boolean {
  return isCreator && visibleSnapshotDaysCount === 0 && hiddenSnapshotDaysCount > 0;
}
