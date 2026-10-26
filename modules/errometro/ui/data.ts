// Data hooks of the Errômetro UI over the typed client (D-009). Errors become pt-BR messages.
import { useModuleClient, useModuleHost } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import type { ErrometroApi } from '../api';

export const NETWORK_ERROR = 'Sem conexão com o servidor. Confira sua internet.';

export class ErrometroError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ErrometroError';
  }
}

/** Throws ErrometroError with the API's { code, message } (or a network message) when the call fails. */
export async function ok<T>(call: () => Promise<{ ok: boolean; status: number; json: () => Promise<T> }>): Promise<T> {
  let res;
  try {
    res = await call();
  } catch {
    throw new ErrometroError(0, 'NETWORK_ERROR', NETWORK_ERROR);
  }
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  throw new ErrometroError(res.status, body?.code ?? 'UNKNOWN', body?.message ?? 'Algo deu errado. Tente de novo.');
}

export function useErrometroClient() {
  return useModuleClient<ErrometroApi>('errometro');
}

type Client = ReturnType<typeof useErrometroClient>;
export type Round = InferResponseType<Client['rodada']['$get'], 200>;
export type Participation = Round['participation'];
export type EmojiOption = Round['emojis'][number];
export type Target = Round['targets'][number];

export const roundKey = (communityId: string) => ['errometro', communityId, 'rodada'] as const;

/** The current round: window, cadence, emojis, targets and my participation. */
export function useRound() {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: roundKey(community.id),
    queryFn: () => ok(() => client.rodada.$get()) as Promise<Round>,
  });
}

/** "Quero participar do Errômetro". */
export function useRequestParticipation() {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ok(() => client.participacao.$post()),
    onSuccess: () => qc.invalidateQueries({ queryKey: roundKey(community.id) }),
  });
}
