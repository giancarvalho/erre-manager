// What the event screens show, as pure functions. Ported in behavior from queridometro@7c5c5bf:
// src/components/group/events/EventResultsRanking.tsx (ordenação e escala em %),
// src/components/group/events/EventResultsTrophyList.tsx, src/app/group/[id]/page.tsx (qual banner o hub mostra)
// e src/app/group/[id]/events/page.tsx (rótulos e ordem da lista).
import type { BuildEventShareMessageOptions, EventShareTrophyRow } from './share-message';
import type { EventSnapshotPayload } from './snapshot';
import type { EventStatus } from './lifecycle';

export type Person = { displayName: string; avatarVariant: string };
export type EmojiInfo = { id: string; char: string; label: string; trophyName: string; scaleMax: number | null };

/** A target who left the community shows without a name (legacy "Alguém"). */
export const UNKNOWN_PERSON: Person = { displayName: 'Alguém', avatarVariant: 'slate' };

export const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Rascunho',
  accepting_applications: 'Aceitando inscrições',
  open: 'Em votação',
  closed: 'Encerrado',
};

const STATUS_ORDER: Record<EventStatus, number> = { open: 0, accepting_applications: 1, draft: 2, closed: 3 };

/** Open first, then taking applications, drafts, closed; newest first within each. */
export function sortEvents<T extends { status: EventStatus; createdAt: string }>(events: readonly T[]): T[] {
  return [...events].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt),
  );
}

/** How long a closed event's banner stays on the hub. */
export const RESULTS_BANNER_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * The one event the hub highlights: the open one, else the one taking applications, else the most recently
 * CLOSED one within 2 days (never "most recently created": drafts don't count).
 */
export function hubEvent<T extends { status: EventStatus; closedAt: string | null }>(
  events: readonly T[],
  now: Date,
): T | null {
  const open = events.find((e) => e.status === 'open');
  if (open) return open;
  const accepting = events.find((e) => e.status === 'accepting_applications');
  if (accepting) return accepting;
  const closed = events
    .filter((e): e is T & { closedAt: string } => e.status === 'closed' && e.closedAt !== null)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))[0];
  return closed && now.getTime() - new Date(closed.closedAt).getTime() <= RESULTS_BANNER_GRACE_MS ? closed : null;
}

/** average/scaleMax as a whole percent, so axes with different ceilings read on the same 0–100 scale. */
export function scalePercent(average: number, scaleMax: number | null): number {
  return Math.round((average / (scaleMax ?? 10)) * 100);
}

/** "70%", or "×3" on a ceiling-1 axis (where every average is 1.00 and only the count says something). */
export function scaleMagnitudeLabel(average: number, sum: number, scaleMax: number | null): string {
  return scaleMax === 1 ? `×${sum}` : `${scalePercent(average, scaleMax)}%`;
}

export type CategoricalRow = {
  targetId: string;
  person: Person;
  byEmoji: { emojiId: string; char: string; count: number }[];
  total: number;
};

/** Every target with at least one vote, by total (ties by name). */
export function categoricalRanking(
  result: Extract<EventSnapshotPayload, { votingType: 'categorical' }>,
  emojis: ReadonlyMap<string, EmojiInfo>,
  people: Readonly<Record<string, Person>>,
): CategoricalRow[] {
  return result.targets
    .map((t) => ({
      targetId: t.targetId,
      person: people[t.targetId] ?? UNKNOWN_PERSON,
      byEmoji: t.byEmoji
        .filter((e) => e.count > 0)
        .map((e) => ({ emojiId: e.emojiId, char: emojis.get(e.emojiId)?.char ?? '❓', count: e.count })),
      total: t.total,
    }))
    .sort((a, b) => b.total - a.total || a.person.displayName.localeCompare(b.person.displayName, 'pt-BR'));
}

export type ScaleAxis = {
  emoji: EmojiInfo;
  rows: { targetId: string; person: Person; average: number; sum: number; voteCount: number; label: string }[];
};

/**
 * One leaderboard per axis (no combined total across different ceilings), in roster order. Ordered by the
 * exact ratio (or by count on a ceiling-1 axis), ties by name. Axes nobody rated are left out.
 */
export function scaleAxes(
  result: Extract<EventSnapshotPayload, { votingType: 'scale' }>,
  roster: readonly EmojiInfo[],
  people: Readonly<Record<string, Person>>,
): ScaleAxis[] {
  return roster.flatMap((emoji) => {
    const binary = emoji.scaleMax === 1;
    const rows = result.targets
      .flatMap((t) =>
        t.byEmoji
          .filter((e) => e.emojiId === emoji.id)
          .map((e) => ({
            targetId: t.targetId,
            person: people[t.targetId] ?? UNKNOWN_PERSON,
            average: e.average,
            sum: e.sum,
            voteCount: e.voteCount,
            label: scaleMagnitudeLabel(e.average, e.sum, emoji.scaleMax),
          })),
      )
      .sort(
        (a, b) =>
          (binary ? b.sum - a.sum : b.sum * a.voteCount - a.sum * b.voteCount) ||
          a.person.displayName.localeCompare(b.person.displayName, 'pt-BR'),
      );
    return rows.length > 0 ? [{ emoji, rows }] : [];
  });
}

export type TrophyView = {
  emoji: EmojiInfo;
  winner: { targetId: string; person: Person } | null;
  tied: Person[];
  /** "×5" (categorical, or a ceiling-1 axis) or "73%" (scale). */
  magnitude: string;
};

/** The event's trophies with names; a tie shows who tied and awards nobody. */
export function trophyViews(
  result: EventSnapshotPayload,
  emojis: ReadonlyMap<string, EmojiInfo>,
  people: Readonly<Record<string, Person>>,
): TrophyView[] {
  const person = (id: string) => people[id] ?? UNKNOWN_PERSON;
  const fallback = (id: string): EmojiInfo => ({ id, char: '🏆', label: id, trophyName: 'Troféu', scaleMax: null });
  if (result.votingType === 'scale') {
    return result.trophies.map((t) => {
      const emoji = emojis.get(t.emojiId) ?? fallback(t.emojiId);
      return {
        emoji,
        winner: t.winnerTargetId ? { targetId: t.winnerTargetId, person: person(t.winnerTargetId) } : null,
        tied: t.tiedTargetIds.map(person),
        magnitude: emoji.scaleMax === 1 ? `×${t.average}` : `${scalePercent(t.average, emoji.scaleMax)}%`,
      };
    });
  }
  return result.trophies.map((t) => ({
    emoji: emojis.get(t.emojiId) ?? fallback(t.emojiId),
    winner: t.winnerTargetId ? { targetId: t.winnerTargetId, person: person(t.winnerTargetId) } : null,
    tied: t.tiedTargetIds.map(person),
    magnitude: `×${t.count}`,
  }));
}

/** What "Compartilhar resultado" sends: trophies won, then the ranking, then the link (legacy format). */
export function shareOptions(input: {
  title: string;
  closedAtLabel: string;
  resultsUrl: string;
  result: EventSnapshotPayload;
  roster: readonly EmojiInfo[];
  people: Readonly<Record<string, Person>>;
}): BuildEventShareMessageOptions {
  const emojis = new Map(input.roster.map((e) => [e.id, e]));
  const trophies: EventShareTrophyRow[] = trophyViews(input.result, emojis, input.people).flatMap((t) =>
    t.winner ? [{ char: t.emoji.char, trophyName: t.emoji.trophyName, winnerName: t.winner.person.displayName }] : [],
  );
  const shared = {
    eventTitle: input.title,
    closedAtLabel: input.closedAtLabel,
    trophies,
    resultsUrl: input.resultsUrl,
  };
  if (input.result.votingType === 'scale') {
    return {
      ...shared,
      votingType: 'scale',
      axes: scaleAxes(input.result, input.roster, input.people).map((a) => ({
        char: a.emoji.char,
        label: a.emoji.label,
        rows: a.rows.map((r) => ({ name: r.person.displayName, magnitudeLabel: r.label })),
      })),
    };
  }
  return {
    ...shared,
    votingType: 'categorical',
    rows: categoricalRanking(input.result, emojis, input.people).map((r) => ({
      name: r.person.displayName,
      emojis: r.byEmoji.map((e) => ({ char: e.char, count: e.count })),
    })),
  };
}
