// The Eventos section of the community hub (D-033): the live event, or one closed in the last 2 days. The way to
// the list is the manifest's menu entry ("Eventos") the hub shows below the section. Ported in behavior from
// queridometro@7c5c5bf:src/app/group/[id]/page.tsx.
import type { HubSectionProps } from '@erre/core/client';
import { Button, Skeleton, space, Text } from '@erre/ui';
import { StyleSheet, View } from 'react-native';

import { hubEvent } from '../domain/presentation';
import { useEvents } from './data';
import { EventBanner } from './EventBanner';

export function HubSection(_props: HubSectionProps) {
  const events = useEvents();
  const highlighted = events.data ? hubEvent(events.data.events, new Date()) : null;
  return (
    <View style={styles.box}>
      <Text variant="titleMd">Eventos</Text>
      {events.isPending ? (
        <View style={styles.box} accessibilityLabel="Carregando os eventos" accessible>
          <Skeleton width="70%" />
        </View>
      ) : events.isError ? (
        <View style={styles.box}>
          <Text tone="muted">{events.error.message}</Text>
          <Button label="Tentar de novo" variant="secondary" onPress={() => void events.refetch()} />
        </View>
      ) : highlighted ? (
        <EventBanner event={highlighted} />
      ) : (
        <Text tone="secondary">Votações únicas, além do Errômetro de sempre.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space[2] } });
