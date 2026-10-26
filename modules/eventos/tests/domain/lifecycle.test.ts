// Portado de queridometro@7c5c5bf:src/lib/events/voting-events.test.ts e da parte de validação de
// src/lib/events/close-voting-event.test.ts (openApplications), contra as funções puras de lifecycle.ts.
import { describe, expect, it } from 'vitest';

import {
  applyDraftPatch,
  publishProblem,
  validateNewEvent,
  type EventFields,
  type NewEventInput,
} from '../../domain/lifecycle';
import { MAX_EVENT_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '../../domain/limits';

const NOW = new Date('2026-05-01T12:00:00Z');
const at = (iso: string) => new Date(iso);
const base: NewEventInput = { title: 'Festa', votingType: 'categorical', releaseMode: 'manual' };

const error = (r: ReturnType<typeof validateNewEvent>) => (r.ok ? null : r.error);

describe('validateNewEvent', () => {
  it('recusa título vazio', () => {
    expect(error(validateNewEvent({ ...base, title: '   ' }, NOW))).toMatch(/Título/);
  });

  it('recusa título maior que o limite', () => {
    expect(error(validateNewEvent({ ...base, title: 'a'.repeat(MAX_TITLE_LENGTH + 1) }, NOW))).toMatch(/Título/);
  });

  it('recusa descrição maior que o limite', () => {
    expect(
      error(validateNewEvent({ ...base, description: 'a'.repeat(MAX_EVENT_DESCRIPTION_LENGTH + 1) }, NOW)),
    ).toMatch(/Descrição/);
  });

  it('recusa tipo de votação inválido', () => {
    expect(error(validateNewEvent({ ...base, votingType: 'ranking' as never }, NOW))).toBe('Tipo de votação inválido.');
  });

  it('recusa liberação manual com data de abertura ou de fechamento agendada', () => {
    expect(error(validateNewEvent({ ...base, scheduledOpenAt: at('2026-05-02T00:00:00Z') }, NOW))).toBe(
      'Liberação manual não pode ter datas agendadas.',
    );
    expect(error(validateNewEvent({ ...base, scheduledReleaseAt: at('2026-05-02T00:00:00Z') }, NOW))).toBe(
      'Liberação manual não pode ter datas agendadas.',
    );
  });

  it('recusa liberação agendada sem as duas datas', () => {
    const scheduled = { ...base, releaseMode: 'scheduled' as const };
    const message = 'Liberação agendada precisa de uma data de abertura e uma de fechamento.';
    expect(error(validateNewEvent(scheduled, NOW))).toBe(message);
    expect(error(validateNewEvent({ ...scheduled, scheduledOpenAt: at('2026-05-02T00:00:00Z') }, NOW))).toBe(message);
    expect(error(validateNewEvent({ ...scheduled, scheduledReleaseAt: at('2026-05-02T00:00:00Z') }, NOW))).toBe(
      message,
    );
  });

  it('recusa abertura no passado, ou exatamente agora (precisa ser estritamente futura)', () => {
    const scheduled = { ...base, releaseMode: 'scheduled' as const, scheduledReleaseAt: at('2026-05-03T00:00:00Z') };
    expect(error(validateNewEvent({ ...scheduled, scheduledOpenAt: at('2026-04-30T00:00:00Z') }, NOW))).toBe(
      'A data de abertura precisa estar no futuro.',
    );
    expect(error(validateNewEvent({ ...scheduled, scheduledOpenAt: NOW }, NOW))).toBe(
      'A data de abertura precisa estar no futuro.',
    );
  });

  it('recusa fechamento que não é depois da abertura', () => {
    const open = at('2026-05-02T00:00:00Z');
    expect(
      error(
        validateNewEvent({ ...base, releaseMode: 'scheduled', scheduledOpenAt: open, scheduledReleaseAt: open }, NOW),
      ),
    ).toBe('A data de fechamento precisa ser depois da data de abertura.');
  });

  it('aceita abertura 1 ms no futuro com fechamento logo depois (limite)', () => {
    const open = new Date(NOW.getTime() + 1);
    const r = validateNewEvent(
      { ...base, releaseMode: 'scheduled', scheduledOpenAt: open, scheduledReleaseAt: new Date(NOW.getTime() + 2) },
      NOW,
    );
    expect(r.ok).toBe(true);
  });

  it('apara título e descrição; descrição vazia vira null; cor do banner sempre null na criação', () => {
    const r = validateNewEvent({ ...base, title: '  Festa  ', description: '   ' }, NOW);
    expect(r).toEqual({
      ok: true,
      fields: {
        title: 'Festa',
        description: null,
        releaseMode: 'manual',
        scheduledOpenAt: null,
        scheduledReleaseAt: null,
        bannerRgb: null,
      },
    });
  });

  it('aceita título e descrição exatamente no limite', () => {
    const r = validateNewEvent(
      { ...base, title: 'a'.repeat(MAX_TITLE_LENGTH), description: 'b'.repeat(MAX_EVENT_DESCRIPTION_LENGTH) },
      NOW,
    );
    expect(r.ok).toBe(true);
  });
});

describe('applyDraftPatch', () => {
  const existing: EventFields = {
    title: 'Festa',
    description: 'Descrição',
    releaseMode: 'manual',
    scheduledOpenAt: null,
    scheduledReleaseAt: null,
    bannerRgb: '10 20 30',
  };
  const fields = (r: ReturnType<typeof applyDraftPatch>) => (r.ok ? r.fields : null);

  it('patch vazio preserva todos os campos', () => {
    expect(fields(applyDraftPatch(existing, {}, NOW))).toEqual(existing);
  });

  it('recusa novo título vazio', () => {
    expect(applyDraftPatch(existing, { title: ' ' }, NOW).ok).toBe(false);
  });

  it('edita o título mantendo os demais campos', () => {
    expect(fields(applyDraftPatch(existing, { title: 'Novo' }, NOW))).toEqual({ ...existing, title: 'Novo' });
  });

  it('description: null ou string vazia limpa; omitir preserva', () => {
    expect(fields(applyDraftPatch(existing, { description: null }, NOW))?.description).toBeNull();
    expect(fields(applyDraftPatch(existing, { description: '  ' }, NOW))?.description).toBeNull();
    expect(fields(applyDraftPatch(existing, { title: 'x' }, NOW))?.description).toBe('Descrição');
  });

  it('revalida o trio de liberação ao trocar para agendado sem datas, ou com só uma', () => {
    expect(applyDraftPatch(existing, { releaseMode: 'scheduled' }, NOW).ok).toBe(false);
    expect(
      applyDraftPatch(existing, { releaseMode: 'scheduled', scheduledOpenAt: at('2026-05-02T00:00:00Z') }, NOW).ok,
    ).toBe(false);
  });

  it('troca para agendado com as duas datas no futuro e na ordem', () => {
    const r = applyDraftPatch(
      existing,
      {
        releaseMode: 'scheduled',
        scheduledOpenAt: at('2026-05-02T00:00:00Z'),
        scheduledReleaseAt: at('2026-05-03T00:00:00Z'),
      },
      NOW,
    );
    expect(fields(r)?.releaseMode).toBe('scheduled');
  });

  it('voltar para manual exige limpar as duas datas no mesmo patch', () => {
    const scheduled: EventFields = {
      ...existing,
      releaseMode: 'scheduled',
      scheduledOpenAt: at('2026-05-02T00:00:00Z'),
      scheduledReleaseAt: at('2026-05-03T00:00:00Z'),
    };
    expect(applyDraftPatch(scheduled, { releaseMode: 'manual' }, NOW).ok).toBe(false);
    expect(applyDraftPatch(scheduled, { releaseMode: 'manual', scheduledReleaseAt: null }, NOW).ok).toBe(false);
    const r = applyDraftPatch(
      scheduled,
      { releaseMode: 'manual', scheduledOpenAt: null, scheduledReleaseAt: null },
      NOW,
    );
    expect(fields(r)).toEqual({ ...existing, releaseMode: 'manual' });
  });

  it('cor do banner: recusa malformada ou canal acima de 255; aceita válida; null limpa; omitir preserva', () => {
    expect(applyDraftPatch(existing, { bannerRgb: 'red' }, NOW)).toEqual({
      ok: false,
      error: 'Cor do banner inválida.',
    });
    expect(applyDraftPatch(existing, { bannerRgb: '256 0 0' }, NOW).ok).toBe(false);
    expect(fields(applyDraftPatch(existing, { bannerRgb: '255 255 255' }, NOW))?.bannerRgb).toBe('255 255 255');
    expect(fields(applyDraftPatch(existing, { bannerRgb: null }, NOW))?.bannerRgb).toBeNull();
    expect(fields(applyDraftPatch(existing, { title: 'x' }, NOW))?.bannerRgb).toBe('10 20 30');
  });
});

describe('publishProblem', () => {
  const manual = { releaseMode: 'manual' as const, scheduledOpenAt: null, scheduledReleaseAt: null };

  it('recusa sem roster', () => {
    expect(publishProblem(manual, 0, NOW)).toBe('Adicione pelo menos um emoji ao evento antes de publicá-lo.');
  });

  it('manual com roster publica', () => {
    expect(publishProblem(manual, 1, NOW)).toBeNull();
  });

  it('agendado: recusa abertura que já passou (o tempo andou desde a criação)', () => {
    const r = publishProblem(
      { releaseMode: 'scheduled', scheduledOpenAt: NOW, scheduledReleaseAt: at('2026-05-03T00:00:00Z') },
      1,
      NOW,
    );
    expect(r).toBe('A data agendada de abertura precisa estar no futuro para publicar o evento.');
  });

  it('agendado: recusa fechamento ausente ou não posterior à abertura', () => {
    const open = at('2026-05-02T00:00:00Z');
    const message = 'A data agendada de fechamento precisa ser depois da de abertura.';
    expect(publishProblem({ releaseMode: 'scheduled', scheduledOpenAt: open, scheduledReleaseAt: null }, 1, NOW)).toBe(
      message,
    );
    expect(publishProblem({ releaseMode: 'scheduled', scheduledOpenAt: open, scheduledReleaseAt: open }, 1, NOW)).toBe(
      message,
    );
  });

  it('agendado com as duas datas no futuro e na ordem publica', () => {
    expect(
      publishProblem(
        {
          releaseMode: 'scheduled',
          scheduledOpenAt: at('2026-05-02T00:00:00Z'),
          scheduledReleaseAt: at('2026-05-03T00:00:00Z'),
        },
        1,
        NOW,
      ),
    ).toBeNull();
  });
});
