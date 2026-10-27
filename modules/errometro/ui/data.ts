// Data hooks of the Errômetro UI over the typed client (D-009). Errors become pt-BR messages.
import { callModule, useModuleClient, useModuleHost } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import type { ErrometroApi } from '../api';

// Shared with every module since Sprint 20 (@erre/core/client); the old names stay for this module's code.
export { ModuleApiError as ErrometroError, NETWORK_ERROR } from '@erre/core/client';
export const ok = callModule;

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

export type Results = InferResponseType<Client['resultados']['$get'], 200>;
export type Comment = InferResponseType<Client['comentarios']['$post'], 201>;
export type ParticipantRow = InferResponseType<Client['participantes']['$get'], 200>[number];
export type RoundsList = InferResponseType<Client['rodadas']['$get'], 200>;
export type EmojiConfig = InferResponseType<Client['config']['emojis']['$get'], 200>;
export type CadenceView = InferResponseType<Client['config']['cadencia']['$get'], 200>;

const keys = {
  all: (c: string) => ['errometro', c] as const,
  results: (c: string, period: string | undefined) => ['errometro', c, 'resultados', period ?? 'ultima'] as const,
  comments: (c: string, target: string, period: string) => ['errometro', c, 'comentarios', target, period] as const,
  participants: (c: string) => ['errometro', c, 'participantes'] as const,
  rounds: (c: string) => ['errometro', c, 'rodadas'] as const,
  emojis: (c: string) => ['errometro', c, 'emojis'] as const,
  cadence: (c: string) => ['errometro', c, 'cadencia'] as const,
};

/** Everything of the Errômetro in this community is refetched after a moderation change. */
function useInvalidateAll() {
  const { community } = useModuleHost();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.all(community.id) });
}

export function useResults(period: string | undefined) {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.results(community.id, period),
    queryFn: () => ok(() => client.resultados.$get({ query: period ? { rodada: period } : {} })) as Promise<Results>,
  });
}

export function useComments(targetId: string, period: string, enabled: boolean) {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.comments(community.id, targetId, period),
    queryFn: () =>
      ok(() => client.comentarios.$get({ query: { alvo: targetId, rodada: period } })) as Promise<Comment[]>,
    enabled,
  });
}

export function useCommentActions(targetId: string, period: string) {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.comments(community.id, targetId, period) }),
      qc.invalidateQueries({ queryKey: ['errometro', community.id, 'resultados'] }),
    ]);
  return {
    add: useMutation({
      mutationFn: (text: string) => ok(() => client.comentarios.$post({ json: { targetId, period, text } })),
      onSuccess: refresh,
    }),
    edit: useMutation({
      mutationFn: (v: { id: string; text: string }) =>
        ok(() => client.comentarios[':id'].$patch({ param: { id: v.id }, json: { text: v.text } })),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => ok(() => client.comentarios[':id'].$delete({ param: { id } })),
      onSuccess: refresh,
    }),
  };
}

export function useParticipants() {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.participants(community.id),
    queryFn: () => ok(() => client.participantes.$get()) as Promise<ParticipantRow[]>,
  });
}

export function useModerateParticipant() {
  const client = useErrometroClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { userId: string; acao: 'aprovar' | 'rejeitar' | 'remover' }) =>
      ok(() => client.participantes[':userId'][':acao'].$post({ param: v })),
    onSuccess: invalidate,
  });
}

export function useRounds() {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.rounds(community.id),
    queryFn: () => ok(() => client.rodadas.$get()) as Promise<RoundsList>,
  });
}

export function useRoundActions() {
  const client = useErrometroClient();
  const invalidate = useInvalidateAll();
  return {
    releaseNow: useMutation({
      mutationFn: () => ok(() => client.rodada.liberar.$post()),
      onSuccess: invalidate,
    }),
    recompute: useMutation({
      mutationFn: (period: string) => ok(() => client.rodadas[':period'].recalcular.$post({ param: { period } })),
      onSuccess: invalidate,
    }),
    hide: useMutation({
      mutationFn: (v: { period: string; hidden: boolean }) =>
        ok(() => client.rodadas[':period'].ocultar.$post({ param: { period: v.period }, json: { hidden: v.hidden } })),
      onSuccess: invalidate,
    }),
    annul: useMutation({
      mutationFn: (voterTag: string) => ok(() => client.votos.anular.$post({ json: { voterTag } })),
      onSuccess: invalidate,
    }),
  };
}

export function useEmojiConfig() {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.emojis(community.id),
    queryFn: () => ok(() => client.config.emojis.$get()) as Promise<EmojiConfig>,
  });
}

export function useSaveEmojis() {
  const client = useErrometroClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (entries: Parameters<Client['config']['emojis']['$put']>[0]['json']['entries']) =>
      ok(() => client.config.emojis.$put({ json: { entries } })),
    onSuccess: invalidate,
  });
}

export function useCadence() {
  const client = useErrometroClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.cadence(community.id),
    queryFn: () => ok(() => client.config.cadencia.$get()) as Promise<CadenceView>,
  });
}

export function useSaveCadence() {
  const client = useErrometroClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (config: Parameters<Client['config']['cadencia']['$put']>[0]['json']['config']) =>
      ok(() => client.config.cadencia.$put({ json: { config } })),
    onSuccess: invalidate,
  });
}
