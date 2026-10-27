// Renders a module's UI with a fake host (Sprint 20): the module's API is a map of "METHOD /path" handlers,
// paths relative to /v1/<moduleId>. Used by the tests `pnpm create-module` generates; any module can use it.
import { ModuleHostProvider, type HostStorage, type ModuleHost } from '@erre/core/client';
import { ThemeProvider, ToastProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const API = 'http://api.test';
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export type Routes = Record<string, (body: unknown) => Response | Promise<Response>>;
export type Call = { method: string; path: string; body: unknown };

function memoryStorage(): HostStorage {
  const data = new Map<string, string>();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

export function fakeModuleHost(moduleId: string, routes: Routes, role: ModuleHost['community']['role'] = 'membro') {
  const calls: Call[] = [];
  const fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = String(input).replace(`${API}/v1/${moduleId}`, '');
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`unexpected ${method} ${path}`);
    return handler(body);
  }) as unknown as typeof globalThis.fetch;

  const host: ModuleHost = {
    community: { id: '11111111-1111-4111-8111-111111111111', name: 'turma', role },
    apiUrl: API,
    webUrl: 'http://web.test',
    fetch,
    navigate: jest.fn(),
    back: jest.fn(),
    openMember: jest.fn(),
    storage: memoryStorage(),
    secureStorage: memoryStorage(),
  };
  // gcTime Infinity: TanStack's garbage-collection timers would keep Jest from exiting.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const wrap = (children: ReactNode) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <ModuleHostProvider host={host}>{children}</ModuleHostProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return { host, calls, wrap };
}
