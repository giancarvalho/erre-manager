// The Errômetro's section in the community hub (D-033): round state and participation. The menu entries
// below it (manifest) open the voting screen.
import type { HubSectionProps } from '@erre/core/client';
import { Button, Skeleton, space, Text } from '@erre/ui';
import { StyleSheet, View } from 'react-native';

import { useRound } from './data';
import { ParticipationPanel } from './Participation';

export function HubSection(_props: HubSectionProps) {
  const round = useRound();
  return (
    <View style={styles.box}>
      <Text variant="titleMd">Errômetro</Text>
      {round.isPending ? (
        <View style={styles.box} accessibilityLabel="Carregando o Errômetro" accessible>
          <Skeleton width="70%" />
          <Skeleton width="50%" />
        </View>
      ) : round.isError ? (
        <View style={styles.box}>
          <Text tone="muted">{round.error.message}</Text>
          <Button label="Tentar de novo" variant="secondary" onPress={() => void round.refetch()} />
        </View>
      ) : (
        <>
          <Text tone="secondary">
            {round.data.cadence.nextRelease
              ? `${round.data.cadence.description}. Próximo resultado: ${round.data.cadence.nextRelease.label}.`
              : `${round.data.cadence.description}.`}
          </Text>
          <ParticipationPanel participation={round.data.participation} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space[2] } });
