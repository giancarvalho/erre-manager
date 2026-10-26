// Profile section "errometro.trofeus" (D-018, ERR-21): all-time trophies of a member in the visible rounds.
import type { ProfileSectionProps } from '@erre/core/client';
import { space, Text, TrophyMedallion } from '@erre/ui';
import { StyleSheet, View } from 'react-native';

type Trophy = { emojiId: string; char: string; trophyName: string; glowRgb: string | null; winCount: number };

export function TrophiesSection({ data }: ProfileSectionProps) {
  const trophies = data as Trophy[];
  return (
    <View style={styles.box}>
      <Text variant="titleMd">Troféus do Errômetro</Text>
      <View style={styles.grid}>
        {trophies.map((t) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  item: { width: 96, alignItems: 'center', gap: space[1] },
  center: { textAlign: 'center' },
});
