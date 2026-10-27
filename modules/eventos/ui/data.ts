// Data hooks of the Eventos UI over the typed client (D-009). Errors become pt-BR messages.
import { callModule, useModuleClient, useModuleHost } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

import type { EventosApi } from '../api';

// Shared with every module since Sprint 20 (@erre/core/client); the old names stay for this module's code.
export { ModuleApiError as EventosError, NETWORK_ERROR } from '@erre/core/client';
export const ok = callModule;

export function useEventosClient() {
  return useModuleClient<EventosApi>('eventos');
}

type Client = ReturnType<typeof useEventosClient>;
export type EventList = InferResponseType<Client['index']['$get'], 200>;
export type EventSummary = EventList['events'][number];
export type EventDetail = InferResponseType<Client[':id']['$get'], 200>;
export type EventView = EventDetail['event'];
export type EventEmoji = EventDetail['emojis'][number];
export type EventResults = InferResponseType<Client[':id']['resultados']['$get'], 200>;
export type NewEventInput = InferRequestType<Client['index']['$post']>['json'];
export type DraftPatchInput = InferRequestType<Client[':id']['$patch']>['json'];
export type RosterEntries = InferRequestType<Client[':id']['emojis']['$put']>['json']['entries'];

export const keys = {
  all: (c: string) => ['eventos', c] as const,
  list: (c: string) => ['eventos', c, 'lista'] as const,
  event: (c: string, id: string) => ['eventos', c, 'evento', id] as const,
  results: (c: string, id: string) => ['eventos', c, 'resultados', id] as const,
};

function useInvalidateAll() {
  const { community } = useModuleHost();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.all(community.id) });
}

export function useEvents() {
  const client = useEventosClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.list(community.id),
    queryFn: () => ok(() => client.index.$get()) as Promise<EventList>,
  });
}

export function useEvent(id: string) {
  const client = useEventosClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.event(community.id, id),
    queryFn: () => ok(() => client[':id'].$get({ param: { id } })) as Promise<EventDetail>,
  });
}

export function useEventResults(id: string) {
  const client = useEventosClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.results(community.id, id),
    queryFn: () => ok(() => client[':id'].resultados.$get({ param: { id } })) as Promise<EventResults>,
  });
}

/** Creates the draft, saves its roster and its banner color: the wizard's last step (DESIGN §10.4). */
export function useCreateEvent() {
  const client = useEventosClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { event: NewEventInput; entries: RosterEntries; bannerRgb: string | null }) => {
      const created = (await ok(() => client.index.$post({ json: v.event }))) as EventView;
      await ok(() => client[':id'].emojis.$put({ param: { id: created.id }, json: { entries: v.entries } }));
      if (v.bannerRgb)
        await ok(() => client[':id'].$patch({ param: { id: created.id }, json: { bannerRgb: v.bannerRgb } }));
      return created;
    },
    onSettled: invalidate,
  });
}

/** Saves a draft edited in the wizard: fields, then the roster. */
export function useSaveDraft(id: string) {
  const client = useEventosClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { patch: DraftPatchInput; entries: RosterEntries }) => {
      await ok(() => client[':id'].$patch({ param: { id }, json: v.patch }));
      await ok(() => client[':id'].emojis.$put({ param: { id }, json: { entries: v.entries } }));
    },
    onSettled: invalidate,
  });
}

export type LifecycleAction = 'publicar' | 'abrir' | 'encerrar';

export function useEventActions(id: string) {
  const client = useEventosClient();
  const invalidate = useInvalidateAll();
  const param = { param: { id } };
  return {
    transition: useMutation({
      mutationFn: (action: LifecycleAction) =>
        ok(() =>
          action === 'publicar'
            ? client[':id'].publicar.$post(param)
            : action === 'abrir'
              ? client[':id'].abrir.$post(param)
              : client[':id'].encerrar.$post(param),
        ),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: () => ok(() => client[':id'].$delete(param)),
      onSuccess: invalidate,
    }),
    signUp: useMutation({
      mutationFn: () => ok(() => client[':id'].inscricao.$post(param)),
      onSuccess: invalidate,
    }),
  };
}
