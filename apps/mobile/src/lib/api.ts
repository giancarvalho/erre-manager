import { Platform } from 'react-native';

import { sessionCookie } from './auth';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiInit = {
  method?: string;
  body?: unknown;
  /** Community of the request; sent as X-Community-Id and validated by the API (D-014). */
  communityId?: string;
};

/** JSON call to the API. Errors come back as ApiError with the API's { code, message } (pt-BR). */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.communityId) headers['x-community-id'] = init.communityId;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const cookie = await sessionCookie();
  if (cookie) headers.cookie = cookie;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      ...(Platform.OS === 'web' ? { credentials: 'include' as const } : {}),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Sem conexão com o servidor. Confira sua internet.');
  }
  const data = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? 'Algo deu errado. Tente de novo.');
  }
  return data as T;
}

/**
 * fetch for module clients (hc): same session and X-Community-Id handling as api(), returning the raw
 * Response so the typed client can read it.
 */
export function moduleFetch(communityId: string): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('x-community-id', communityId);
    const cookie = await sessionCookie();
    if (cookie) headers.set('cookie', cookie);
    return fetch(input, { ...init, headers, ...(Platform.OS === 'web' ? { credentials: 'include' as const } : {}) });
  }) as typeof fetch;
}
