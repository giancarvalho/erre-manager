import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Text } from './Text';

/** Segmented control (DESIGN §9.7): e.g. "Alfabética / Não votados". */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.box, { borderColor: colors.border.default }]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) haptic.selection();
              onChange(o.value);
            }}
            style={[styles.segment, on && { backgroundColor: colors.bg.control }]}
          >
            <Text variant="label" tone={on ? 'primary' : 'muted'} maxFontSizeMultiplier={1.4}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[1],
    gap: space[1],
  },
  segment: { minHeight: 40, paddingHorizontal: space[3], borderRadius: radius.md, justifyContent: 'center' },
});
