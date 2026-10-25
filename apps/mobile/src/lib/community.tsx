import type { CommunityDetails, MyCommunity } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { api } from './api';
import { readPref, writePref } from './storage';

const STORAGE_KEY = 'erre:community';
export const myCommunitiesKey = ['me', 'communities'] as const;

export function useMyCommunities() {
  return useQuery({ queryKey: myCommunitiesKey, queryFn: () => api<MyCommunity[]>('/v1/me/communities') });
}

type CommunityContextValue = {
  communities: MyCommunity[];
  /** Chosen community: the stored choice if still valid, else the first. Null without communities. */
  current: MyCommunity | null;
  select: (id: string) => void;
};

const Ctx = createContext<CommunityContextValue | null>(null);

/** Which community the app is looking at (D-014: chosen in the app, never stored in the session). */
export function CommunityProvider({ communities, children }: { communities: MyCommunity[]; children: ReactNode }) {
  const [chosen, setChosen] = useState<string | null>(() => readPref(STORAGE_KEY));
  const current = communities.find((c) => c.id === chosen) ?? communities[0] ?? null;
  const select = useCallback((id: string) => {
    setChosen(id);
    writePref(STORAGE_KEY, id);
  }, []);
  const value = useMemo(() => ({ communities, current, select }), [communities, current, select]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommunity(): CommunityContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommunity must be used inside CommunityProvider');
  return ctx;
}

export function useCommunityDetails(id: string | undefined) {
  return useQuery({
    queryKey: ['community', id],
    queryFn: () => api<CommunityDetails>(`/v1/communities/${id}`, { communityId: id! }),
    enabled: !!id,
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<MyCommunity>('/v1/communities', { method: 'POST', body: { name } }),
    onSuccess: async (created) => {
      writePref(STORAGE_KEY, created.id);
      qc.setQueryData<MyCommunity[]>(myCommunitiesKey, (prev) =>
        [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      await qc.invalidateQueries({ queryKey: myCommunitiesKey });
    },
  });
}

export const ROLE_LABEL: Record<MyCommunity['role'], string> = {
  owner: 'dono',
  admin: 'admin',
  moderador: 'moderador',
  membro: 'membro',
};
