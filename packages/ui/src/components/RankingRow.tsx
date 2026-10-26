import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useFadeUp, usePulse } from '../motion';
import { useTheme } from '../theme';
import { radius, space, type avatar } from '../tokens';
import { Avatar } from './Avatar';
import { Text } from './Text';

/**
 * Ranking line (DESIGN §9.14): position · avatar 40 · name and received emojis · total. 1st place: pulsing
 * gold ring; 2nd and 3rd: fixed silver ring; trophy winners get the gold-subtle background.
 */
export function RankingRow({
  position,
  name,
  variant,
  chips,
  total,
  index = 0,
  trophy = false,
  trophies = [],
}: {
  position: number;
  name: string;
  variant: keyof typeof avatar;
  chips: readonly { emoji: string; count: number; label: string }[];
  total: number;
  index?: number;
  trophy?: boolean;
  /** Round trophies of this person: won (gold) or tied for the lead, "quase" (silver) (DESIGN §7, §9.14). */
  trophies?: readonly { emoji: string; name: string; tone: 'gold' | 'silver' }[];
}) {
  const { colors } = useTheme();
  const enter = useFadeUp(index);
  // Nobody gets a podium ring without votes (a 0 in 2nd place is not a 2nd place).
  const podium = total === 0 ? null : position === 1 ? 'gold' : position <= 3 ? 'silver' : null;
  const pulse = usePulse('gold', podium === 'gold', 1);
  const ring = useAnimatedStyle(() => ({ opacity: podium === 'gold' ? pulse.value : 1 }));
  const won = trophies.map((t) => (t.tone === 'gold' ? t.name : `quase ${t.name}`));
  const description = `${position}º lugar, ${name}, ${total} votos: ${chips.map((c) => `${c.count} ${c.label}`).join(', ')}${
    won.length ? `. ${won.join(', ')}` : ''
  }`;
  return (
    <Animated.View
      accessible
      accessibilityLabel={description}
      style={[
        styles.row,
        { backgroundColor: trophy ? colors.trophy.goldSubtle : colors.bg.surface, borderColor: colors.border.subtle },
        enter,
      ]}
    >
      {podium ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.ring,
            { borderColor: podium === 'gold' ? colors.trophy.gold : colors.trophy.silver },
            ring,
          ]}
        />
      ) : null}
      <Text variant="label" tone="muted" style={styles.position}>
        {position}
      </Text>
      <Avatar name={name} variant={variant} />
      <View style={styles.middle}>
        <Text variant="label" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c.emoji} style={[styles.chip, { backgroundColor: colors.bg.control }]}>
              <Text variant="caption" maxFontSizeMultiplier={1.4} tone="secondary">{`${c.emoji} ${c.count}`}</Text>
            </View>
          ))}
        </View>
        {trophies.length ? (
          <View style={styles.chips}>
            {trophies.map((t) => (
              <View
                key={`${t.tone}-${t.name}`}
                style={[
                  styles.chip,
                  styles.trophyChip,
                  {
                    borderColor: t.tone === 'gold' ? colors.trophy.gold : colors.trophy.silver,
                    backgroundColor: t.tone === 'gold' ? colors.trophy.goldSubtle : colors.bg.control,
                  },
                ]}
              >
                <Text variant="caption" maxFontSizeMultiplier={1.4} tone="secondary" numberOfLines={1}>
                  {`${t.emoji} ${t.tone === 'gold' ? t.name : `Quase: ${t.name}`}`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Text variant="titleMd">{total}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  ring: { borderWidth: 2, borderRadius: radius.lg },
  position: { width: 24, textAlign: 'center' },
  middle: { flex: 1, gap: space[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  chip: { borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[0.5] },
  trophyChip: { borderWidth: 1 },
});
