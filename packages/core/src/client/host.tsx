// What a module's UI gets from the app (ARQUITETURA §5): the current community and a typed client for
// its own API, with X-Community-Id and the session already applied by the app.
import type { Hono } from 'hono';
import { hc } from 'hono/client';
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';

import type { Role } from '../shared/community';
import type { ModuleManifest } from '../shared/manifest';

export type HostCommunity = { id: string; name: string; role: Role };

export type ModuleHost = {
  community: HostCommunity;
  /** API base URL (e.g. https://api.example.com). */
  apiUrl: string;
  /** fetch with the session (cookie on web, header on native) and X-Community-Id of `community`. */
  fetch: typeof fetch;
  /** Navigate inside the app (Expo Router path). */
  navigate: (path: string) => void;
};

const HostContext = createContext<ModuleHost | null>(null);

export function ModuleHostProvider({ host, children }: { host: ModuleHost; children: ReactNode }) {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useModuleHost(): ModuleHost {
  const host = useContext(HostContext);
  if (!host) throw new Error('useModuleHost must be used inside ModuleHostProvider (module screens and sections)');
  return host;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route shape; the module's own type narrows it
type AnyHono = Hono<any, any, any>;

/**
 * Typed RPC client for a module's API (D-009): `useModuleClient<ErrometroApi>('errometro')`. Import the
 * API type with `import type` only.
 */
export function useModuleClient<T extends AnyHono>(moduleId: string) {
  const { apiUrl, fetch } = useModuleHost();
  return useMemo(() => hc<T>(`${apiUrl}/v1/${moduleId}`, { fetch }), [apiUrl, fetch, moduleId]);
}

export type HubSectionProps = { community: HostCommunity };
export type ProfileSectionProps = { data: unknown; userId: string };

export type ModuleUiDefinition = {
  /** Section of the community hub (D-033). */
  hubSection?: ComponentType<HubSectionProps>;
  /** Renderers for the profile sections the API half declares (D-018). */
  profileSections?: Record<string, ComponentType<ProfileSectionProps>>;
};

export type ModuleUi = ModuleUiDefinition & { manifest: ModuleManifest };

/** App half of a module (D-019). Registered statically in apps/mobile/src/modules.ts. */
export function defineModuleUi(manifest: ModuleManifest, definition: ModuleUiDefinition): ModuleUi {
  return { manifest, ...definition };
}
