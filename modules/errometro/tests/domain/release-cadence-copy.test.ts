// Portado de queridometro@7c5c5bf:src/lib/voting/release-cadence-copy.test.ts
import { describe, expect, it } from 'vitest';
import { describeReleaseCadence, formatReleaseInstant } from '../../domain/release-cadence-copy';

describe('describeReleaseCadence', () => {
  it('manual', () => {
    expect(describeReleaseCadence({ frequency: 'manual', releaseHour: 12 })).toBe(
      'Sem cadência fixa — o criador libera quando quiser',
    );
  });

  it('daily (legacy)', () => {
    expect(describeReleaseCadence({ frequency: 'daily', releaseHour: 9 })).toBe('Todo dia às 9h');
  });

  it('weekly (legacy)', () => {
    expect(describeReleaseCadence({ frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 })).toBe(
      'Toda segunda às 12h',
    );
  });

  it('custom com um dia', () => {
    expect(describeReleaseCadence({ frequency: 'custom', releaseHour: 18, releaseWeekdays: [2] })).toBe(
      'Toda terça às 18h',
    );
  });

  it('custom com dois dias', () => {
    expect(describeReleaseCadence({ frequency: 'custom', releaseHour: 18, releaseWeekdays: [5, 2] })).toBe(
      'Toda terça e sexta às 18h',
    );
  });

  it('custom com três dias', () => {
    expect(
      describeReleaseCadence({
        frequency: 'custom',
        releaseHour: 18,
        releaseWeekdays: [5, 1, 3],
      }),
    ).toBe('Toda segunda, quarta e sexta às 18h');
  });

  it('custom com todos os 7 dias equivale a diária', () => {
    expect(
      describeReleaseCadence({
        frequency: 'custom',
        releaseHour: 9,
        releaseWeekdays: [1, 2, 3, 4, 5, 6, 7],
      }),
    ).toBe('Todo dia às 9h');
  });
});

describe('formatReleaseInstant', () => {
  it('weekday and hour in the voting time zone (DESIGN §11)', () => {
    expect(formatReleaseInstant(new Date('2026-07-27T15:00:00.000Z'), 'America/Sao_Paulo')).toBe('segunda, 12h');
    expect(formatReleaseInstant(new Date('2026-07-31T21:30:00.000Z'), 'America/Sao_Paulo')).toBe('sexta, 18h30');
    expect(formatReleaseInstant(new Date('2026-08-02T02:00:00.000Z'), 'America/Sao_Paulo')).toBe('sábado, 23h');
  });
});
