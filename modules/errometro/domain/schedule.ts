// Portado de queridometro@7c5c5bf:src/lib/voting/group-release-schedule.ts
// Pure version: the caller reads the saved config and the last release from the module's tables.
import { formatInTimeZone } from 'date-fns-tz';

import { getVotingTimeZone } from './calendar';
import { ACTIVE_RELEASE_CONFIG, getGroupReleaseWindow, type ReleaseConfig } from './release-window';

/** The community's own release cadence, or ACTIVE_RELEASE_CONFIG when it never saved one (R-CAL-04). */
export function releaseConfigOrDefault(saved: ReleaseConfig | null): ReleaseConfig {
  return saved ?? ACTIVE_RELEASE_CONFIG;
}

export type PeriodInput = {
  config: ReleaseConfig | null;
  /** createdAt of the latest snapshot (the last actual release), or null before the first one. */
  lastReleaseAt: Date | null;
  communityCreatedAt: Date;
};

/** A round of the Errômetro: `label` (YYYY-MM-DD of `to`) keys the signing key, the issuance and the votes. */
export type Period = { label: string; from: Date; to: Date };

/**
 * The community's current release window, anchored to its own release history (R-CAL-03): `from` is its
 * last actual release (or the community's creation, before the first one), `to` is the next scheduled
 * release after that. The single source the token, the votes and the close derive their round from.
 */
export function currentPeriod({ config, lastReleaseAt, communityCreatedAt }: PeriodInput, timeZone?: string): Period {
  const zone = timeZone ?? getVotingTimeZone();
  const { from, to } = getGroupReleaseWindow(releaseConfigOrDefault(config), lastReleaseAt ?? communityCreatedAt, zone);
  return { label: formatInTimeZone(to, zone, 'yyyy-MM-dd'), from, to };
}
