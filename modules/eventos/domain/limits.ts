// Portado de queridometro@7c5c5bf:src/lib/events/event-limits.ts
// Pure constants of the events (R-EVT-05), importable by the app's forms too.

/** Roster of a "categorical" event: same bounds as the Errômetro roster. MIN also applies to "scale". */
export { MAX_ACTIVE_EMOJIS, MIN_ACTIVE_EMOJIS } from '@erre/emoji';

/** A headline, not a sentence: up to 2 lines in the banner on a narrow phone. */
export const MAX_TITLE_LENGTH = 64;
/** The event's own description (a roster row's description uses @erre/emoji's MAX_DESCRIPTION_LENGTH). */
export const MAX_EVENT_DESCRIPTION_LENGTH = 280;

/** Inclusive bounds of a "scale" axis ceiling (scale_max). */
export const MIN_SCALE_MAX = 1;
export const MAX_SCALE_MAX = 10;

/** A scale ballot asks one rating per axis and target, so it has far fewer axes than a categorical roster. */
export const MAX_SCALE_AXES = 5;

/** Hard cap on rows per anonymous ballot (a scale ballot has one row per target and axis). */
export const MAX_EVENT_VOTE_ROWS = 2000;
