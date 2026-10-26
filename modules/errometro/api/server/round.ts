// The current round of a community: cadence, last release and the lock that keeps them stable while a
// token is issued, a ballot is stored or the round is closed.
import { desc, eq, sql, type Tx } from '@erre/db';

import type { ReleaseConfig } from '../../domain/release-window';
import { currentPeriod, type Period } from '../../domain/schedule';
import { releaseConfig, snapshots } from '../../db/schema';

/**
 * Transaction-level advisory lock on the community's round. Issuing a token and storing a ballot take it
 * shared; closing the round and changing the cadence take it exclusive. Without it, a vote could resolve
 * the round under the old cadence while a cadence change commits and land on an orphaned label (the race
 * the legacy left open, `legado:src/app/actions/group-release-config.ts`).
 */
export async function lockRound(tx: Tx, communityId: string, mode: 'shared' | 'exclusive'): Promise<void> {
  const key = sql`hashtextextended(${`errometro:round:${communityId}`}, 0)`;
  await tx.execute(
    mode === 'shared' ? sql`SELECT pg_advisory_xact_lock_shared(${key})` : sql`SELECT pg_advisory_xact_lock(${key})`,
  );
}

export async function loadReleaseConfig(tx: Tx, communityId: string): Promise<ReleaseConfig | null> {
  const [row] = await tx.select().from(releaseConfig).where(eq(releaseConfig.communityId, communityId));
  if (!row) return null;
  return {
    frequency: row.frequency,
    releaseHour: row.releaseHour,
    ...(row.releaseWeekday !== null ? { releaseWeekday: row.releaseWeekday } : {}),
    ...(row.releaseWeekdays !== null ? { releaseWeekdays: row.releaseWeekdays } : {}),
  };
}

export async function saveReleaseConfig(tx: Tx, communityId: string, config: ReleaseConfig): Promise<void> {
  // Only the fields of the chosen frequency are stored (legacy: release_weekday only for "weekly").
  const values = {
    frequency: config.frequency,
    releaseHour: config.releaseHour,
    releaseWeekday: config.frequency === 'weekly' ? (config.releaseWeekday ?? null) : null,
    releaseWeekdays: config.frequency === 'custom' ? (config.releaseWeekdays ?? null) : null,
  };
  await tx
    .insert(releaseConfig)
    .values({ communityId, ...values })
    .onConflictDoUpdate({ target: releaseConfig.communityId, set: values });
}

/** createdAt of the latest snapshot, hidden ones included (hiding never moves the anchor, R-RES-07). */
export async function lastReleaseAt(tx: Tx, communityId: string): Promise<Date | null> {
  const [row] = await tx
    .select({ createdAt: snapshots.createdAt })
    .from(snapshots)
    .where(eq(snapshots.communityId, communityId))
    .orderBy(desc(snapshots.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

export type RoundState = Period & { config: ReleaseConfig | null };

/** The community's current round (R-CAL-03): label, window and the saved cadence (null = default). */
export async function resolveRound(tx: Tx, community: { id: string; createdAt: Date }): Promise<RoundState> {
  // The window comes from release history, not from the clock (R-CAL-03).
  const config = await loadReleaseConfig(tx, community.id);
  const last = await lastReleaseAt(tx, community.id);
  return { ...currentPeriod({ config, lastReleaseAt: last, communityCreatedAt: community.createdAt }), config };
}
