// Portado de queridometro@7c5c5bf:src/lib/trophies/event-trophy-wins.ts (agregação pura do perfil).
import { DEFAULT_TROPHY_GLOW_RGB, DEFAULT_TROPHY_NAME } from '@erre/emoji';

import type { ResolvedEventEmoji } from './emoji-config';
import type { VotingType } from './snapshot';

/** One row of eventos_trophy_wins, with what the profile needs from its event. */
export type TrophyWinRow = {
  eventId: string;
  emojiId: string;
  votingType: VotingType;
  magnitude: number;
  wonAt: Date;
};

export type EventInfo = { title: string; roster: readonly ResolvedEventEmoji[] };

export type CategoricalTrophy = {
  emojiId: string;
  char: string;
  trophyName: string;
  glowRgb: string;
  winCount: number;
};

export type ScaleTrophy = {
  eventId: string;
  eventTitle: string;
  emojiId: string;
  char: string;
  label: string;
  trophyName: string;
  glowRgb: string;
  average: number;
  /** The axis ceiling, to show average/scaleMax as a percent; null if the roster no longer resolves. */
  scaleMax: number | null;
  wonAt: string;
};

export type MemberEventTrophies = { categorical: CategoricalTrophy[]; scale: ScaleTrophy[] };

/**
 * A member's event trophies, from the ledger (never by rescanning snapshots). Categorical wins collapse into
 * a ×N count per emoji, like the Errômetro; scale wins name the event and the average, most recent first.
 * Two events may have different custom emojis under the same id: the most recent win's event decides how a
 * categorical count is shown, deterministically.
 */
export function memberEventTrophies(
  wins: readonly TrophyWinRow[],
  events: ReadonlyMap<string, EventInfo>,
): MemberEventTrophies {
  const byRecency = [...wins].sort((a, b) => b.wonAt.getTime() - a.wonAt.getTime());
  const resolve = (w: TrophyWinRow) => events.get(w.eventId)?.roster.find((o) => o.id === w.emojiId);

  const categorical = new Map<string, CategoricalTrophy>();
  for (const w of byRecency.filter((x) => x.votingType === 'categorical')) {
    const current = categorical.get(w.emojiId);
    if (current) {
      current.winCount += 1;
      continue;
    }
    const emoji = resolve(w);
    categorical.set(w.emojiId, {
      emojiId: w.emojiId,
      char: emoji?.char ?? '🏆',
      trophyName: emoji?.trophyName ?? DEFAULT_TROPHY_NAME,
      glowRgb: emoji?.glowRgb ?? DEFAULT_TROPHY_GLOW_RGB,
      winCount: 1,
    });
  }

  const scale = byRecency
    .filter((w) => w.votingType === 'scale')
    .map((w): ScaleTrophy => {
      const emoji = resolve(w);
      return {
        eventId: w.eventId,
        eventTitle: events.get(w.eventId)?.title ?? 'Evento',
        emojiId: w.emojiId,
        char: emoji?.char ?? '🏆',
        label: emoji?.label ?? w.emojiId,
        trophyName: emoji?.trophyName ?? DEFAULT_TROPHY_NAME,
        glowRgb: emoji?.glowRgb ?? DEFAULT_TROPHY_GLOW_RGB,
        average: w.magnitude,
        scaleMax: emoji?.scaleMax ?? null,
        wonAt: w.wonAt.toISOString(),
      };
    });

  return {
    categorical: [...categorical.values()].sort(
      (a, b) => b.winCount - a.winCount || a.emojiId.localeCompare(b.emojiId),
    ),
    scale,
  };
}
