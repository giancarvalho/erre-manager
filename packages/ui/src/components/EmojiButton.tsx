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
 */
export function EmojiButton({
  emoji,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const press = usePressScale();
  const pop = usePop(selected);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.button,
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

const styles = StyleSheet.create({
  button: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 23, lineHeight: 30 },
});
