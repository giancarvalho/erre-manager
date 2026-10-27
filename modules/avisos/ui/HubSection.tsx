// Section of Mural de avisos in the community hub (D-033). Short: the latest notice and, below it, the menu entry of
// the manifest.
import type { HubSectionProps } from '@erre/core/client';
import { Skeleton, space, Text } from '@erre/ui';
import { StyleSheet, View } from 'react-native';

import { useAvisos } from './data';

export function HubSection(_props: HubSectionProps) {
  const avisos = useAvisos();
  const latest = avisos.data?.avisos[0];
  return (
    <View style={styles.box}>
      <Text variant="titleMd">Mural de avisos</Text>
      {avisos.isPending ? (
        <Skeleton width="60%" />
      ) : avisos.isError ? (
        <Text tone="muted">{avisos.error.message}</Text>
      ) : (
        <Text tone="secondary" numberOfLines={2}>
          {latest ? `Último aviso: ${latest.title}` : 'Nenhum aviso por enquanto.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space[2] } });
