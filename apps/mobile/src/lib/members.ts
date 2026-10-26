import type { InvitePreview, InviteView, JoinRequest, Member, MembershipStatus, MyRequest } from '@erre/core/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import { myCommunitiesKey } from './community';
import { WEB_URL } from './config';
import { writePref } from './storage';

const keys = {
  members: (c: string) => ['community', c, 'members'] as const,
  requests: (c: string) => ['community', c, 'requests'] as const,
  invites: (c: string) => ['community', c, 'invites'] as const,
  myRequests: ['me', 'requests'] as const,
  invite: (code: string) => ['invite', code] as const,
};

export const inviteLink = (code: string) => `${WEB_URL}/convite/${code}`;

export function useMembers(communityId: string) {
  return useQuery({
    queryKey: keys.members(communityId),
    queryFn: () => api<Member[]>(`/v1/communities/${communityId}/members`, { communityId }),
  });
}

export function useRequests(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.requests(communityId),
    queryFn: () => api<JoinRequest[]>(`/v1/communities/${communityId}/requests`, { communityId }),
    enabled,
  });
}

export function useModerate(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, userId }: { action: 'approve' | 'reject' | 'remove'; userId: string }) =>
      api(
        action === 'remove'
          ? `/v1/communities/${communityId}/members/${userId}/remove`
          : `/v1/communities/${communityId}/requests/${userId}/${action}`,
        { method: 'POST', communityId },
      ),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: keys.requests(communityId) });
      await qc.invalidateQueries({ queryKey: keys.members(communityId) });
    },
  });
}

export function useLeave(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/v1/communities/${communityId}/leave`, { method: 'POST', communityId }),
    onSuccess: async () => {
      writePref('erre:community', null);
      await qc.invalidateQueries({ queryKey: myCommunitiesKey });
    },
  });
}

export function useInvites(communityId: string) {
  return useQuery({
    queryKey: keys.invites(communityId),
    queryFn: () => api<InviteView[]>(`/v1/communities/${communityId}/invites`, { communityId }),
  });
}

export function useCreateInvite(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    /** `intent`: a module join intent (D-023), e.g. "errometro.participar"; null = only the community. */
    mutationFn: (intent: string | null = null) =>
      api<InviteView>(`/v1/communities/${communityId}/invites`, { method: 'POST', body: { intent }, communityId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites(communityId) }),
  });
}

export function useRevokeInvite(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api(`/v1/communities/${communityId}/invites/${inviteId}/revoke`, { method: 'POST', communityId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites(communityId) }),
  });
}

export function useMyRequests() {
  return useQuery({ queryKey: keys.myRequests, queryFn: () => api<MyRequest[]>('/v1/me/requests') });
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: keys.invite(code),
    queryFn: () => api<InvitePreview>(`/v1/invites/${code}`),
    retry: false,
  });
}

export function useJoin(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ communityId: string; status: MembershipStatus }>(`/v1/invites/${code}/join`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.invite(code) });
      await qc.invalidateQueries({ queryKey: keys.myRequests });
    },
  });
}
