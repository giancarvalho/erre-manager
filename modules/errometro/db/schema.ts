// Errômetro tables. Every table is per community (createTenantTable, RLS); the community scopes everything.
// `period` is the round label (YYYY-MM-DD of the window's `to`, R-CAL-05), the legacy `voting_day`.
import { createTenantTable } from '@erre/db';
import { boolean, date, index, integer, jsonb, primaryKey, text, timestamp, uuid } from '@erre/db/pg-core';

export type ParticipantStatus = 'pending' | 'approved' | 'rejected' | 'removed';

/** Approval to vote (legacy group_members.voting_status). Approved only while the membership is approved. */
export const participants = createTenantTable(
  'errometro_participants',
  {
    userId: uuid('user_id').notNull(),
    status: text('status').$type<ParticipantStatus>().notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by'),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })],
);

/**
 * Release cadence override. No row = ACTIVE_RELEASE_CONFIG (weekly, Monday noon; R-CAL-04). `frequency`
 * "daily"/"weekly" and `release_weekday` are legacy values kept with their exact semantics (R-CAL-02).
 */
export const releaseConfig = createTenantTable(
  'errometro_release_config',
  {
    frequency: text('frequency').$type<'daily' | 'weekly' | 'custom' | 'manual'>().notNull(),
    releaseHour: integer('release_hour').notNull(),
    releaseWeekday: integer('release_weekday'),
    releaseWeekdays: integer('release_weekdays').array(),
  },
  (t) => [primaryKey({ columns: [t.communityId] })],
);

/**
 * Emoji roster: catalog emojis switched on plus custom ones, in display order. No rows = the full global
 * catalog (R-EMO-02). A custom row is never deleted, only deactivated: past snapshots reference it (R-EMO-04).
 */
export const emojiConfig = createTenantTable(
  'errometro_emoji_config',
  {
    emojiId: text('emoji_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    isCustom: boolean('is_custom').notNull().default(false),
    active: boolean('active').notNull().default(true),
    char: text('char'),
    label: text('label'),
    trophyName: text('trophy_name'),
    description: text('description'),
    glowRgb: text('glow_rgb'),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.emojiId] }),
    index('errometro_emoji_config_sort_idx').on(t.communityId, t.sortOrder),
  ],
);

/** RSA key pair (RFC 9474 blind signature) per community and round. */
export const signingKeys = createTenantTable(
  'errometro_signing_keys',
  {
    period: date('period', { mode: 'string' }).notNull(),
    publicKeyJwk: jsonb('public_key_jwk').$type<JsonWebKey>().notNull(),
    privateKeyJwk: jsonb('private_key_jwk').$type<JsonWebKey>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.period] })],
);

/**
 * Gate: at most one blind-signed token per (person, community, round). The ONLY place a person is linked
 * to voting; never joined with votes (which have no user at all).
 *
 * Deliberately stores NO timestamp (R-ANON-02): a precise issued_at, paired with the votes' voted_at,
 * would let the server align issuance order to vote order and re-link voter to vote by timing (one token
 * per person and round makes it a bijection). The primary key alone is the gate; `period` carries no
 * sub-day timing.
 */
export const tokenIssuances = createTenantTable(
  'errometro_token_issuances',
  {
    userId: uuid('user_id').notNull(),
    period: date('period', { mode: 'string' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId, t.period] })],
);

/** One row = one (voter tag, target) choice in a round. No user: the tag comes from the verified token. */
export const votes = createTenantTable(
  'errometro_votes',
  {
    period: date('period', { mode: 'string' }).notNull(),
    voterTag: text('voter_tag').notNull(),
    targetId: uuid('target_id').notNull(),
    emojiId: text('emoji_id').notNull(),
    /** Set on insert, bumped on every update. */
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.period, t.voterTag, t.targetId] }),
    index('errometro_votes_period_idx').on(t.communityId, t.period),
    index('errometro_votes_voter_tag_idx').on(t.voterTag, t.communityId, t.period),
    index('errometro_votes_voted_at_idx').on(t.communityId, t.votedAt),
  ],
);

/**
 * Frozen result of a round. `created_at` is the release instant and anchors the next round (R-CAL-03).
 * `hidden` unpublishes without deleting (deleting would move the anchor, R-RES-07). `notified_at` is the
 * claim-once marker of the "resultado saiu" push (R-RES-04).
 */
export const snapshots = createTenantTable(
  'errometro_snapshots',
  {
    period: date('period', { mode: 'string' }).notNull(),
    payload: jsonb('payload').$type<SnapshotPayload>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean('hidden').notNull().default(false),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.period] }),
    index('errometro_snapshots_created_at_idx').on(t.communityId, t.createdAt),
  ],
);

export type SnapshotPayload = {
  targets: { targetId: string; byEmoji: { emojiId: string; count: number }[]; total: number }[];
};

/** Claim-once marker of the "3h to close" reminder per round. */
export const releaseReminders = createTenantTable(
  'errometro_release_reminders',
  {
    period: date('period', { mode: 'string' }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.period] })],
);

/** Member comments on a target's result in a round (Sprint 13). The author's name comes from ctx.members. */
export const comments = createTenantTable(
  'errometro_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetId: uuid('target_id').notNull(),
    authorId: uuid('author_id').notNull(),
    period: date('period', { mode: 'string' }).notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    index('errometro_comments_period_idx').on(t.communityId, t.period),
    index('errometro_comments_target_idx').on(t.communityId, t.targetId, t.period),
  ],
);

export const tables = [
  participants,
  releaseConfig,
  emojiConfig,
  signingKeys,
  tokenIssuances,
  votes,
  snapshots,
  releaseReminders,
  comments,
];
