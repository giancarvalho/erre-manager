import type { AvatarVariant, Me } from '@erre/core/client';
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

/** Name and/or avatar color (CORE-15). Members lists of every community are refetched with the new look. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { displayName?: string; avatarVariant?: AvatarVariant }) =>
      api<Me>('/v1/me/profile', { method: 'PATCH', body: patch }),
    onSuccess: (me) => {
      qc.setQueryData(meKey, me);
      void qc.invalidateQueries({ queryKey: ['community'] });
    },
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
