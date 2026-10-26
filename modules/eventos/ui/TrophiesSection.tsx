// Profile section "eventos.trofeus" (D-018, EVT-12): categorical wins as ×N medals, like the Errômetro; scale wins
// name the event and the score. Ported in behavior from queridometro@7c5c5bf:
// src/components/trophies/EventScaleTrophyList.tsx.
import type { ProfileSectionProps } from '@erre/core/client';
import { space, Text, TrophyMedallion } from '@erre/ui';
import { StyleSheet, View } from 'react-native';

import { scalePercent } from '../domain/presentation';
import type { MemberEventTrophies } from '../domain/trophies';

export function TrophiesSection({ data }: ProfileSectionProps) {
  const { categorical, scale } = data as MemberEventTrophies;
  return (
    <View style={styles.box}>
      <Text variant="titleMd">Troféus de eventos</Text>
      {categorical.length ? (
        <View style={styles.grid}>
          {categorical.map((t) => (
            <View key={t.emojiId} style={styles.item}>
              <TrophyMedallion
                emoji={t.char}
                label={`${t.trophyName}, ${t.winCount} ${t.winCount === 1 ? 'vez' : 'vezes'}`}
                size={56}
              />
              <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.center}>
                {t.trophyName}
              </Text>
              <Text variant="caption" tone="muted">{`${t.winCount}×`}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {scale.map((t) => {
        const score = t.scaleMax === 1 ? `×${t.average}` : `${scalePercent(t.average, t.scaleMax)}%`;
        return (
          <View
            key={`${t.eventId}-${t.emojiId}`}
            style={styles.row}
            accessible
            accessibilityLabel={`${t.trophyName} em ${t.eventTitle}, ${score}`}
          >
            <TrophyMedallion emoji={t.char} label={t.trophyName} size={40} />
            <View style={styles.flex}>
              <Text variant="label" numberOfLines={1}>
                {t.trophyName}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {t.eventTitle}
              </Text>
            </View>
            <Text variant="label">{score}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  item: { width: 96, alignItems: 'center', gap: space[1] },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
});
