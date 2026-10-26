// Portado de queridometro@7c5c5bf:src/domain/voting/calendar.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getVotingDay,
  getVotingTimeZone,
  getPreviousVotingDay,
  getNoonCutWindow,
  resetVotingTimeZoneCacheForTests,
} from '../../domain/calendar';

afterEach(() => {
  vi.unstubAllEnvs();
  resetVotingTimeZoneCacheForTests();
});

describe('getVotingDay', () => {
  it('just after noon BRT: still the same calendar day', () => {
    // 15:04 UTC = 12:04 BRT (UTC-3, no DST) — matches the cron's own fire time
    const t = new Date('2025-04-22T15:04:00.000Z');
    expect(getVotingDay(t, 'America/Sao_Paulo')).toBe('2025-04-22');
  });

  it('before noon BRT: still belongs to the previous calendar day', () => {
    // 11:00 UTC = 08:00 BRT, before noon — same cutoff the close job uses
    const t = new Date('2025-04-22T11:00:00.000Z');
    const day = getVotingDay(t, 'America/Sao_Paulo');
    expect(day).toBe('2025-04-21');
  });

  it('exactly at noon BRT: counts as the new day', () => {
    const t = new Date('2025-04-22T15:00:00.000Z');
    expect(getVotingDay(t, 'America/Sao_Paulo')).toBe('2025-04-22');
  });

  it('uses VOTING_TIMEZONE when not passing explicit zone', () => {
    vi.stubEnv('VOTING_TIMEZONE', 'UTC');
    resetVotingTimeZoneCacheForTests();
    expect(getVotingTimeZone()).toBe('UTC');
    // 13:00Z is after noon UTC — same calendar day
    const t = new Date('2025-04-22T13:00:00.000Z');
    expect(getVotingDay(t)).toBe('2025-04-22');
  });
});

describe('getVotingTimeZone', () => {
  it('rejects invalid env', () => {
    vi.stubEnv('VOTING_TIMEZONE', 'NotA/Zone');
    resetVotingTimeZoneCacheForTests();
    expect(() => getVotingTimeZone()).toThrow(/Invalid/);
  });
});

describe('getPreviousVotingDay', () => {
  it('returns the prior calendar day for a YMD string', () => {
    expect(getPreviousVotingDay('2025-04-22')).toBe('2025-04-21');
  });
});

describe('getNoonCutWindow', () => {
  it("just after today's noon BRT: window is [ontem 12:00, hoje 12:00)", () => {
    // 12:04 BRT (UTC-3) = 15:04 UTC — matches the cron's own fire time
    const now = new Date('2025-04-22T15:04:00.000Z');
    const { from, to } = getNoonCutWindow(now, 'America/Sao_Paulo');
    expect(to.toISOString()).toBe('2025-04-22T15:00:00.000Z');
    expect(from.toISOString()).toBe('2025-04-21T15:00:00.000Z');
  });

  it("before today's noon BRT: falls back to the previous completed window", () => {
    // 08:00 BRT = 11:00 UTC, still before today's noon
    const now = new Date('2025-04-22T11:00:00.000Z');
    const { from, to } = getNoonCutWindow(now, 'America/Sao_Paulo');
    expect(to.toISOString()).toBe('2025-04-21T15:00:00.000Z');
    expect(from.toISOString()).toBe('2025-04-20T15:00:00.000Z');
  });

  it("exactly at noon BRT: today's noon counts as reached", () => {
    const now = new Date('2025-04-22T15:00:00.000Z');
    const { from, to } = getNoonCutWindow(now, 'America/Sao_Paulo');
    expect(to.toISOString()).toBe('2025-04-22T15:00:00.000Z');
    expect(from.toISOString()).toBe('2025-04-21T15:00:00.000Z');
  });

  it('uses getVotingTimeZone() when no explicit zone is passed', () => {
    vi.stubEnv('VOTING_TIMEZONE', 'UTC');
    resetVotingTimeZoneCacheForTests();
    const now = new Date('2025-04-22T13:00:00.000Z');
    const { from, to } = getNoonCutWindow(now);
    expect(to.toISOString()).toBe('2025-04-22T12:00:00.000Z');
    expect(from.toISOString()).toBe('2025-04-21T12:00:00.000Z');
  });
});
