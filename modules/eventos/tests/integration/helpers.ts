// Shared setup of the Eventos integration tests: request helpers, event builders and the client side of the
// blind-signature flow.
import { finishToken, startToken, type RsaPublicJwk } from '@erre/anon-vote/client';
import {
  addMember,
  createTestUser,
  HARNESS_ORIGIN,
  type ModuleHarness,
  type RoleFixture,
  type TestUser,
} from '@erre/core/testing';
import pg from 'pg';
import { expect } from 'vitest';

import type { EventEmojiEntryInput } from '../../domain/emoji-config';

export type Token = { preparedMsgB64: string; signatureB64: string; voterTag: string };
export type EventView = { id: string; status: string; votingType: string; title: string; closedAt: string | null };
export type VoteRow = { targetId: string; emojiId: string; value?: number | null };

export const CATEGORICAL: EventEmojiEntryInput[] = [
  { isCustom: false, emojiId: 'coracao' },
  { isCustom: false, emojiId: 'cobra' },
];
export const SCALE: EventEmojiEntryInput[] = [
  { isCustom: false, emojiId: 'coracao', scaleMax: 10 },
  { isCustom: false, emojiId: 'cobra', scaleMax: 1 },
];

export function helpers(h: ModuleHarness, adminUrl: string) {
  const call = (user: TestUser | null, method: string, path: string, community: string, body?: unknown) =>
    h.req(user, method, `/v1/eventos${path}`, { community, ...(body !== undefined ? { body } : {}) });

  async function json<T>(res: Response | Promise<Response>, status = 200): Promise<T> {
    const r = await res;
    const text = await r.text();
    expect(r.status, text).toBe(status);
    return JSON.parse(text) as T;
  }

  async function admin<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const client = new pg.Client({ connectionString: adminUrl });
    await client.connect();
    try {
      return (await client.query<T>(text, params)).rows;
    } finally {
      await client.end();
    }
  }

  async function newMember(fx: RoleFixture, name: string) {
    const u = await createTestUser(h.app, h.google, { origin: HARNESS_ORIGIN, name });
    await addMember(h.db, fx.communityId, u.id, 'membro');
    return u;
  }

  /** A draft with its roster, created by the owner. */
  async function draft(
    fx: RoleFixture,
    opts: { votingType?: 'categorical' | 'scale'; roster?: EventEmojiEntryInput[]; title?: string } = {},
  ) {
    const votingType = opts.votingType ?? 'categorical';
    const event = await json<EventView>(
      call(fx.users.owner, 'POST', '', fx.communityId, {
        title: opts.title ?? 'Festa',
        votingType,
        releaseMode: 'manual',
      }),
      201,
    );
    await json(
      call(fx.users.owner, 'PUT', `/${event.id}/emojis`, fx.communityId, {
        entries: opts.roster ?? (votingType === 'scale' ? SCALE : CATEGORICAL),
      }),
    );
    return event;
  }

  /** Draft → published → signed up `people` → open. */
  async function openEvent(fx: RoleFixture, people: TestUser[], opts: Parameters<typeof draft>[1] = {}) {
    const event = await draft(fx, opts);
    await json(call(fx.users.owner, 'POST', `/${event.id}/publicar`, fx.communityId));
    for (const p of people) await json(call(p, 'POST', `/${event.id}/inscricao`, fx.communityId));
    await json(call(fx.users.owner, 'POST', `/${event.id}/abrir`, fx.communityId));
    return event;
  }

  /** The whole client flow: public key, blind, issuance, unblind. */
  async function getToken(communityId: string, eventId: string, user: TestUser): Promise<Token> {
    const key = await json<{ publicKeyJwk: RsaPublicJwk }>(call(user, 'GET', `/${eventId}/chave`, communityId));
    const req = startToken(key.publicKeyJwk);
    const issued = await json<{ blindSignatureB64: string }>(
      call(user, 'POST', `/${eventId}/token`, communityId, { blindedMsgB64: req.blindedMsgB64 }),
    );
    return finishToken(key.publicKeyJwk, req.preparedMsg, issued.blindSignatureB64, req.invB64);
  }

  /** Anonymous ballot, with no cookie unless `headers` adds one. */
  const vote = (
    communityId: string,
    eventId: string,
    token: Token,
    votes: VoteRow[],
    headers?: Record<string, string>,
  ) =>
    h.req(null, 'POST', `/v1/eventos/anon/c/${communityId}/${eventId}/votos`, {
      body: { preparedMsgB64: token.preparedMsgB64, signatureB64: token.signatureB64, votes },
      ...(headers ? { headers } : {}),
    });

  const myVotes = (communityId: string, eventId: string, voterTag: string) =>
    json<{ votes: { targetId: string; emojiId: string; value: number | null }[] }>(
      h.req(null, 'POST', `/v1/eventos/anon/c/${communityId}/${eventId}/meus-votos`, { body: { voterTag } }),
    );

  return { call, json, admin, newMember, draft, openEvent, getToken, vote, myVotes };
}
