// Portado de queridometro@7c5c5bf:src/lib/jobs/cadence-transition.test.ts
// Sem mocks: a rodada vem de currentPeriod (config + último fechamento), a mesma função que a API usa.
import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';

import { getNextReleaseInstant, type ReleaseConfig } from '../../domain/release-window';
import { currentPeriod } from '../../domain/schedule';

const ZONE = 'America/Sao_Paulo';
const ymd = (d: Date) => formatInTimeZone(d, ZONE, 'yyyy-MM-dd');
const CREATED = new Date('2026-01-01T12:00:00.000Z');

const WEEKLY_MON: ReleaseConfig = { frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 };
const CUSTOM_TUE_FRI: ReleaseConfig = { frequency: 'custom', releaseHour: 18, releaseWeekdays: [2, 5] };
const DAILY_9AM: ReleaseConfig = { frequency: 'daily', releaseHour: 9 };
const CUSTOM_MON_ONLY: ReleaseConfig = { frequency: 'custom', releaseHour: 12, releaseWeekdays: [1] };
const MANUAL: ReleaseConfig = { frequency: 'manual', releaseHour: 12 };

// Terça 2026-07-28, 15:30 em São Paulo: no meio de qualquer ciclo semanal ou bissemanal.
const NOW = new Date('2026-07-28T18:30:00.000Z');

describe("transições de cadência: o fechamento antecipado usa o 'to' da config antiga, e a próxima rodada nunca herda uma âncora obsoleta", () => {
  const transitions: { label: string; from: ReleaseConfig; to: ReleaseConfig }[] = [
    { label: 'semanal → bissemanal (custom terça+sexta)', from: WEEKLY_MON, to: CUSTOM_TUE_FRI },
    { label: 'bissemanal (custom terça+sexta) → semanal', from: CUSTOM_TUE_FRI, to: WEEKLY_MON },
    { label: 'semanal → diária', from: WEEKLY_MON, to: DAILY_9AM },
    { label: 'diária → semanal', from: DAILY_9AM, to: WEEKLY_MON },
    { label: 'diária → bissemanal (custom)', from: DAILY_9AM, to: CUSTOM_TUE_FRI },
    { label: 'bissemanal (custom) → diária', from: CUSTOM_TUE_FRI, to: DAILY_9AM },
    { label: 'custom (1 dia só) → bissemanal (2 dias)', from: CUSTOM_MON_ONLY, to: CUSTOM_TUE_FRI },
    { label: 'semanal → manual', from: WEEKLY_MON, to: MANUAL },
    { label: 'manual → bissemanal (custom)', from: MANUAL, to: CUSTOM_TUE_FRI },
  ];

  for (const { label, from: oldConfig, to: newConfig } of transitions) {
    it(`${label}: o fechamento acha os votos reais (rótulo da config antiga) e a próxima rodada chega em até 7 dias`, () => {
      // A última liberação foi agora mesmo, então o `to` da config antiga cai depois de NOW: fechamento antecipado.
      const before = currentPeriod({ config: oldConfig, lastReleaseAt: NOW, communityCreatedAt: CREATED }, ZONE);
      expect(before.label).toBe(ymd(getNextReleaseInstant(oldConfig, NOW, ZONE)));

      // O fechamento grava o snapshot com createdAt = NOW (a âncora); a config nova conta a partir daí.
      const after = currentPeriod({ config: newConfig, lastReleaseAt: NOW, communityCreatedAt: CREATED }, ZONE);
      expect(after.from).toEqual(NOW);
      const daysAhead = (after.to.getTime() - NOW.getTime()) / 86_400_000;
      if (newConfig.frequency === 'manual') expect(daysAhead).toBeGreaterThan(365);
      else {
        expect(daysAhead).toBeGreaterThanOrEqual(0);
        expect(daysAhead).toBeLessThanOrEqual(7);
      }
    });
  }

  it("cenário r-uberlandia (semanal → terça+sexta numa terça à tarde): o rótulo é a 'próxima segunda' da config antiga", () => {
    const lastMonday = new Date('2026-07-27T15:00:00.000Z'); // segunda 12h em São Paulo
    const round = currentPeriod({ config: WEEKLY_MON, lastReleaseAt: lastMonday, communityCreatedAt: CREATED }, ZONE);
    expect(round.label).toBe('2026-08-03');
    const next = currentPeriod({ config: CUSTOM_TUE_FRI, lastReleaseAt: NOW, communityCreatedAt: CREATED }, ZONE);
    expect(next.from).toEqual(NOW);
    expect(next.to).toEqual(new Date('2026-07-28T21:00:00.000Z')); // a própria terça, 18h
  });
});
