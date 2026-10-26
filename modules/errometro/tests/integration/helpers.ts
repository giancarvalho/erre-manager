// Shared setup of the Errômetro integration tests: one harness over the test database, request helpers and
// the client side of the blind-signature flow.
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

export type Token = { preparedMsgB64: string; signatureB64: string; voterTag: string };

export function helpers(h: ModuleHarness, adminUrl: string) {
  const call = (user: TestUser | null, method: string, path: string, community: string, body?: unknown) =>
    h.req(user, method, `/v1/errometro${path}`, { community, ...(body !== undefined ? { body } : {}) });

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

  /** Asks to participate and has the owner approve it. */
  async function makeVoter(fx: RoleFixture, user: TestUser) {
    await json(call(user, 'POST', '/participacao', fx.communityId));
    await json(call(fx.users.owner, 'POST', `/participantes/${user.id}/aprovar`, fx.communityId));
  }

  /** A new approved member of the fixture's community, approved as a voter. */
  async function newVoter(fx: RoleFixture, name = 'Votante') {
    const u = await createTestUser(h.app, h.google, { origin: HARNESS_ORIGIN, name });
    await addMember(h.db, fx.communityId, u.id, 'membro');
    await makeVoter(fx, u);
    return u;
  }

  /** The whole client flow: public key, blind, issuance, unblind. */
  async function getToken(fx: RoleFixture | string, user: TestUser): Promise<Token & { period: string }> {
    const communityId = typeof fx === 'string' ? fx : fx.communityId;
    const key = await json<{ period: string; publicKeyJwk: RsaPublicJwk }>(call(user, 'GET', '/chave', communityId));
    const req = startToken(key.publicKeyJwk);
    const issued = await json<{ period: string; blindSignatureB64: string }>(
      call(user, 'POST', '/token', communityId, { blindedMsgB64: req.blindedMsgB64 }),
    );
    expect(issued.period).toBe(key.period);
    return {
      period: key.period,
      ...finishToken(key.publicKeyJwk, req.preparedMsg, issued.blindSignatureB64, req.invB64),
    };
  }

  /** Anonymous ballot, with no cookie unless `headers` adds one. */
  const vote = (communityId: string, token: Token, votes: Record<string, string>, headers?: Record<string, string>) =>
    h.req(null, 'POST', `/v1/errometro/anon/c/${communityId}/votos`, {
      body: { preparedMsgB64: token.preparedMsgB64, signatureB64: token.signatureB64, votes },
      ...(headers ? { headers } : {}),
    });

  const myVotes = (communityId: string, voterTag: string) =>
    json<{ period: string; votes: Record<string, string> }>(
      h.req(null, 'POST', `/v1/errometro/anon/c/${communityId}/meus-votos`, { body: { voterTag } }),
    );

  return { call, json, admin, makeVoter, newVoter, getToken, vote, myVotes };
}
