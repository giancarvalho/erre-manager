// The anonymous vote on the device (ported from queridometro@7c5c5bf:src/lib/voting/client-token.ts and
// remembered-votes.ts). The blinding runs here, so the server never sees the token it signs; the token lives
// only on this device (secure store on native). Ballots go through the anonymous route with a plain fetch that
// carries no session: no cookie (credentials: 'omit'), no Authorization, no X-Community-Id.
import { finishToken, startToken, type RsaPublicJwk } from '@erre/anon-vote/client';
import type { ModuleHost } from '@erre/core/client';

import type { useErrometroClient } from './data';
import { ErrometroError, NETWORK_ERROR, ok } from './data';

export type VoteMap = Record<string, string>;
export type StoredToken = { preparedMsgB64: string; signatureB64: string; voterTag: string };

type Client = ReturnType<typeof useErrometroClient>;
type Storage = Pick<ModuleHost, 'storage' | 'secureStorage'>;

const tokenKey = (communityId: string, period: string) => `errometro.vtoken.${communityId}.${period}`;
const lastVotesKey = (communityId: string) => `errometro.lastvotes.${communityId}`;

export async function loadToken(host: Storage, communityId: string, period: string): Promise<StoredToken | null> {
  try {
    const raw = await host.secureStorage.getItem(tokenKey(communityId, period));
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<StoredToken>;
    return typeof t.preparedMsgB64 === 'string' && typeof t.signatureB64 === 'string' && typeof t.voterTag === 'string'
      ? { preparedMsgB64: t.preparedMsgB64, signatureB64: t.signatureB64, voterTag: t.voterTag }
      : null;
  } catch {
    return null;
  }
}

export type EnsureResult =
  { ok: true; token: StoredToken; period: string } | { ok: false; error: string; alreadyIssued?: boolean };

/**
 * This device's token for the round, running the blind-signature issuance if there is none yet. The round
 * comes from the server's answer (it may have rolled over since the screen loaded).
 */
export async function ensureToken(
  host: Storage,
  client: Client,
  communityId: string,
  period: string,
): Promise<EnsureResult> {
  const stored = await loadToken(host, communityId, period);
  if (stored) return { ok: true, token: stored, period };
  try {
    const key = (await ok(() => client.chave.$get())) as { period: string; publicKeyJwk: RsaPublicJwk };
    const request = startToken(key.publicKeyJwk);
    const issued = (await ok(() => client.token.$post({ json: { blindedMsgB64: request.blindedMsgB64 } }))) as {
      period: string;
      blindSignatureB64: string;
    };
    const token = finishToken(key.publicKeyJwk, request.preparedMsg, issued.blindSignatureB64, request.invB64);
    await host.secureStorage
      .setItem(tokenKey(communityId, issued.period), JSON.stringify(token))
      .catch(() => undefined);
    return { ok: true, token, period: issued.period };
  } catch (err) {
    if (err instanceof ErrometroError && err.code === 'TOKEN_ALREADY_ISSUED')
      return {
        ok: false,
        alreadyIssued: true,
        error:
          'Você já votou nesta rodada em outro aparelho. Cada pessoa vota uma vez por rodada — tente de novo na próxima.',
      };
    return { ok: false, error: err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.' };
  }
}

/** The anonymous request: no session, ever. */
async function anonPost<T>(host: Pick<ModuleHost, 'apiUrl'>, communityId: string, path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${host.apiUrl}/v1/errometro/anon/c/${encodeURIComponent(communityId)}${path}`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ErrometroError(0, 'NETWORK_ERROR', NETWORK_ERROR);
  }
  const data = (await res.json().catch(() => null)) as (T & { code?: string; message?: string }) | null;
  if (!res.ok || !data)
    throw new ErrometroError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? 'Algo deu errado. Tente de novo.');
  return data;
}

export function submitBallot(
  host: Pick<ModuleHost, 'apiUrl'>,
  communityId: string,
  token: StoredToken,
  votes: VoteMap,
) {
  return anonPost<{ status: 'inserted' | 'updated' }>(host, communityId, '/votos', {
    preparedMsgB64: token.preparedMsgB64,
    signatureB64: token.signatureB64,
    votes,
  });
}

/** My votes in the current round, by the tag only this device knows. */
export async function fetchMyVotes(host: Pick<ModuleHost, 'apiUrl'>, communityId: string, token: StoredToken) {
  const data = await anonPost<{ votes: VoteMap }>(host, communityId, '/meus-votos', { voterTag: token.voterTag });
  return data.votes;
}

/** Last submitted votes, to prefill the next round. Device-only; never sent to the server. */
export async function loadRememberedVotes(host: Storage, communityId: string): Promise<VoteMap> {
  try {
    const raw = await host.storage.getItem(lastVotesKey(communityId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
  } catch {
    return {};
  }
}

export function rememberVotes(host: Storage, communityId: string, votes: VoteMap): Promise<void> {
  return host.storage.setItem(lastVotesKey(communityId), JSON.stringify(votes)).catch(() => undefined);
}
