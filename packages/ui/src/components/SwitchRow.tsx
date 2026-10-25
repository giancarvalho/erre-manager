import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, space } from '../tokens';
import { Text } from './Text';

/** On/off preference that applies immediately (DESIGN §9.17). */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  disabledReason,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const { colors, name } = useTheme();
  const inactive = disabled || !!disabledReason;
  const thumb = name === 'dark' ? colors.primary.bg : colors.bg.raised;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled: inactive }}
        disabled={inactive}
        onPress={() => onValueChange(!value)}
        style={[styles.row, inactive && styles.disabled]}
      >
        <View style={styles.text}>
          <Text variant="label">{label}</Text>
          {description ? (
            <Text variant="caption" tone="muted">
              {description}
            </Text>
          ) : null}
        </View>
        <Switch
          value={value}
          disabled={inactive}
          onValueChange={onValueChange}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          trackColor={{ true: colors.accent.solid, false: colors.bg.controlSelected }}
          thumbColor={thumb}
          // React Native Web reads the "on" thumb color from activeThumbColor.
          {...{ activeThumbColor: thumb }}
        />
      </Pressable>
      {disabledReason ? (
        <Text variant="caption" tone="muted">
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1.5] },
  row: { minHeight: layout.minTouch, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  text: { flex: 1, gap: space[0.5] },
  disabled: { opacity: 0.4 },
});
