// Calls to a module's API from its UI (D-009). Every module had its own copy of this (Sprint 20, [contrato]).

export const NETWORK_ERROR = 'Sem conexão com o servidor. Confira sua internet.';

/** A failed module call: the API's { code, message } (pt-BR), or NETWORK_ERROR with status 0. */
export class ModuleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ModuleApiError';
  }
}

type Called<T> = { ok: boolean; status: number; json: () => Promise<T> };

/**
 * Runs a call of the typed client (`useModuleClient`) and returns the JSON body, or throws ModuleApiError with a
 * message ready to show. Use it as the `queryFn`/`mutationFn` of React Query:
 * `queryFn: () => callModule(() => client.index.$get())`.
 */
export async function callModule<T>(call: () => Promise<Called<T>>): Promise<T> {
  let res: Called<T>;
  try {
    res = await call();
  } catch {
    throw new ModuleApiError(0, 'NETWORK_ERROR', NETWORK_ERROR);
  }
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  throw new ModuleApiError(res.status, body?.code ?? 'UNKNOWN', body?.message ?? 'Algo deu errado. Tente de novo.');
}
