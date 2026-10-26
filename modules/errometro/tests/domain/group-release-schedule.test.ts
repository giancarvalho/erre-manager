// Portado de queridometro@7c5c5bf:src/lib/voting/group-release-schedule.test.ts
// The persistence mocks became plain inputs: currentPeriod receives the saved config and the last release.
import { describe, expect, it } from 'vitest';

import { ACTIVE_RELEASE_CONFIG } from '../../domain/release-window';
import { currentPeriod, releaseConfigOrDefault } from '../../domain/schedule';

const TZ = 'America/Sao_Paulo';

describe('releaseConfigOrDefault', () => {
  it('sem override salvo, usa ACTIVE_RELEASE_CONFIG (padrão global)', () => {
    expect(releaseConfigOrDefault(null)).toEqual(ACTIVE_RELEASE_CONFIG);
  });

  it('com override salvo, usa a config própria da comunidade', () => {
    expect(releaseConfigOrDefault({ frequency: 'daily', releaseHour: 8 })).toEqual({
      frequency: 'daily',
      releaseHour: 8,
    });
  });
});

describe('currentPeriod', () => {
  it('troca de cadência no meio do ciclo só afeta a próxima janela, ancorada no último release real', () => {
    // Último release real: segunda 2026-06-15 12h BRT (regime semanal antigo).
    const lastRelease = new Date('2026-06-15T15:00:00.000Z');
    // A comunidade troca pra cadência diária, 9h, algum momento depois do último release.
    const { from, to, label } = currentPeriod(
      {
        config: { frequency: 'daily', releaseHour: 9 },
        lastReleaseAt: lastRelease,
        communityCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      TZ,
    );
    // `from` continua ancorado no último release real (não muda retroativamente).
    expect(from).toEqual(lastRelease);
    // `to` já reflete a nova cadência: próximo 9h BRT (12:00 UTC) após o último release.
    expect(to).toEqual(new Date('2026-06-16T12:00:00.000Z'));
    expect(label).toBe('2026-06-16');
  });

  it('comunidade sem release anterior ancora na data de criação', () => {
    const createdAt = new Date('2026-06-10T12:00:00.000Z');
    const { from } = currentPeriod(
      { config: { frequency: 'daily', releaseHour: 9 }, lastReleaseAt: null, communityCreatedAt: createdAt },
      TZ,
    );
    expect(from).toEqual(createdAt);
  });

  it('sem config, a rodada fecha na segunda seguinte ao meio-dia (R-CAL-04)', () => {
    // Quarta 2026-06-17 10h BRT.
    const { to, label } = currentPeriod(
      { config: null, lastReleaseAt: null, communityCreatedAt: new Date('2026-06-17T13:00:00.000Z') },
      TZ,
    );
    expect(to).toEqual(new Date('2026-06-22T15:00:00.000Z'));
    expect(label).toBe('2026-06-22');
  });
});
