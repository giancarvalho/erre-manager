// Portado de queridometro@7c5c5bf:src/lib/events/voting-events.ts (validações de criar e editar rascunho)
// e src/lib/color/rgb.ts (isValidRgbTriplet). Reading and writing the rows is in api/server/events.ts.
import { MAX_EVENT_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from './limits';
import type { VotingType } from './snapshot';

/**
 * "draft" (roster being built) → "accepting_applications" (published: roster locked, members sign up, nobody
 * votes yet) → "open" (votes) → "closed" (snapshot frozen). Soft delete at any status (R-EVT-01).
 */
export type EventStatus = 'draft' | 'accepting_applications' | 'open' | 'closed';

/** One mode governs both transitions: an admin action each ("manual"), or two instants set upfront. */
export type ReleaseMode = 'manual' | 'scheduled';

export const VOTING_TYPES: readonly VotingType[] = ['categorical', 'scale'];

/** The editable fields of an event (all locked once it leaves "draft", R-EVT-04). */
export type EventFields = {
  title: string;
  description: string | null;
  releaseMode: ReleaseMode;
  scheduledOpenAt: Date | null;
  scheduledReleaseAt: Date | null;
  /** "R G B" chosen for the banner while a draft; null = the banner's default look. */
  bannerRgb: string | null;
};

export type NewEventInput = {
  title: string;
  description?: string | undefined;
  votingType: VotingType;
  releaseMode: ReleaseMode;
  scheduledOpenAt?: Date | undefined;
  scheduledReleaseAt?: Date | undefined;
};

export type DraftPatch = {
  title?: string | undefined;
  description?: string | null | undefined;
  releaseMode?: ReleaseMode | undefined;
  scheduledOpenAt?: Date | null | undefined;
  scheduledReleaseAt?: Date | null | undefined;
  bannerRgb?: string | null | undefined;
};

export type FieldsResult = { ok: true; fields: EventFields } | { ok: false; error: string };

const RGB_TRIPLET_RE = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/;

/** "R G B", each channel 0-255. */
export function isValidRgbTriplet(value: string): boolean {
  const match = RGB_TRIPLET_RE.exec(value);
  if (!match) return false;
  return [1, 2, 3].every((i) => Number(match[i]) <= 255);
}

/**
 * "manual" has neither date (an admin triggers each transition); "scheduled" needs both, in the future, open
 * strictly before close (R-EVT-02).
 */
export function validateReleaseFields(
  releaseMode: ReleaseMode,
  scheduledOpenAt: Date | null | undefined,
  scheduledReleaseAt: Date | null | undefined,
  now: Date,
): string | null {
  if (releaseMode === 'manual') {
    if (scheduledOpenAt || scheduledReleaseAt) return 'Liberação manual não pode ter datas agendadas.';
    return null;
  }
  if (!scheduledOpenAt || !scheduledReleaseAt)
    return 'Liberação agendada precisa de uma data de abertura e uma de fechamento.';
  if (scheduledOpenAt.getTime() <= now.getTime()) return 'A data de abertura precisa estar no futuro.';
  if (scheduledReleaseAt.getTime() <= scheduledOpenAt.getTime())
    return 'A data de fechamento precisa ser depois da data de abertura.';
  return null;
}

const titleError = `Título precisa ter entre 1 e ${MAX_TITLE_LENGTH} caracteres.`;
const descriptionError = `Descrição precisa ter no máximo ${MAX_EVENT_DESCRIPTION_LENGTH} caracteres.`;

/** Validates a new event (always created as "draft", with no banner color: it's picked while editing). */
export function validateNewEvent(input: NewEventInput, now: Date): FieldsResult {
  const title = input.title.trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return { ok: false, error: titleError };
  const description = input.description?.trim() ?? '';
  if (description.length > MAX_EVENT_DESCRIPTION_LENGTH) return { ok: false, error: descriptionError };
  if (!VOTING_TYPES.includes(input.votingType)) return { ok: false, error: 'Tipo de votação inválido.' };
  const releaseError = validateReleaseFields(input.releaseMode, input.scheduledOpenAt, input.scheduledReleaseAt, now);
  if (releaseError) return { ok: false, error: releaseError };
  return {
    ok: true,
    fields: {
      title,
      description: description.length > 0 ? description : null,
      releaseMode: input.releaseMode,
      scheduledOpenAt: input.scheduledOpenAt ?? null,
      scheduledReleaseAt: input.scheduledReleaseAt ?? null,
      bannerRgb: null,
    },
  };
}

/**
 * Applies a draft edit over the current fields: omitted keys keep their value, `null` clears. The release
 * triple is validated as a whole after merging. The voting type is never editable (a new type is a new event).
 * The caller checks the event is still a draft.
 */
export function applyDraftPatch(existing: EventFields, patch: DraftPatch, now: Date): FieldsResult {
  const title = patch.title !== undefined ? patch.title.trim() : existing.title;
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return { ok: false, error: titleError };

  let description = existing.description;
  if (patch.description !== undefined) {
    const trimmed = patch.description?.trim() ?? '';
    if (trimmed.length > MAX_EVENT_DESCRIPTION_LENGTH) return { ok: false, error: descriptionError };
    description = trimmed.length > 0 ? trimmed : null;
  }

  const releaseMode = patch.releaseMode ?? existing.releaseMode;
  const scheduledOpenAt = patch.scheduledOpenAt !== undefined ? patch.scheduledOpenAt : existing.scheduledOpenAt;
  const scheduledReleaseAt =
    patch.scheduledReleaseAt !== undefined ? patch.scheduledReleaseAt : existing.scheduledReleaseAt;
  const releaseError = validateReleaseFields(releaseMode, scheduledOpenAt, scheduledReleaseAt, now);
  if (releaseError) return { ok: false, error: releaseError };

  let bannerRgb = existing.bannerRgb;
  if (patch.bannerRgb !== undefined) {
    if (patch.bannerRgb !== null && !isValidRgbTriplet(patch.bannerRgb))
      return { ok: false, error: 'Cor do banner inválida.' };
    bannerRgb = patch.bannerRgb;
  }

  return { ok: true, fields: { title, description, releaseMode, scheduledOpenAt, scheduledReleaseAt, bannerRgb } };
}

/**
 * Publishing (draft → accepting_applications) checks, besides the one-live-event rule the server enforces:
 * a roster, and for "scheduled" both dates still ahead of `now` and in order (R-EVT-02).
 */
export function publishProblem(
  event: { releaseMode: ReleaseMode; scheduledOpenAt: Date | null; scheduledReleaseAt: Date | null },
  rosterSize: number,
  now: Date,
): string | null {
  if (rosterSize === 0) return 'Adicione pelo menos um emoji ao evento antes de publicá-lo.';
  if (event.releaseMode === 'scheduled') {
    if (!event.scheduledOpenAt || event.scheduledOpenAt.getTime() <= now.getTime())
      return 'A data agendada de abertura precisa estar no futuro para publicar o evento.';
    if (!event.scheduledReleaseAt || event.scheduledReleaseAt.getTime() <= event.scheduledOpenAt.getTime())
      return 'A data agendada de fechamento precisa ser depois da de abertura.';
  }
  return null;
}
