// Eventos tables. Every table is per community (createTenantTable, RLS); children reference the event by the
// composite key (community_id, event_id) (D-015), so a row can never point at another community's event.
import { createTenantTable, sql } from '@erre/db';
import {
  type AnyPgColumn,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from '@erre/db/pg-core';

import type { EventStatus, ReleaseMode } from '../domain/lifecycle';
import type { EventSnapshotPayload, VotingType } from '../domain/snapshot';

/**
 * A one-off voting event of the community (R-EVT-01). `voting_type` picks the calculator and never changes.
 * `deleted_at` is a soft delete: nothing is removed, every read filters it out. At most one live event
 * (accepting_applications or open) per community (R-EVT-03), guarded by a partial unique index too.
 */
export const events = createTenantTable(
  'eventos_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    votingType: text('voting_type').$type<VotingType>().notNull(),
    status: text('status').$type<EventStatus>().notNull().default('draft'),
    releaseMode: text('release_mode').$type<ReleaseMode>().notNull(),
    scheduledOpenAt: timestamp('scheduled_open_at', { withTimezone: true }),
    scheduledReleaseAt: timestamp('scheduled_release_at', { withTimezone: true }),
    /** "R G B" picked while a draft; null = the banner's default look. Only the banner reads it. */
    bannerRgb: text('banner_rgb'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** When voting opened (accepting_applications → open). */
    openedAt: timestamp('opened_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('eventos_events_status_idx').on(t.communityId, t.status),
    uniqueIndex('eventos_events_one_live_idx')
      .on(t.communityId)
      .where(sql`status IN ('accepting_applications', 'open') AND deleted_at IS NULL`),
  ],
);

/** Composite FK (community_id, event_id) → eventos_events (community_id, id). */
const eventRef = (name: string, t: { communityId: AnyPgColumn; eventId: AnyPgColumn }) =>
  foreignKey({ name, columns: [t.communityId, t.eventId], foreignColumns: [events.communityId, events.id] });

/** The event's roster, in display order. `scale_max` (1-10) only on "scale" events. No `active`: it freezes. */
export const emojiConfig = createTenantTable(
  'eventos_emoji_config',
  {
    eventId: uuid('event_id').notNull(),
    emojiId: text('emoji_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    isCustom: boolean('is_custom').notNull().default(false),
    char: text('char'),
    label: text('label'),
    trophyName: text('trophy_name'),
    description: text('description'),
    glowRgb: text('glow_rgb'),
    scaleMax: integer('scale_max'),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.eventId, t.emojiId] }), eventRef('eventos_emoji_config_event_fk', t)],
);

/** Who signed up: votes in the event and is a target in it (R-EVT-07, P-014). */
export const participants = createTenantTable(
  'eventos_participants',
  {
    eventId: uuid('event_id').notNull(),
    userId: uuid('user_id').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.eventId, t.userId] }), eventRef('eventos_participants_event_fk', t)],
);

/** RSA key pair (RFC 9474 blind signature) per event: a token of one event never votes in another. */
export const signingKeys = createTenantTable(
  'eventos_signing_keys',
  {
    eventId: uuid('event_id').notNull(),
    publicKeyJwk: jsonb('public_key_jwk').$type<JsonWebKey>().notNull(),
    privateKeyJwk: jsonb('private_key_jwk').$type<JsonWebKey>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.eventId] }), eventRef('eventos_signing_keys_event_fk', t)],
);

/**
 * Gate: at most one blind-signed token per (person, event). The ONLY link between a person and voting; never
 * joined with votes. Deliberately NO timestamp (R-ANON-02): issued_at next to voted_at would re-link them.
 */
export const tokenIssuances = createTenantTable(
  'eventos_token_issuances',
  {
    userId: uuid('user_id').notNull(),
    eventId: uuid('event_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId, t.eventId] }),
    eventRef('eventos_token_issuances_event_fk', t),
  ],
);

/**
 * One row per (voter tag, target, emoji): a scale event has one per axis. `value` (1..scale_max) only on scale
 * events. No user: the tag comes from the verified token.
 */
export const votes = createTenantTable(
  'eventos_votes',
  {
    eventId: uuid('event_id').notNull(),
    voterTag: text('voter_tag').notNull(),
    targetId: uuid('target_id').notNull(),
    emojiId: text('emoji_id').notNull(),
    value: integer('value'),
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.eventId, t.voterTag, t.targetId, t.emojiId] }),
    index('eventos_votes_voter_tag_idx').on(t.voterTag, t.communityId, t.eventId),
    eventRef('eventos_votes_event_fk', t),
  ],
);

/** Frozen result, written once when the event closes. `notified_at` claims the "resultado saiu" push once. */
export const snapshots = createTenantTable(
  'eventos_snapshots',
  {
    eventId: uuid('event_id').notNull(),
    payload: jsonb('payload').$type<EventSnapshotPayload>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.eventId] }), eventRef('eventos_snapshots_event_fk', t)],
);

/**
 * Every trophy an event awarded, written from the frozen snapshot when it closes (never recomputed). Ties
 * write nothing. `magnitude` is the winning count (categorical) or average (scale), exact decimal.
 */
export const trophyWins = createTenantTable(
  'eventos_trophy_wins',
  {
    eventId: uuid('event_id').notNull(),
    emojiId: text('emoji_id').notNull(),
    winnerUserId: uuid('winner_user_id').notNull(),
    votingType: text('voting_type').$type<VotingType>().notNull(),
    magnitude: numeric('magnitude', { precision: 8, scale: 2 }).notNull(),
    wonAt: timestamp('won_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.eventId, t.emojiId] }),
    index('eventos_trophy_wins_winner_idx').on(t.communityId, t.winnerUserId),
    eventRef('eventos_trophy_wins_event_fk', t),
  ],
);

export const tables = [events, emojiConfig, participants, signingKeys, tokenIssuances, votes, snapshots, trophyWins];
