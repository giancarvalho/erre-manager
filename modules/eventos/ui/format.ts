// Dates of the event screens, in the device's time zone (the legacy form also took and showed local time).

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const longDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' });

/** "10/05/2026 às 20:00" (legacy "dd/MM/yyyy 'às' HH:mm"). */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso)).replace(', ', ' às ');
}

/** "10 de maio de 2026", for the shared result. */
export function formatLongDate(iso: string): string {
  return longDate.format(new Date(iso));
}

/** "dd/mm/aaaa" + "hh:mm" typed in the form → Date in the device's time zone, or null when invalid. */
export function parseLocalDateTime(date: string, time: string): Date | null {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [day, month, year, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (hour > 23 || minute > 59) return null;
  const result = new Date(year, month - 1, day, hour, minute);
  // Rejects 31/02 and the like (Date rolls them over to the next month).
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The inverse, to prefill the form. */
export function toLocalFields(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
