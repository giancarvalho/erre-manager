import { ModuleHostProvider, type ModuleManifest, type ModuleUi } from '@erre/core/client';
import { Button, ErrorState, LoadingState, Screen, ScreenHeader } from '@erre/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, type ComponentType, type ReactNode } from 'react';

import { MODULE_UIS } from '@/modules';

import { api, moduleFetch } from './api';
import { useCommunity } from './community';
import { API_URL } from './config';

/** Manifests of the modules enabled in the API. */
export function useEnabledManifests() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: () => api<ModuleManifest[]>('/v1/modules'),
    staleTime: 5 * 60_000,
  });
}

/** Module UIs that are both registered in the app and enabled in the API. */
export function useModules(): { modules: ModuleUi[]; isPending: boolean } {
  const enabled = useEnabledManifests();
  const modules = useMemo(() => {
    const ids = new Set((enabled.data ?? []).map((m) => m.id));
    return MODULE_UIS.filter((ui) => ids.has(ui.manifest.id));
  }, [enabled.data]);
  return { modules, isPending: enabled.isPending };
}

/** Gives module UIs the current community and a client with the session and X-Community-Id. */
export function ModuleHost({ children }: { children: ReactNode }) {
  const { current } = useCommunity();
  const host = useMemo(
    () =>
      current
        ? {
            community: { id: current.id, name: current.name, role: current.role },
            apiUrl: API_URL,
            fetch: moduleFetch(current.id),
            navigate: (path: string) => router.push(path as never),
          }
        : null,
    [current],
  );
  if (!host) return null;
  return <ModuleHostProvider host={host}>{children}</ModuleHostProvider>;
}

/**
 * Wraps a module screen for a thin route file: shows "Funcionalidade indisponível" when the module is off.
 * Usage: `export default withModule('errometro', VoteScreen);`
 */
export function withModule<P extends object>(moduleId: string, Screen: ComponentType<P>) {
  function ModuleScreen(props: P) {
    const { modules, isPending } = useModules();
    const enabled = useEnabledManifests();
    if (isPending) return <LoadingState />;
    if (enabled.isError) return <ErrorState message="Não deu pra carregar." onRetry={() => enabled.refetch()} />;
    if (!modules.some((m) => m.manifest.id === moduleId)) return <Unavailable />;
    return (
      <ModuleHost>
        <Screen {...props} />
      </ModuleHost>
    );
  }
  ModuleScreen.displayName = `withModule(${moduleId})`;
  return ModuleScreen;
}

function Unavailable() {
  return (
    <Screen>
      <ScreenHeader
        overline="Indisponível"
        title="Funcionalidade indisponível"
        description="Essa parte do app está desligada no momento."
      />
      <Button label="Voltar ao início" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
