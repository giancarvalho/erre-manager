// Portado de queridometro@7c5c5bf:src/lib/voting/release-cadence-copy.ts
import { formatInTimeZone } from 'date-fns-tz';

import type { ReleaseConfig } from './release-window';

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'segunda',
  2: 'terça',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
  7: 'domingo',
};

function hourLabel(hour: number): string {
  return `${hour}h`;
}

/** "segunda", "segunda e sexta", "segunda, quarta e sexta" — Oxford-less pt-BR list join. */
function joinWeekdayNames(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d] ?? '?');
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/**
 * One-line human description of a group's release cadence, e.g. "Toda
 * terça e sexta às 18h" or "Todo dia às 9h" — shown on the voting page so
 * members know what to expect without digging into Configurações. Mirrors
 * the weekday-set logic ReleaseCadenceForm.tsx uses for the settings editor
 * (daily/weekly are legacy-only values, still handled the same way here).
 */
export function describeReleaseCadence(config: ReleaseConfig): string {
  if (config.frequency === 'manual') {
    return 'Sem cadência fixa — o criador libera quando quiser';
  }
  if (config.frequency === 'daily') {
    return `Todo dia às ${hourLabel(config.releaseHour)}`;
  }
  if (config.frequency === 'weekly') {
    const day = config.releaseWeekday ? WEEKDAY_NAMES[config.releaseWeekday] : undefined;
    return day ? `Toda ${day} às ${hourLabel(config.releaseHour)}` : `Toda semana às ${hourLabel(config.releaseHour)}`;
  }
  const days = config.releaseWeekdays ?? [];
  if (days.length === 7) return `Todo dia às ${hourLabel(config.releaseHour)}`;
  if (days.length === 0) return `Às ${hourLabel(config.releaseHour)}`;
  return `Toda ${joinWeekdayNames(days)} às ${hourLabel(config.releaseHour)}`;
}

/**
 * A release instant as the app shows it (DESIGN §11): "segunda, 12h", "sexta, 18h30", in the voting time zone.
 * Not in the legacy (it wrote "segunda-feira às 12:00"): the new format follows the design guide.
 */
export function formatReleaseInstant(at: Date, timeZone: string): string {
  const weekday = Number(formatInTimeZone(at, timeZone, 'i'));
  const hour = Number(formatInTimeZone(at, timeZone, 'H'));
  const minute = formatInTimeZone(at, timeZone, 'mm');
  return `${WEEKDAY_NAMES[weekday] ?? '?'}, ${hour}h${minute === '00' ? '' : minute}`;
}
