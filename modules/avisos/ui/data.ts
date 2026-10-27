// Data of the Mural de avisos UI: the typed client of the module's API (D-009) with React Query. callModule returns the
// JSON or throws ModuleApiError with a pt-BR message ready to show.
import { callModule, useModuleClient, useModuleHost } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import type { AvisosApi } from '../api';
import type { NewAviso } from '../domain/schemas';

export function useAvisosClient() {
  return useModuleClient<AvisosApi>('avisos');
}

type Client = ReturnType<typeof useAvisosClient>;
export type AvisoList = InferResponseType<Client['index']['$get'], 200>;
export type Aviso = AvisoList['avisos'][number];

/** Query keys always include the community: switching community never shows another one's data. */
const keys = { avisos: (communityId: string) => ['avisos', communityId, 'list'] as const };

export function useAvisos() {
  const client = useAvisosClient();
  const { community } = useModuleHost();
  return useQuery({
    queryKey: keys.avisos(community.id),
    queryFn: () => callModule(() => client.index.$get()) as Promise<AvisoList>,
  });
}

export function usePublishAviso() {
  const client = useAvisosClient();
  const { community } = useModuleHost();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewAviso) => callModule(() => client.index.$post({ json: input })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.avisos(community.id) }),
  });
}

export function useDeleteAviso() {
  const client = useAvisosClient();
  const { community } = useModuleHost();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callModule(() => client[':id'].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.avisos(community.id) }),
  });
}
