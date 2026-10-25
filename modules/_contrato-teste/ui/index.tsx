import { defineModuleUi, useModuleClient, type HubSectionProps, type ProfileSectionProps } from '@erre/core/client';
import { space, Text } from '@erre/ui';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import type { ContratoTesteApi } from '../api';
import manifest from '../manifest';

function HubSection({ community }: HubSectionProps) {
  const client = useModuleClient<ContratoTesteApi>('contratoteste');
  const items = useQuery({
    queryKey: ['contratoteste', community.id, 'items'],
    queryFn: async () => {
      const res = await client.items.$get();
      if (!res.ok) throw new Error('items');
      return res.json();
    },
  });
  return (
    <View style={styles.section}>
      <Text variant="titleMd">Contrato (teste)</Text>
      <Text tone="muted">{items.data ? `${items.data.length} itens` : 'Carregando…'}</Text>
    </View>
  );
}

function ResumoSection({ data }: ProfileSectionProps) {
  const { itemsCreated } = data as { itemsCreated: number };
  return <Text>{`Criou ${itemsCreated} itens`}</Text>;
}

export default defineModuleUi(manifest, {
  hubSection: HubSection,
  profileSections: { 'contratoteste.resumo': ResumoSection },
});

const styles = StyleSheet.create({ section: { gap: space[2] } });
