// "Faltam 3h pra fechar" once per round. Ported from queridometro@7c5c5bf:
// src/lib/notifications/notify-closing-reminder.ts and src/lib/jobs/send-closing-reminders.ts.
import type { Tx } from '@erre/db';

import { CLOSING_REMINDER_BODIES, pickRandom } from '../../domain/notification-copy';
import { releaseConfigOrDefault } from '../../domain/schedule';
import { releaseReminders } from '../../db/schema';
import { hasApprovedParticipants, type RoundNotifier } from './close';
import { resolveRound } from './round';

/** How long before the scheduled close the reminder goes out. */
export const CLOSING_REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;

/**
 * Polled on every tick: a no-op outside the lead window, after the close, or on a manual cadence (no `to` to
 * count down to). Claims the round in errometro_release_reminders, so it is sent at most once (R-NOT-01).
 */
export async function sendClosingReminder(tx: Tx, n: RoundNotifier, now: Date): Promise<boolean> {
  const round = await resolveRound(tx, n.community);
  if (releaseConfigOrDefault(round.config).frequency === 'manual') return false;
  const msUntilClose = round.to.getTime() - now.getTime();
  if (msUntilClose <= 0 || msUntilClose > CLOSING_REMINDER_LEAD_MS) return false;

  const claimed = await tx
    .insert(releaseReminders)
    .values({ communityId: n.community.id, period: round.label })
    .onConflictDoNothing()
    .returning({ period: releaseReminders.period });
  if (claimed.length === 0) return false;
  if (!(await hasApprovedParticipants(tx, n.community.id))) return false;
  const members = await n.members.list();
  if (members.length === 0) return false;
  await n.notify({
    userIds: members.map((m) => m.userId),
    type: 'errometro.lembrete_fechamento',
    title: `Faltam 3h pra fechar a rodada do ${n.community.name} ⏰`,
    body: pickRandom(CLOSING_REMINDER_BODIES),
    route: `/errometro?comunidade=${n.community.id}`,
  });
  return true;
}
