// Portado de queridometro@7c5c5bf:src/lib/results/share-message.ts
/**
 * Builds the plain-text message copied by "Copiar ranking para WhatsApp" —
 * kept as a pure function (no React/clipboard concerns, see
 * useShareResult.ts) so the exact string format is unit-testable on its
 * own.
 */

export type ShareTrophyDisplay = {
  char: string;
  trophyName: string;
};

export type ShareRankingRow = {
  name: string;
  emojis: { char: string; count: number }[];
  /** Round trophies this member WON (not near-misses — those stay UI-only, see RankingSection.tsx). */
  trophies?: ShareTrophyDisplay[] | undefined;
};

export type BuildShareMessageOptions = {
  rows: ShareRankingRow[];
  viewingDay: string;
  shareUrl: string;
};

/**
 * "🏆 Troféus da rodada" block, one line per (member, trophy) pair — a
 * member with two wins gets two lines, not two trophies squeezed onto one.
 * Omitted entirely when nobody won anything this round (below the vote
 * minimum, or every emoji tied for the lead — see domain/voting/trophies.ts).
 */
function buildTrophiesSection(rows: ShareRankingRow[]): string | null {
  const lines = rows.flatMap((row) => (row.trophies ?? []).map((t) => `${t.char} ${row.name} — ${t.trophyName}`));
  if (lines.length === 0) return null;
  return `🏆 Troféus da rodada\n${lines.join('\n')}`;
}

export function buildShareMessage({ rows, viewingDay, shareUrl }: BuildShareMessageOptions): string {
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(viewingDay + 'T12:00:00.000Z'));

  const header = `📊 Errômetro — ${dateLabel}`;
  const trophiesSection = buildTrophiesSection(rows);
  const ranking = rows
    .map((r, i) => {
      const emojiPart = r.emojis.length > 0 ? r.emojis.map((e) => `${e.char}×${e.count}`).join(' ') : '—';
      return `${i + 1}. ${r.name} ${emojiPart}`;
    })
    .join('\n');

  const sections = [header, trophiesSection, ranking, `Vote você também: ${shareUrl}`].filter(
    (s): s is string => s !== null,
  );
  return sections.join('\n\n');
}
