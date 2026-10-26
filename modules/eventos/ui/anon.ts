// The anonymous vote on the device, per event (ported from queridometro@7c5c5bf:src/lib/events/client-token.ts).
// The blinding runs here, so the server never sees the token it signs; the token lives only on this device
// (secure store on native). Ballots go through the anonymous route with a plain fetch that carries no session:
// no cookie (credentials: 'omit'), no Authorization, no X-Community-Id.
import { finishToken, startToken, type RsaPublicJwk } from '@erre/anon-vote/client';
import type { ModuleHost } from '@erre/core/client';

import type { EventVoteSubmission } from '../domain/ballot';
import { EventosError, NETWORK_ERROR, ok, type useEventosClient } from './data';

export type StoredToken = { preparedMsgB64: string; signatureB64: string; voterTag: string };
export type StoredVote = { targetId: string; emojiId: string; value: number | null };

type Client = ReturnType<typeof useEventosClient>;
type Storage = Pick<ModuleHost, 'storage' | 'secureStorage'>;

const tokenKey = (communityId: string, eventId: string) => `eventos.vtoken.${communityId}.${eventId}`;

export async function loadToken(host: Storage, communityId: string, eventId: string): Promise<StoredToken | null> {
  try {
    const raw = await host.secureStorage.getItem(tokenKey(communityId, eventId));
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<StoredToken>;
    return typeof t.preparedMsgB64 === 'string' && typeof t.signatureB64 === 'string' && typeof t.voterTag === 'string'
      ? { preparedMsgB64: t.preparedMsgB64, signatureB64: t.signatureB64, voterTag: t.voterTag }
      : null;
  } catch {
    return null;
  }
}

export type EnsureResult = { ok: true; token: StoredToken } | { ok: false; error: string; alreadyIssued?: boolean };

/** This device's token for the event, running the blind-signature issuance if there is none yet. */
export async function ensureToken(
  host: Storage,
  client: Client,
  communityId: string,
  eventId: string,
): Promise<EnsureResult> {
  const stored = await loadToken(host, communityId, eventId);
  if (stored) return { ok: true, token: stored };
  try {
    const param = { param: { id: eventId } };
    const key = (await ok(() => client[':id'].chave.$get(param))) as { publicKeyJwk: RsaPublicJwk };
    const request = startToken(key.publicKeyJwk);
    const issued = (await ok(() =>
      client[':id'].token.$post({ ...param, json: { blindedMsgB64: request.blindedMsgB64 } }),
    )) as { blindSignatureB64: string };
    const token = finishToken(key.publicKeyJwk, request.preparedMsg, issued.blindSignatureB64, request.invB64);
    await host.secureStorage.setItem(tokenKey(communityId, eventId), JSON.stringify(token)).catch(() => undefined);
    return { ok: true, token };
  } catch (err) {
    if (err instanceof EventosError && err.code === 'TOKEN_ALREADY_ISSUED')
      return {
        ok: false,
        alreadyIssued: true,
        error: 'Você já votou neste evento em outro aparelho. Cada pessoa vota uma vez por evento.',
      };
    return { ok: false, error: err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.' };
  }
}

/** The anonymous request: no session, ever. */
async function anonPost<T>(
  host: Pick<ModuleHost, 'apiUrl'>,
  communityId: string,
  eventId: string,
  path: string,
  body: unknown,
) {
  let res: Response;
  try {
    res = await fetch(
      `${host.apiUrl}/v1/eventos/anon/c/${encodeURIComponent(communityId)}/${encodeURIComponent(eventId)}${path}`,
      {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new EventosError(0, 'NETWORK_ERROR', NETWORK_ERROR);
  }
  const data = (await res.json().catch(() => null)) as (T & { code?: string; message?: string }) | null;
  if (!res.ok || !data)
    throw new EventosError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? 'Algo deu errado. Tente de novo.');
  return data;
}

export function submitBallot(
  host: Pick<ModuleHost, 'apiUrl'>,
  communityId: string,
  eventId: string,
  token: StoredToken,
  votes: EventVoteSubmission[],
) {
  return anonPost<{ status: 'inserted' | 'updated' }>(host, communityId, eventId, '/votos', {
    preparedMsgB64: token.preparedMsgB64,
    signatureB64: token.signatureB64,
    votes,
  });
}

/** My votes in the event, by the tag only this device knows. */
export async function fetchMyVotes(
  host: Pick<ModuleHost, 'apiUrl'>,
  communityId: string,
  eventId: string,
  token: StoredToken,
): Promise<StoredVote[]> {
  const data = await anonPost<{ votes: StoredVote[] }>(host, communityId, eventId, '/meus-votos', {
    voterTag: token.voterTag,
  });
  return data.votes;
}
