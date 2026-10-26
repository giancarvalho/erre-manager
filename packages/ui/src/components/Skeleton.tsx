import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePulse } from '../motion';
import { useTheme } from '../theme';
import { radius } from '../tokens';

/** Loading placeholder with the shape of the content (DESIGN §9.15): bg.control, 1.2 s opacity pulse. */
export function Skeleton({
  width = '100%',
  height = 16,
  round = false,
}: {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
}) {
  const { colors } = useTheme();
  const pulse = usePulse('neon', true, 0.7);
  // Never below 65%: in the light theme bg.control is close to the canvas.
  const style = useAnimatedStyle(() => ({ opacity: 0.65 + 0.35 * pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width, height, backgroundColor: colors.bg.control, borderRadius: round ? radius.full : radius.md },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({ base: { overflow: 'hidden' } });
