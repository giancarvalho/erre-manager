import { Pressable, StyleSheet } from 'react-native';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

/**
 * Toggle pill (DESIGN §9.6 shape, §9.3 selection): off = bg.control and border.default; on =
 * bg.controlSelected with the 2 px accent ring. 48 high. Used for weekdays and for picking emojis.
 */
export function ChipToggle({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-pressed={selected}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.bg.controlSelected : colors.bg.control,
          borderColor: selected ? colors.accent.ring : colors.border.default,
          borderWidth: selected ? 2 : 1,
          paddingHorizontal: selected ? space[3] - 1 : space[3],
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.minTouch,
    minWidth: layout.minTouch,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '500' },
});
