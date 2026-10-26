// Portado de queridometro@7c5c5bf:src/domain/voting/calendar.ts
import { parseISO, subDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DEFAULT_VOTING_TIMEZONE = 'America/Sao_Paulo';

let cachedVotingTimeZone: string | null = null;

/**
 * IANA time zone for interpreting the voting calendar day (after the noon cutoff).
 * Override with `VOTING_TIMEZONE` (e.g. America/Sao_Paulo).
 */
export function getVotingTimeZone(): string {
  if (cachedVotingTimeZone) return cachedVotingTimeZone;
  const fromEnv = process.env.VOTING_TIMEZONE?.trim();
  if (fromEnv) {
    if (!isValidIanaTimeZone(fromEnv)) {
      throw new Error(`Invalid VOTING_TIMEZONE "${fromEnv}". Use a valid IANA time zone (e.g. America/Sao_Paulo).`);
    }
    cachedVotingTimeZone = fromEnv;
  } else {
    cachedVotingTimeZone = DEFAULT_VOTING_TIMEZONE;
  }
  return cachedVotingTimeZone;
}

/** @internal */
export function resetVotingTimeZoneCacheForTests(): void {
  cachedVotingTimeZone = null;
}

function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The most recently completed noon-to-noon window in `timeZone`: `to` is the
 * last 12:00 at or before `now`, `from` is the 12:00 exactly 24h earlier.
 * This is both the window the daily close job (cron + manual admin
 * recompute) aggregates, and — via `to`'s calendar date — the cutoff
 * `getVotingDay` uses. Keeping both derived from this one function means
 * a vote cast at any instant always lands in the same "day" everywhere:
 * on the voting screen and in the closed snapshot.
 */
export function getNoonCutWindow(now: Date, timeZone?: string): { from: Date; to: Date } {
  const zone = timeZone ?? getVotingTimeZone();
  const todayYmd = formatInTimeZone(now, zone, 'yyyy-MM-dd');
  const todayNoon = fromZonedTime(`${todayYmd}T12:00:00`, zone);
  const to = now >= todayNoon ? todayNoon : subDays(todayNoon, 1);
  const from = subDays(to, 1);
  return { from, to };
}

/**
 * Dia de votação (YYYY-MM-DD): o dia civil do início da janela meio-dia a
 * meio-dia corrente (ver `getNoonCutWindow`). O dia vira ao meio-dia local,
 * não à meia-noite — mesmo corte usado pelo fechamento diário, então um
 * voto dado às 08:00 ainda pertence ao dia anterior em todo lugar (tela de
 * votação e apuração), sem essa banda de rótulo divergente.
 */
export function getVotingDay(date: Date, timeZone?: string): string {
  const zone = timeZone ?? getVotingTimeZone();
  if (!isValidIanaTimeZone(zone)) {
    throw new Error(`Invalid time zone "${zone}".`);
  }
  const { to } = getNoonCutWindow(date, zone);
  return formatInTimeZone(to, zone, 'yyyy-MM-dd');
}

/**
 * Previous calendar YYYY-MM-DD in UTC, relative to a voting day string.
 * Used by the close-day job: the day to freeze is the one before the current
 * getVotingDay(now) right after noon in the product sense.
 */
export function getPreviousVotingDay(ymd: string): string {
  const d = parseISO(ymd + 'T12:00:00.000Z');
  return formatInTimeZone(subDays(d, 1), 'UTC', 'yyyy-MM-dd');
}
