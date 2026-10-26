import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '../motion';
import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Button with a glyph only (✕, ‹, ⋯). The label is required: it is what screen readers say (DESIGN §10.7).
 * No icon library is approved yet; glyphs are text.
 */
export function IconButton({
  glyph,
  label,
  onPress,
  disabled,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const press = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={4}
      style={[styles.button, disabled && styles.disabled, press.style]}
    >
      <Text variant="titleMd" style={{ color: colors.text.muted }} maxFontSizeMultiplier={1.4}>
        {glyph}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
