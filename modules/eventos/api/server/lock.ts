// Advisory locks of Eventos, transaction-scoped.
import { sql, type Tx } from '@erre/db';

/**
 * Per event: issuing a token and storing a ballot take it shared; closing takes it exclusive, so no ballot
 * lands between the tally and the status flip.
 */
export async function lockEvent(tx: Tx, eventId: string, mode: 'shared' | 'exclusive'): Promise<void> {
  const key = sql`hashtextextended(${`eventos:event:${eventId}`}, 0)`;
  await tx.execute(
    mode === 'shared' ? sql`SELECT pg_advisory_xact_lock_shared(${key})` : sql`SELECT pg_advisory_xact_lock(${key})`,
  );
}

/** Per community: serializes publishing, so the one-live-event check (R-EVT-03) sees every commit. */
export async function lockLiveSlot(tx: Tx, communityId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`eventos:live:${communityId}`}, 0))`);
}
