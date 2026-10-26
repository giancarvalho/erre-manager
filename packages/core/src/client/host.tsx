// What a module's UI gets from the app (ARQUITETURA §5): the current community and a typed client for
// its own API, with X-Community-Id and the session already applied by the app.
import type { Hono } from 'hono';
import { hc } from 'hono/client';
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';

import type { Role } from '../shared/community';
import type { ModuleManifest } from '../shared/manifest';

export type HostCommunity = { id: string; name: string; role: Role };

/**
 * Key/value storage on this device, provided by the app. Keys start with the module id and use only letters,
 * digits, ".", "-" and "_" (e.g. "errometro.lastvotes.<community>"); anything else throws.
 */
export type HostStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const HOST_STORAGE_KEY = /^[A-Za-z0-9._-]{1,200}$/;

export type ModuleHost = {
  community: HostCommunity;
  /** API base URL (e.g. https://api.example.com). */
  apiUrl: string;
  /** Public web address of the app (e.g. https://app.example.com), for links people share. */
  webUrl: string;
  /** fetch with the session (cookie on web, header on native) and X-Community-Id of `community`. */
  fetch: typeof fetch;
  /** Navigate inside the app (Expo Router path). */
  navigate: (path: string) => void;
  /** Go back ("← Início", DESIGN §9.16); to the hub when there is nothing to go back to. */
  back: () => void;
  /** Preferences and caches (AsyncStorage on native, localStorage on web). Never sent anywhere. */
  storage: HostStorage;
  /** Secrets (secure store on native, localStorage on web), e.g. the anonymous vote token. Values ≤ 2 KB. */
  secureStorage: HostStorage;
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
