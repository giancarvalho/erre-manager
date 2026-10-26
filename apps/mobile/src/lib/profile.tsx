// A member's page and profile (CORE-14, CORE-15): every enabled module's profile section, rendered by the module's
// own renderer (D-018). Sections a module doesn't render in this app are left out.
import { EmptyState, Skeleton, space } from '@erre/ui';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { api } from './api';
import { ModuleHost, useModules } from './modules';

type Section = { id: string; module: string; data: unknown };

export function useProfileSections(communityId: string, userId: string) {
  return useQuery({
    queryKey: ['community', communityId, 'profile', userId],
    queryFn: () => api<Section[]>(`/v1/profile/${userId}/sections`, { communityId }),
  });
}

export function ProfileSections({ communityId, userId }: { communityId: string; userId: string }) {
  const sections = useProfileSections(communityId, userId);
  const { modules } = useModules();
  if (sections.isPending)
    return (
      <View style={styles.list} accessibilityLabel="Carregando os troféus" accessible>
        <Skeleton height={96} />
      </View>
    );
  if (sections.isError) return <EmptyState emoji="😶" message="Não deu pra carregar os troféus agora." />;
  const rendered = sections.data.flatMap((s) => {
    const Renderer = modules.find((m) => m.manifest.id === s.module)?.profileSections?.[s.id];
    return Renderer ? [{ ...s, Renderer }] : [];
  });
  if (rendered.length === 0) return <EmptyState emoji="🏆" message="Nenhum troféu por aqui ainda." />;
  return (
    <ModuleHost>
      <View style={styles.list}>
        {rendered.map(({ id, data, Renderer }) => (
          <Renderer key={id} data={data} userId={userId} />
        ))}
      </View>
    </ModuleHost>
  );
}

const styles = StyleSheet.create({ list: { gap: space[8] } });
