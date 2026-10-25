import { createTenantTable } from '@erre/db';
import { boolean, pgTable, primaryKey, text, timestamp, uuid } from '@erre/db/pg-core';

import { ROLES } from '../shared/community';

const ts = (name: string) => timestamp(name, { withTimezone: true });

// Better Auth models (migration core_0001). Property names are Better Auth's field names.
export const authUser = pgTable('auth_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const authSession = pgTable('auth_session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: ts('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const authAccount = pgTable('auth_account', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: ts('access_token_expires_at'),
  refreshTokenExpiresAt: ts('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const authVerification = pgTable('auth_verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const coreProfiles = pgTable('core_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  avatarVariant: text('avatar_variant').notNull(),
  nameConfirmedAt: ts('name_confirmed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const MEMBERSHIP_STATUSES = ['pending', 'approved', 'rejected', 'removed'] as const;

export const memberships = createTenantTable(
  'core_community_memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ROLES }).notNull(),
    status: text('status', { enum: MEMBERSHIP_STATUSES }).notNull(),
    requestedAt: ts('requested_at').notNull().defaultNow(),
    reviewedAt: ts('reviewed_at'),
    reviewedBy: uuid('reviewed_by').references(() => authUser.id, { onDelete: 'set null' }),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })],
);

export const rolePermissions = createTenantTable(
  'core_role_permissions',
  {
    role: text('role', { enum: ROLES }).notNull(),
    permission: text('permission').notNull(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.role, t.permission] })],
);
