import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePop, usePulse } from '../motion';
import { useTheme } from '../theme';
import { radius } from '../tokens';
import { Text } from './Text';

/**
 * Trophy medal (DESIGN §9.14): emoji in a circle with a gold-to-canvas gradient, 2 px ring and pulsing
 * glow; small 🏆 seal at the bottom right. Silver = "quase" (tie), fixed ring. Enters with pop.
 */
export function TrophyMedallion({
  emoji,
  tone = 'gold',
  size = 72,
  label,
}: {
  emoji: string;
  tone?: 'gold' | 'silver';
  size?: number;
  label: string;
}) {
  const { colors } = useTheme();
  const ring = tone === 'gold' ? colors.trophy.gold : colors.trophy.silver;
  const pop = usePop(true);
  const pulse = usePulse('gold', tone === 'gold');
  // Colored shadow is an extra on iOS and web; Android relies on the ring alone (DESIGN §7).
  const glow = useAnimatedStyle(() =>
    Platform.OS === 'android'
      ? {}
      : {
          shadowColor: ring,
          shadowOpacity: 0.5 * pulse.value,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        },
  );
  return (
    <Animated.View accessibilityRole="image" accessibilityLabel={label} style={[{ width: size, height: size }, pop]}>
      <Animated.View style={[styles.circle, { width: size, height: size, borderColor: ring }, glow]}>
        <LinearGradient
          colors={[tone === 'gold' ? colors.trophy.goldSubtle : colors.bg.surface, colors.bg.surface, colors.bg.canvas]}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        <Text maxFontSizeMultiplier={1} style={{ fontSize: size * 0.45, lineHeight: size * 0.6 }}>
          {emoji}
        </Text>
      </Animated.View>
      {tone === 'gold' ? (
        <View
          style={[
            styles.seal,
            {
              backgroundColor: colors.trophy.goldStrong,
              borderColor: colors.bg.canvas,
              width: size * 0.36,
              height: size * 0.36,
            },
          ]}
        >
          <Text maxFontSizeMultiplier={1} style={{ fontSize: size * 0.18, lineHeight: size * 0.24 }}>
            🏆
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  seal: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
