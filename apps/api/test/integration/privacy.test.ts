// LGPD (Sprint 19): a person's export and erasure across the core, the Errômetro and Eventos.
import { finishToken, startToken, type RsaPublicJwk } from '@erre/anon-vote/client';
import { addMember, createModuleHarness, createTestUser, HARNESS_ORIGIN, type TestUser } from '@erre/core/testing';
import errometro from '@erre/errometro/api';
import eventos from '@erre/eventos/api';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const ADMIN = 'a'.repeat(40);
const h = createModuleHarness({ urls: inject('db'), modules: [errometro, eventos], adminSecret: ADMIN });

async function admin<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: inject('db').admin });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

async function json<T>(res: Promise<Response> | Response, status = 200): Promise<T> {
  const r = await res;
  const text = await r.text();
  expect(r.status, text).toBe(status);
  return JSON.parse(text) as T;
}

const call = (user: TestUser | null, method: string, path: string, community?: string, body?: unknown) =>
  h.req(user, method, path, { ...(community ? { community } : {}), ...(body !== undefined ? { body } : {}) });

const erase = (userId: string, secret?: string) =>
  h.app.request(`/v1/internal/users/${userId}/delete`, {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

let communityId: string;
let owner: TestUser;
let ana: TestUser;
let others: TestUser[];

beforeAll(async () => {
  const fx = await h.fixture();
  communityId = fx.communityId;
  owner = fx.users.owner;
  ana = await createTestUser(h.app, h.google, { origin: HARNESS_ORIGIN, name: 'Ana' });
  await addMember(h.db, communityId, ana.id, 'membro');
  others = [fx.users.admin, fx.users.moderador, fx.users.membro];

  // Errômetro: Ana votes in it (approved) and writes a comment about someone.
  await json(call(ana, 'POST', '/v1/errometro/participacao', communityId));
  await json(call(owner, 'POST', `/v1/errometro/participantes/${ana.id}/aprovar`, communityId));
  await json(
    call(ana, 'POST', '/v1/errometro/comentarios', communityId, {
      targetId: others[0]!.id,
      period: '2026-10-26',
      text: 'Comentário da Ana',
    }),
    201,
  );

  // Eventos: an event Ana wins (three votes for her) and closes.
  const ev = await json<{ id: string }>(
    call(owner, 'POST', '/v1/eventos', communityId, {
      title: 'Festa',
      votingType: 'categorical',
      releaseMode: 'manual',
    }),
    201,
  );
  await json(
    call(owner, 'PUT', `/v1/eventos/${ev.id}/emojis`, communityId, {
      entries: [{ isCustom: false, emojiId: 'coracao' }],
    }),
  );
  await json(call(owner, 'POST', `/v1/eventos/${ev.id}/publicar`, communityId));
  for (const u of [ana, ...others]) await json(call(u, 'POST', `/v1/eventos/${ev.id}/inscricao`, communityId));
  await json(call(owner, 'POST', `/v1/eventos/${ev.id}/abrir`, communityId));
  for (const voter of others) {
    const key = await json<{ publicKeyJwk: RsaPublicJwk }>(
      call(voter, 'GET', `/v1/eventos/${ev.id}/chave`, communityId),
    );
    const req = startToken(key.publicKeyJwk);
    const issued = await json<{ blindSignatureB64: string }>(
      call(voter, 'POST', `/v1/eventos/${ev.id}/token`, communityId, { blindedMsgB64: req.blindedMsgB64 }),
    );
    const token = finishToken(key.publicKeyJwk, req.preparedMsg, issued.blindSignatureB64, req.invB64);
    await json(
      h.req(null, 'POST', `/v1/eventos/anon/c/${communityId}/${ev.id}/votos`, {
        body: {
          preparedMsgB64: token.preparedMsgB64,
          signatureB64: token.signatureB64,
          votes: [{ targetId: ana.id, emojiId: 'coracao' }],
        },
      }),
    );
  }
  await json(call(owner, 'POST', `/v1/eventos/${ev.id}/encerrar`, communityId));
});
afterAll(() => h.close());

describe('export (GET /v1/me/export)', () => {
  it('has the account, each community with every module’s part, and never a vote', async () => {
    const res = await call(ana, 'GET', '/v1/me/export');
    expect(res.headers.get('content-disposition')).toContain('meus-dados.json');
    const data = await json<{
      account: { email: string; displayName: string };
      communities: { status: string; modules: Record<string, Record<string, unknown>> }[];
      votes: string;
    }>(res);
    expect(data.account).toMatchObject({ email: ana.email, displayName: 'Ana' });
    expect(data.communities).toHaveLength(1);
    const mods = data.communities[0]!.modules;
    expect(mods.errometro).toMatchObject({
      participation: { status: 'approved' },
      comments: [expect.objectContaining({ text: 'Comentário da Ana' })],
    });
    expect(mods.eventos).toMatchObject({
      participations: [expect.objectContaining({ event: 'Festa' })],
      trophies: { categorical: [expect.objectContaining({ emojiId: 'coracao', winCount: 1 })] },
    });
    expect(data.votes).toMatch(/anônimos/);
    // Nothing that could link a ballot: no voter tags anywhere.
    expect(JSON.stringify(data)).not.toMatch(/[0-9a-f]{64}/);
  });

  it('needs a session', async () => {
    expect((await call(null, 'GET', '/v1/me/export')).status).toBe(401);
  });
});

describe('erasure (POST /v1/internal/users/:id/delete)', () => {
  it('needs the operator secret', async () => {
    expect((await erase(ana.id)).status).toBe(401);
    expect((await erase(ana.id, 'b'.repeat(40))).status).toBe(401);
  });

  it('is refused while the person is the only owner of a community with other members', async () => {
    const res = await json<{ code: string; message: string }>(erase(owner.id, ADMIN), 409);
    expect(res.code).toBe('SOLE_OWNER');
  });

  it('erases the person in the core and in every module; anonymous votes and frozen results stay', async () => {
    const votesBefore = await admin<{ n: string }>('SELECT count(*) AS n FROM eventos_votes WHERE community_id = $1', [
      communityId,
    ]);
    expect(await json(erase(ana.id, ADMIN))).toEqual({ deleted: true, communities: 1 });

    expect((await call(ana, 'GET', '/v1/me')).status).toBe(401);
    for (const [table, column] of [
      ['auth_user', 'id'],
      ['core_profiles', 'user_id'],
      ['core_community_memberships', 'user_id'],
      ['errometro_participants', 'user_id'],
      ['errometro_comments', 'author_id'],
      ['eventos_participants', 'user_id'],
      ['eventos_token_issuances', 'user_id'],
      ['eventos_trophy_wins', 'winner_user_id'],
    ] as const) {
      const rows = await admin(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [ana.id]);
      expect(rows, table).toEqual([]);
    }
    const votesAfter = await admin<{ n: string }>('SELECT count(*) AS n FROM eventos_votes WHERE community_id = $1', [
      communityId,
    ]);
    expect(votesAfter).toEqual(votesBefore);
    expect(await admin('SELECT 1 FROM eventos_snapshots WHERE community_id = $1', [communityId])).toHaveLength(1);
    expect((await erase(ana.id, ADMIN)).status).toBe(404);
  });
});
