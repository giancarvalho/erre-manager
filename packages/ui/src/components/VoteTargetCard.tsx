import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePulse } from '../motion';
import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Avatar, type AvatarVariant } from './Avatar';
import { Text } from './Text';

/**
 * Person card in the voting grid (DESIGN §9.3): avatar 64, name, and the emoji grid as children. With a vote:
 * accent ring and the cyan "seu voto está aqui" pulse (the ring alone on Android and with reduced motion, §7).
 */
export function VoteTargetCard({
  name,
  avatarVariant,
  voted,
  children,
}: {
  name: string;
  avatarVariant: AvatarVariant;
  voted: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const pulse = usePulse('neon', voted);
  const glow = useAnimatedStyle(() =>
    Platform.OS === 'android' || !voted
      ? {}
      : {
          shadowColor: colors.accent.ring,
          shadowOpacity: 0.45 * pulse.value,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
  );
  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg.surface,
          borderColor: voted ? colors.accent.ring : colors.border.subtle,
          borderWidth: voted ? 2 : 1,
          padding: voted ? space[3] - 1 : space[3],
        },
        glow,
      ]}
    >
      <View style={styles.person}>
        <Avatar name={name} variant={avatarVariant} size={64} />
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
      </View>
      {children}
    </Animated.View>
  );
}

/** Gap between emoji buttons in the grid. */
export const EMOJI_GRID_GAP = space[1.5];

/** Emoji buttons in rows of `columns` (3 in the voting card), each `buttonSize` wide (see EmojiButton). */
export function EmojiGrid({
  columns = 3,
  buttonSize,
  children,
}: {
  columns?: number;
  buttonSize: number;
  children: ReactNode;
}) {
  const width = columns * buttonSize + (columns - 1) * EMOJI_GRID_GAP;
  return <View style={[styles.grid, { width, gap: EMOJI_GRID_GAP }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, gap: space[2] },
  person: { alignItems: 'center', gap: space[2] },
  name: { fontWeight: '500', textAlign: 'center', alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center' },
});
