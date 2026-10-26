import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptic } from '../haptics';
import { usePop, usePressScale } from '../motion';
import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Emoji in the voting grid (DESIGN §9.4): 48 × 48, bg.control; selected gets bg.controlSelected, 1 px
 * accent ring, pop and a selection haptic. The label carries name and meaning ("Cobra: falso, age pelas costas").
 * In a dense grid `size` can go down to 40; hitSlop keeps the touch target at 48 (§9.1).
 */
export function EmojiButton({
  emoji,
  label,
  selected,
  onPress,
  size = layout.minTouch,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: number;
}) {
  const side = Math.max(EMOJI_BUTTON_MIN, Math.min(layout.minTouch, size));
  const slop = (layout.minTouch - side) / 2;
  const { colors } = useTheme();
  const press = usePressScale();
  const pop = usePop(selected);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={slop > 0 ? slop : undefined}
      style={[
        styles.button,
        { width: side, height: side },
        {
          backgroundColor: selected ? colors.bg.controlSelected : colors.bg.control,
          borderColor: selected ? colors.accent.ring : 'transparent',
        },
        press.style,
      ]}
    >
      <Animated.View style={pop}>
        <Text maxFontSizeMultiplier={1.4} style={styles.emoji}>
          {emoji}
        </Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

/** Smallest emoji button in a dense grid (DESIGN §9.4, proposed in Sprint 14). */
export const EMOJI_BUTTON_MIN = 40;

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 23, lineHeight: 30 },
});
