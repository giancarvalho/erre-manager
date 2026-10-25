import { randomBytes } from 'node:crypto';

import { and, communities, desc, eq, isNull, withTenantTx, type Db, type Tx } from '@erre/db';

import { errors } from './errors';
import type { InvitePreview, InviteView, MembershipStatus } from '../shared/types';
import type { MembershipHooks } from './hooks';
import { invites, memberships } from './schema';

const TOKEN_RE = /^[A-Za-z0-9_-]{22}[A-Za-z0-9_-]{12}$/;

/** Public invite code: base64url of the community id (22 chars) + a random secret (12 chars, 72 bits). */
export function encodeInviteCode(communityId: string, secret: string): string {
  return Buffer.from(communityId.replaceAll('-', ''), 'hex').toString('base64url') + secret;
}

export function decodeInviteCode(code: string): { communityId: string; secret: string } | null {
  if (!TOKEN_RE.test(code)) return null;
  const hex = Buffer.from(code.slice(0, 22), 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const communityId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { communityId, secret: code.slice(22) };
}

const invalidInvite = () =>
  errors.notFound('Esse convite não vale mais. Peça um novo link a quem administra a comunidade.');

export type { InvitePreview, InviteView, MembershipStatus } from '../shared/types';

export async function createInvite(
  tx: Tx,
  hooks: MembershipHooks,
  communityId: string,
  actorId: string,
  intent: string | null,
) {
  if (intent && !hooks.intents.some((i) => i.id === intent)) {
    throw errors.validation('Esse convite inclui algo que não existe neste app.');
  }
  const secret = randomBytes(9).toString('base64url');
  const [row] = await tx.insert(invites).values({ communityId, secret, intent, createdBy: actorId }).returning();
  return toView(row!);
}

function toView(r: typeof invites.$inferSelect): InviteView {
  return {
    id: r.id,
    code: encodeInviteCode(r.communityId, r.secret),
    intent: r.intent,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listInvites(tx: Tx, communityId: string): Promise<InviteView[]> {
  const rows = await tx
    .select()
    .from(invites)
    .where(and(eq(invites.communityId, communityId), isNull(invites.revokedAt)))
    .orderBy(desc(invites.createdAt));
  return rows.map(toView);
}

export async function revokeInvite(tx: Tx, communityId: string, inviteId: string) {
  const updated = await tx
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.communityId, communityId), eq(invites.id, inviteId), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  if (updated.length === 0) throw errors.notFound('Convite não encontrado.');
}

/** Opens the code's community transaction and checks the secret; the invite must not be revoked. */
async function withInvite<T>(
  db: Db,
  code: string,
  userId: string | null,
  fn: (tx: Tx, invite: typeof invites.$inferSelect, community: { id: string; name: string }) => Promise<T>,
): Promise<T> {
  const decoded = decodeInviteCode(code);
  if (!decoded) throw invalidInvite();
  return withTenantTx(db, { communityId: decoded.communityId, userId }, async (tx) => {
    const [invite] = await tx
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.communityId, decoded.communityId),
          eq(invites.secret, decoded.secret),
          isNull(invites.revokedAt),
        ),
      );
    if (!invite) throw invalidInvite();
    const [c] = await tx
      .select({ id: communities.id, name: communities.name })
      .from(communities)
      .where(eq(communities.id, decoded.communityId));
    if (!c) throw invalidInvite();
    return fn(tx, invite, c);
  });
}

/** Minimal public preview: community name and what the invite includes. Works without a session. */
export async function previewInvite(
  db: Db,
  hooks: MembershipHooks,
  code: string,
  userId: string | null,
): Promise<InvitePreview> {
  return withInvite(db, code, userId, async (tx, invite, community) => {
    let myStatus: MembershipStatus | null = null;
    if (userId) {
      const [m] = await tx
        .select({ status: memberships.status })
        .from(memberships)
        .where(and(eq(memberships.communityId, community.id), eq(memberships.userId, userId)));
      myStatus = m?.status ?? null;
    }
    const intent = invite.intent ? hooks.intents.find((i) => i.id === invite.intent) : undefined;
    return { community, intent: intent ? { id: intent.id, label: intent.label } : null, myStatus };
  });
}

/**
 * Join request (always pending, never auto-approved). Rejected or removed people may ask again; an
 * existing pending request or membership is left as is (legacy R-MEM-02).
 */
export async function joinByInvite(
  db: Db,
  code: string,
  userId: string,
): Promise<{ communityId: string; status: MembershipStatus }> {
  return withInvite(db, code, userId, async (tx, invite, community) => {
    const [m] = await tx
      .select({ status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.communityId, community.id), eq(memberships.userId, userId)));
    if (m && (m.status === 'pending' || m.status === 'approved'))
      return { communityId: community.id, status: m.status };
    const values = {
      role: 'membro' as const,
      status: 'pending' as const,
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      joinIntent: invite.intent,
    };
    await tx
      .insert(memberships)
      .values({ communityId: community.id, userId, ...values })
      .onConflictDoUpdate({ target: [memberships.communityId, memberships.userId], set: values });
    return { communityId: community.id, status: 'pending' };
  });
}
