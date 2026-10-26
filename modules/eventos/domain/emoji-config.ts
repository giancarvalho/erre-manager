// Portado de queridometro@7c5c5bf:src/lib/events/voting-event-emoji-config.ts (parte pura: resolver e
// validar o roster). Reading and saving the rows is in api/server/events.ts.
import {
  DEFAULT_TROPHY_GLOW_RGB,
  EMOJI_DESCRIPTIONS,
  EMOJI_OPTIONS,
  isSingleGrapheme,
  MAX_DESCRIPTION_LENGTH,
  trophyGlowRgbForEmoji,
  trophyNameForEmoji,
} from '@erre/emoji';

import { MAX_ACTIVE_EMOJIS, MAX_SCALE_AXES, MAX_SCALE_MAX, MIN_ACTIVE_EMOJIS, MIN_SCALE_MAX } from './limits';
import { isValidRgbTriplet } from './lifecycle';
import type { VotingType } from './snapshot';

/**
 * One row of eventos_emoji_config. Same shape as the Errômetro roster (custom fields only on custom rows) with
 * no `active`: the whole roster freezes with the event. `scaleMax` (1-10) only on "scale" events.
 */
export type EventEmojiRow = {
  emojiId: string;
  sortOrder: number;
  isCustom: boolean;
  char: string | null;
  label: string | null;
  trophyName: string | null;
  description: string | null;
  glowRgb: string | null;
  scaleMax: number | null;
};

export type ResolvedEventEmoji = {
  id: string;
  char: string;
  label: string;
  trophyName: string;
  isCustom: boolean;
  description: string | null;
  glowRgb: string;
  scaleMax: number | null;
};

/** What the event settings send per emoji/axis. `scaleMax` is required on "scale" and refused otherwise. */
export type EventEmojiEntryInput =
  | { isCustom: false; emojiId: string; scaleMax?: number | undefined }
  | {
      isCustom: true;
      emojiId?: string | undefined;
      char: string;
      label: string;
      trophyName: string;
      description?: string | undefined;
      glowRgb?: string | undefined;
      scaleMax?: number | undefined;
    };

const CATALOG_BY_ID = new Map(EMOJI_OPTIONS.map((o) => [o.id, o]));

export function resolveEventEmoji(row: EventEmojiRow): ResolvedEventEmoji {
  if (row.isCustom) {
    return {
      id: row.emojiId,
      char: row.char ?? '❓',
      label: row.label ?? row.emojiId,
      trophyName: row.trophyName ?? trophyNameForEmoji(row.emojiId),
      isCustom: true,
      description: row.description,
      glowRgb: row.glowRgb && isValidRgbTriplet(row.glowRgb) ? row.glowRgb : DEFAULT_TROPHY_GLOW_RGB,
      scaleMax: row.scaleMax,
    };
  }
  const catalog = CATALOG_BY_ID.get(row.emojiId);
  return {
    id: row.emojiId,
    char: catalog?.char ?? '❓',
    label: catalog?.label ?? row.emojiId,
    trophyName: trophyNameForEmoji(row.emojiId),
    isCustom: false,
    description: EMOJI_DESCRIPTIONS[row.emojiId] ?? null,
    glowRgb: trophyGlowRgbForEmoji(row.emojiId),
    scaleMax: row.scaleMax,
  };
}

export type NewIdFn = () => string;
const defaultNewId: NewIdFn = () => `custom-${crypto.randomUUID().slice(0, 8)}`;

/**
 * Validates an event's full roster (always a full replace) and builds the rows, or returns the pt-BR error.
 * Unlike the Errômetro, an empty roster is never "the whole catalog": an event's roster is built explicitly.
 * The caller checks the event is still a draft (the roster locks when it is published, R-EVT-04).
 */
export function buildEventEmojiRows(
  votingType: VotingType,
  entries: readonly EventEmojiEntryInput[],
  newId: NewIdFn = defaultNewId,
): { ok: true; rows: EventEmojiRow[] } | { ok: false; error: string } {
  if (entries.length < MIN_ACTIVE_EMOJIS) return { ok: false, error: 'Escolha pelo menos 1 emoji.' };
  const isScale = votingType === 'scale';
  if (isScale) {
    if (entries.length > MAX_SCALE_AXES)
      return { ok: false, error: `No máximo ${MAX_SCALE_AXES} eixos em um evento de escala.` };
  } else if (entries.length > MAX_ACTIVE_EMOJIS) {
    return { ok: false, error: `No máximo ${MAX_ACTIVE_EMOJIS} emojis ativos.` };
  }

  const rows: EventEmojiRow[] = [];
  const seenIds = new Set<string>();

  for (const [i, entry] of entries.entries()) {
    let scaleMax: number | null = null;
    if (isScale) {
      if (
        entry.scaleMax === undefined ||
        !Number.isInteger(entry.scaleMax) ||
        entry.scaleMax < MIN_SCALE_MAX ||
        entry.scaleMax > MAX_SCALE_MAX
      ) {
        return {
          ok: false,
          error: `A escala de cada emoji precisa ser um número inteiro entre ${MIN_SCALE_MAX} e ${MAX_SCALE_MAX}.`,
        };
      }
      scaleMax = entry.scaleMax;
    } else if (entry.scaleMax !== undefined) {
      return { ok: false, error: 'Evento categórico não tem escala por emoji.' };
    }

    if (entry.isCustom) {
      const char = entry.char.trim();
      const label = entry.label.trim();
      const trophyName = entry.trophyName.trim();
      const description = entry.description?.trim() ?? '';
      if (!isSingleGrapheme(char)) return { ok: false, error: 'O emoji custom precisa ser um único emoji.' };
      if (label.length === 0 || label.length > 40)
        return { ok: false, error: 'Nome do emoji precisa ter entre 1 e 40 caracteres.' };
      if (trophyName.length === 0 || trophyName.length > 60)
        return { ok: false, error: 'Nome do troféu precisa ter entre 1 e 60 caracteres.' };
      if (description.length > MAX_DESCRIPTION_LENGTH)
        return { ok: false, error: `Descrição precisa ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.` };
      const glowRgb = entry.glowRgb && isValidRgbTriplet(entry.glowRgb) ? entry.glowRgb : null;
      let emojiId = entry.emojiId;
      if (emojiId) {
        if (seenIds.has(emojiId)) return { ok: false, error: 'Emoji repetido.' };
      } else {
        emojiId = newId();
        while (seenIds.has(emojiId)) emojiId = newId();
      }
      seenIds.add(emojiId);
      rows.push({
        emojiId,
        sortOrder: i,
        isCustom: true,
        char,
        label,
        trophyName,
        description: description.length > 0 ? description : null,
        glowRgb,
        scaleMax,
      });
    } else {
      if (!CATALOG_BY_ID.has(entry.emojiId)) return { ok: false, error: 'Emoji do catálogo inválido.' };
      if (seenIds.has(entry.emojiId)) return { ok: false, error: 'Emoji repetido.' };
      seenIds.add(entry.emojiId);
      rows.push({
        emojiId: entry.emojiId,
        sortOrder: i,
        isCustom: false,
        char: null,
        label: null,
        trophyName: null,
        description: null,
        glowRgb: null,
        scaleMax,
      });
    }
  }
  return { ok: true, rows };
}
