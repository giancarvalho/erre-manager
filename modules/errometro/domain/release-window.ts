// Portado de queridometro@7c5c5bf:src/domain/voting/release-window.ts
import { addDays, subDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getVotingTimeZone } from './calendar';

/**
 * Generalizes calendar.ts's fixed daily-noon cutover into a configurable
 * release cadence. This is the ONE place group-configurable "how often do
 * results release" logic lives — every anonymous-voting entry point resolves
 * its anchor day through this module, so a future per-group settings lookup
 * only needs to change what `ReleaseConfig` gets passed in here.
 *
 * With the default config (daily, hour 12), getReleaseWindow/getReleaseAnchorDay
 * are byte-identical to calendar.ts's getNoonCutWindow/getVotingDay — see
 * release-window.test.ts for the pinning test. Nothing about today's (legacy,
 * demo, non-anonymous) behavior changes; this module is additive.
 */

/**
 * "daily"/"weekly" are legacy-only going forward — the UI never creates new
 * configs with these values (see ReleaseCadenceForm.tsx), but existing
 * groups already persisted with them keep working exactly as before
 * forever, through the exact same code paths this module has always used
 * for them. "custom" (arbitrary weekday subset) is what the UI creates now;
 * it's a strict generalization — a "custom" config with all 7 weekdays or
 * with exactly 1 weekday computes identically to "daily"/"weekly"
 * respectively (see the pinning tests), it's just never how new configs of
 * that shape get created anymore.
 */
export type ReleaseFrequency = 'daily' | 'weekly' | 'custom' | 'manual';

/**
 * "manual" has no schedule to look forward to, so getNextReleaseInstant
 * pushes `to` this far out — far enough that the cron close job (which skips
 * a group whenever `now < to`) never fires on its own, while still being
 * offset from `from` (not a fixed date) so every manual round keeps its own
 * unique anchor/signing-key pair. The user-visible release label is derived
 * separately at actual close time (see recomputeGroupSnapshot) — this value
 * never reaches the UI.
 */
const MANUAL_NO_SCHEDULE_DAYS = 36_500;

export type ReleaseConfig = {
  frequency: ReleaseFrequency;
  /** Local hour (0-23) results release / the period rolls over. */
  releaseHour: number;
  /** ISO weekday (1=Monday..7=Sunday) results release on. Legacy — only ever read for "weekly", never written by new saves. */
  releaseWeekday?: number;
  /** ISO weekdays (1=Monday..7=Sunday), 1-7 entries, no duplicates. Required for "custom", ignored otherwise. */
  releaseWeekdays?: number[];
};

/** Matches today's fixed behavior: every group defaults to this until a per-group setting exists. */
export const DEFAULT_RELEASE_CONFIG: ReleaseConfig = {
  frequency: 'daily',
  releaseHour: 12,
};

/**
 * The current global release cadence for real (non-demo) groups: weekly,
 * closing Monday at noon. Applied app-wide for now — there is only one real
 * group, so per-group configuration is deliberately deferred (see
 * getGroupReleaseWindow's doc comment). ISO weekday 1 = Monday.
 */
export const ACTIVE_RELEASE_CONFIG: ReleaseConfig = {
  frequency: 'weekly',
  releaseHour: 12,
  releaseWeekday: 1,
};

/** Exported so callers persisting a group's own config (see group-release-schedule.ts) can validate before saving, not just at read time. */
export function assertValidConfig(config: ReleaseConfig): void {
  if (!Number.isInteger(config.releaseHour) || config.releaseHour < 0 || config.releaseHour > 23) {
    throw new Error(`Invalid releaseHour "${config.releaseHour}". Must be an integer 0-23.`);
  }
  if (config.frequency === 'weekly') {
    const w = config.releaseWeekday;
    if (w === undefined || !Number.isInteger(w) || w < 1 || w > 7) {
      throw new Error(
        `Invalid releaseWeekday "${w}". Weekly frequency requires an integer 1-7 (ISO: Monday=1..Sunday=7).`,
      );
    }
  }
  if (config.frequency === 'custom') {
    const days = config.releaseWeekdays;
    if (!Array.isArray(days) || days.length < 1 || days.length > 7) {
      throw new Error('Invalid releaseWeekdays. Custom frequency requires an array of 1-7 weekdays.');
    }
    const seen = new Set<number>();
    for (const d of days) {
      if (!Number.isInteger(d) || d < 1 || d > 7) {
        throw new Error(`Invalid weekday "${d}" in releaseWeekdays. Must be an integer 1-7 (ISO: Monday=1..Sunday=7).`);
      }
      if (seen.has(d)) {
        throw new Error(`Duplicate weekday "${d}" in releaseWeekdays.`);
      }
      seen.add(d);
    }
  }
}

/** Fixed period length, only meaningful for "daily"/"weekly" — "custom" has an irregular period (handled by releaseWindowForCustomWeekdays below) and "manual" has none. */
function periodDaysFor(config: ReleaseConfig): number {
  if (config.frequency === 'manual' || config.frequency === 'custom') {
    throw new Error(
      "getReleaseWindow/getReleaseAnchorDay não têm sentido para cadência manual/custom (não há período fixo pra olhar 'pra trás'). Use getGroupReleaseWindow, que olha 'pra frente' a partir do último release real.",
    );
  }
  return config.frequency === 'weekly' ? 7 : 1;
}

/**
 * Backward-scan variant of getReleaseWindow, only for "custom" (arbitrary
 * weekday subset). Unlike "manual", a weekday subset has no periodicity
 * ambiguity — any Monday or Thursday in the set always counts, there's no
 * "every other week" parity question to resolve — so, unlike manual, pure
 * calendar math (no release history needed) stays well-defined here.
 */
function releaseWindowForCustomWeekdays(config: ReleaseConfig, now: Date, zone: string): { from: Date; to: Date } {
  const activeDays = new Set(config.releaseWeekdays);
  const hh = String(config.releaseHour).padStart(2, '0');

  function mostRecentCutoverAtOrBefore(instant: Date): Date {
    const ymd = formatInTimeZone(instant, zone, 'yyyy-MM-dd');
    let candidate = fromZonedTime(`${ymd}T${hh}:00:00`, zone);
    if (candidate > instant) candidate = subDays(candidate, 1);
    for (let i = 0; i < 7; i++) {
      const isoWeekday = Number(formatInTimeZone(candidate, zone, 'i'));
      if (activeDays.has(isoWeekday)) return candidate;
      candidate = subDays(candidate, 1);
    }
    // Unreachable: assertValidConfig guarantees releaseWeekdays is non-empty.
    throw new Error('releaseWeekdays vazio — deveria ter sido rejeitado por assertValidConfig.');
  }

  const to = mostRecentCutoverAtOrBefore(now);
  const from = mostRecentCutoverAtOrBefore(subDays(to, 1));
  return { from, to };
}

/**
 * The most recently completed release window: `to` is the last release
 * instant at or before `now`, `from` is exactly one period (1 or 7 days)
 * earlier. A token/vote/signing-key anchored to this window's day (see
 * getReleaseAnchorDay) stays valid for the ENTIRE window, no matter which
 * day inside it the request happens on.
 */
export function getReleaseWindow(config: ReleaseConfig, now: Date, timeZone?: string): { from: Date; to: Date } {
  assertValidConfig(config);
  const zone = timeZone ?? getVotingTimeZone();

  if (config.frequency === 'custom') {
    return releaseWindowForCustomWeekdays(config, now, zone);
  }

  const periodDays = periodDaysFor(config);

  const todayYmd = formatInTimeZone(now, zone, 'yyyy-MM-dd');
  const hh = String(config.releaseHour).padStart(2, '0');
  let candidateCutover = fromZonedTime(`${todayYmd}T${hh}:00:00`, zone);

  if (config.frequency === 'weekly') {
    const isoWeekday = Number(formatInTimeZone(candidateCutover, zone, 'i'));
    const daysBack = (isoWeekday - config.releaseWeekday! + 7) % 7;
    candidateCutover = subDays(candidateCutover, daysBack);
  }

  const to = now >= candidateCutover ? candidateCutover : subDays(candidateCutover, periodDays);
  const from = subDays(to, periodDays);
  return { from, to };
}

/**
 * The next release instant (releaseWeekday/releaseHour for weekly,
 * releaseHour for daily) strictly AFTER `from`. Unlike getReleaseWindow
 * (which looks *backward* from `now` to the most recently completed
 * boundary — correct in steady state, wrong across a cadence change), this
 * looks *forward* from a fixed anchor: given `from` = a group's last actual
 * release, it always returns the next upcoming one, whether that's "next
 * Monday" (transitioning today) or "the Monday after" (steady state).
 */
export function getNextReleaseInstant(config: ReleaseConfig, from: Date, timeZone?: string): Date {
  assertValidConfig(config);
  if (config.frequency === 'manual') {
    return addDays(from, MANUAL_NO_SCHEDULE_DAYS);
  }
  const zone = timeZone ?? getVotingTimeZone();
  const hh = String(config.releaseHour).padStart(2, '0');

  const fromYmd = formatInTimeZone(from, zone, 'yyyy-MM-dd');
  let candidate = fromZonedTime(`${fromYmd}T${hh}:00:00`, zone);
  if (candidate <= from) candidate = addDays(candidate, 1);

  if (config.frequency === 'weekly') {
    const isoWeekday = Number(formatInTimeZone(candidate, zone, 'i'));
    const daysForward = (config.releaseWeekday! - isoWeekday + 7) % 7;
    candidate = addDays(candidate, daysForward);
  } else if (config.frequency === 'custom') {
    const activeDays = new Set(config.releaseWeekdays);
    for (let i = 0; i < 7; i++) {
      const isoWeekday = Number(formatInTimeZone(candidate, zone, 'i'));
      if (activeDays.has(isoWeekday)) break;
      candidate = addDays(candidate, 1);
    }
  }

  return candidate;
}

/**
 * A group's current release window, anchored to its own release history
 * instead of pure calendar math: `from` is the group's last actual release
 * (or its creation date, if it has never released yet), `to` is the next
 * scheduled release strictly after that. This is what lets a one-off manual
 * delay (e.g. pushing today's release to Monday noon) propagate correctly
 * into every future cycle without special-casing — `to` is always derived
 * from where the *previous* period actually ended, not from `now`.
 *
 * Global for now (single `config`, no per-group override) — see
 * ACTIVE_RELEASE_CONFIG's doc comment.
 */
export function getGroupReleaseWindow(
  config: ReleaseConfig,
  lastReleaseAt: Date,
  timeZone?: string,
): { from: Date; to: Date } {
  return { from: lastReleaseAt, to: getNextReleaseInstant(config, lastReleaseAt, timeZone) };
}

/**
 * The anchor day (YYYY-MM-DD) identifying the current release period — the
 * generalized `votingDay`. Stable across every instant inside the same
 * window, so a signing key / token / stored vote keyed by this value is
 * valid (and update-overwrites correctly) for the whole period, and rolls
 * over automatically the instant the next window begins.
 */
export function getReleaseAnchorDay(config: ReleaseConfig, now: Date, timeZone?: string): string {
  const zone = timeZone ?? getVotingTimeZone();
  const { to } = getReleaseWindow(config, now, zone);
  return formatInTimeZone(to, zone, 'yyyy-MM-dd');
}
