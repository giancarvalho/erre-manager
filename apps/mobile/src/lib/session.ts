import type { Me } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from './api';
import { signOut } from './auth';

export const meKey = ['me'] as const;

/** The signed-in person, or null without a session. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api<Me>('/v1/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useUpdateDisplayName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => api<Me>('/v1/me/profile', { method: 'PATCH', body: { displayName } }),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSettled: () => {
      qc.setQueryData(meKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
    },
  });
}
