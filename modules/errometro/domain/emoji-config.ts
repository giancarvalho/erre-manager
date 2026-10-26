// Portado de queridometro@7c5c5bf:src/lib/emojis/group-emoji-config.ts (parte pura: resolver e validar).
// Reading and saving the rows is in server/emojis.ts.
import {
  DEFAULT_TROPHY_GLOW_RGB,
  EMOJI_DESCRIPTIONS,
  EMOJI_OPTIONS,
  isSingleGrapheme,
  MAX_ACTIVE_EMOJIS,
  MAX_DESCRIPTION_LENGTH,
  MIN_ACTIVE_EMOJIS,
  trophyGlowRgbForEmoji,
  trophyNameForEmoji,
} from '@erre/emoji';

/** One row of errometro_emoji_config. char/label/trophyName/description/glowRgb are only set on custom rows. */
export type EmojiConfigRow = {
  emojiId: string;
  sortOrder: number;
  isCustom: boolean;
  active: boolean;
  char: string | null;
  label: string | null;
  trophyName: string | null;
  description: string | null;
  glowRgb: string | null;
};

export type ResolvedEmojiOption = {
  id: string;
  char: string;
  label: string;
  trophyName: string;
  isCustom: boolean;
  /** Shown in the "O que significa cada emoji?" legend — null when not set. */
  description: string | null;
  /** "R G B" triplet for the trophy glow. Always set (falls back to DEFAULT_TROPHY_GLOW_RGB). */
  glowRgb: string;
};

/**
 * What the settings screen sends per active emoji: a catalog id, or a custom one. `emojiId` on a custom
 * entry reuses an existing row (editing/keeping it); omitted only for a brand-new custom emoji.
 * `glowRgb` is computed on the web when the emoji is created (D-042); only its shape is checked here.
 */
export type EmojiEntryInput =
  | { isCustom: false; emojiId: string }
  | {
      isCustom: true;
      emojiId?: string | undefined;
      char: string;
      label: string;
      trophyName: string;
      description?: string | undefined;
      glowRgb?: string | undefined;
    };

/** "R G B", each 0-255 — the shape inferEmojiGlowColor produces. */
const GLOW_RGB_RE = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/;

export function isValidGlowRgb(value: string): boolean {
  const match = GLOW_RGB_RE.exec(value);
  if (!match) return false;
  return [1, 2, 3].every((i) => Number(match[i]) <= 255);
}

const CATALOG_BY_ID = new Map(EMOJI_OPTIONS.map((o) => [o.id, o]));

function resolveRow(row: EmojiConfigRow): ResolvedEmojiOption {
  if (row.isCustom) {
    return {
      id: row.emojiId,
      char: row.char ?? '❓',
      label: row.label ?? row.emojiId,
      trophyName: row.trophyName ?? trophyNameForEmoji(row.emojiId),
      isCustom: true,
      description: row.description,
      glowRgb: row.glowRgb && isValidGlowRgb(row.glowRgb) ? row.glowRgb : DEFAULT_TROPHY_GLOW_RGB,
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
  };
}

export const DEFAULT_CATALOG: readonly ResolvedEmojiOption[] = EMOJI_OPTIONS.map((o) => ({
  ...o,
  trophyName: trophyNameForEmoji(o.id),
  isCustom: false,
  description: EMOJI_DESCRIPTIONS[o.id] ?? null,
  glowRgb: trophyGlowRgbForEmoji(o.id),
}));

/** Active roster in display order. No saved rows = the full global catalog (R-EMO-02). Rows come sorted. */
export function activeEmojiOptions(rows: readonly EmojiConfigRow[]): ResolvedEmojiOption[] {
  if (rows.length === 0) return [...DEFAULT_CATALOG];
  return rows.filter((r) => r.active).map(resolveRow);
}

/**
 * Every emoji id the community could ever display, active or not: the global catalog plus every custom row
 * ever created (custom rows are never deleted, R-EMO-04), to resolve trophies of past rounds.
 */
export function emojiCatalog(rows: readonly EmojiConfigRow[]): Map<string, ResolvedEmojiOption> {
  const map = new Map(DEFAULT_CATALOG.map((o) => [o.id, o]));
  for (const row of rows) {
    if (row.isCustom) map.set(row.emojiId, resolveRow(row));
  }
  return map;
}

export type NewIdFn = () => string;

const defaultNewId: NewIdFn = () => `custom-${crypto.randomUUID().slice(0, 8)}`;

/**
 * Validates the full active roster (always a full replace) and builds the rows to save, or returns the
 * pt-BR error. The caller upserts them and deactivates the rest.
 */
export function buildEmojiConfigRows(
  entries: readonly EmojiEntryInput[],
  newId: NewIdFn = defaultNewId,
): { ok: true; rows: EmojiConfigRow[] } | { ok: false; error: string } {
  if (entries.length < MIN_ACTIVE_EMOJIS) return { ok: false, error: 'Escolha pelo menos 1 emoji.' };
  if (entries.length > MAX_ACTIVE_EMOJIS) return { ok: false, error: `No máximo ${MAX_ACTIVE_EMOJIS} emojis ativos.` };

  const rows: EmojiConfigRow[] = [];
  const seenIds = new Set<string>();

  for (const [i, entry] of entries.entries()) {
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
      const glowRgb = entry.glowRgb && isValidGlowRgb(entry.glowRgb) ? entry.glowRgb : null;
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
        active: true,
        char,
        label,
        trophyName,
        description: description.length > 0 ? description : null,
        glowRgb,
      });
    } else {
      if (!CATALOG_BY_ID.has(entry.emojiId)) return { ok: false, error: 'Emoji do catálogo inválido.' };
      if (seenIds.has(entry.emojiId)) return { ok: false, error: 'Emoji repetido.' };
      seenIds.add(entry.emojiId);
      rows.push({
        emojiId: entry.emojiId,
        sortOrder: i,
        isCustom: false,
        active: true,
        char: null,
        label: null,
        trophyName: null,
        description: null,
        glowRgb: null,
      });
    }
  }
  return { ok: true, rows };
}
