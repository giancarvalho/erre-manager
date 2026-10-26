// Portado de queridometro@7c5c5bf:src/lib/events/event-share-message.ts
/**
 * Builds the plain-text message copied by an event's own
 * "Copiar resultado para WhatsApp" button — the event equivalent of
 * lib/results/share-message.ts's buildShareMessage. Kept as a pure
 * function (no React/clipboard concerns, see useEventShareResult.ts) so
 * the exact string format is unit-testable on its own.
 *
 * Unlike the recurring flow (always one flat emoji ranking), an event can
 * be "categorical" (one flat ranking, same shape as the recurring one) OR
 * "scale" (one leaderboard PER AXIS — there's no single combined ranking
 * across differently-scaled axes, same framing EventResultsRanking
 * already uses) — the discriminated union below mirrors that.
 */

export type EventShareTrophyRow = {
  char: string;
  trophyName: string;
  winnerName: string;
};

export type EventShareCategoricalRow = {
  name: string;
  emojis: { char: string; count: number }[];
};

export type EventShareScaleAxisRow = {
  name: string;
  /** Already formatted for display — "70%" or, for a teto=1 axis, "×3" — same convention EventResultsRanking uses. */
  magnitudeLabel: string;
};

export type EventShareScaleAxis = {
  char: string;
  label: string;
  rows: EventShareScaleAxisRow[];
};

export type BuildEventShareMessageOptions = {
  eventTitle: string;
  /** Already formatted for display, pt-BR — e.g. "10 de setembro de 2026". */
  closedAtLabel: string;
  /** Trophies WON this event (ties award nobody — see trophyWinnersFromSnapshot), in the order they should be listed. */
  trophies: EventShareTrophyRow[];
  resultsUrl: string;
} & (
  { votingType: 'categorical'; rows: EventShareCategoricalRow[] } | { votingType: 'scale'; axes: EventShareScaleAxis[] }
);

/** Same "🏆 <emoji> <name> — <trophyName>" language as share-message.ts's own buildTrophiesSection — omitted entirely when nobody won anything. */
function buildTrophiesSection(trophies: EventShareTrophyRow[]): string | null {
  if (trophies.length === 0) return null;
  const lines = trophies.map((t) => `${t.char} ${t.winnerName} — ${t.trophyName}`);
  return `🏆 Troféus do evento\n${lines.join('\n')}`;
}

function buildCategoricalRanking(rows: EventShareCategoricalRow[]): string | null {
  if (rows.length === 0) return null;
  return rows
    .map((r, i) => {
      const emojiPart = r.emojis.length > 0 ? r.emojis.map((e) => `${e.char}×${e.count}`).join(' ') : '—';
      return `${i + 1}. ${r.name} ${emojiPart}`;
    })
    .join('\n');
}

/** One block per axis, blank-line separated — same shape EventResultsRanking renders as separate <section>s. */
function buildScaleRanking(axes: EventShareScaleAxis[]): string | null {
  const blocks = axes
    .filter((axis) => axis.rows.length > 0)
    .map((axis) => {
      const lines = axis.rows.map((r, i) => `${i + 1}. ${r.name} ${r.magnitudeLabel}`);
      return [`${axis.char} ${axis.label}`, ...lines].join('\n');
    });
  if (blocks.length === 0) return null;
  return blocks.join('\n\n');
}

export function buildEventShareMessage(options: BuildEventShareMessageOptions): string {
  const header = `📊 ${options.eventTitle} — ${options.closedAtLabel}`;
  const trophiesSection = buildTrophiesSection(options.trophies);
  const rankingSection =
    options.votingType === 'scale' ? buildScaleRanking(options.axes) : buildCategoricalRanking(options.rows);
  const footer = `Resultado completo: ${options.resultsUrl}`;

  const sections = [header, trophiesSection, rankingSection, footer].filter((s): s is string => s !== null);
  return sections.join('\n\n');
}
