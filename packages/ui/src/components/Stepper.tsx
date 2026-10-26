import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

/**
 * Number picker with − and + (e.g. the release hour). Wraps around from max to min. The value is announced as
 * an adjustable control with the formatted text.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  format = String,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  const step = (d: number) => onChange(value + d > max ? min : value + d < min ? max : value + d);
  return (
    <View style={styles.wrap}>
      <Text variant="overline" tone="muted">
        {label}
      </Text>
      <View
        style={[styles.row, { borderColor: colors.border.input, backgroundColor: colors.bg.input }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <IconButton glyph="−" label={`Diminuir ${label.toLowerCase()}`} onPress={() => step(-1)} />
        <Text variant="titleMd" style={styles.value}>
          {format(value)}
        </Text>
        <IconButton glyph="+" label={`Aumentar ${label.toLowerCase()}`} onPress={() => step(1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1.5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[1],
  },
  value: { flex: 1, textAlign: 'center' },
});
