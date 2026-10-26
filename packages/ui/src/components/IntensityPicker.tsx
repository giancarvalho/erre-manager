import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

/**
 * Intensity of one axis in a scale event (proposed in Sprint 17, DESIGN §9.4): the axis' own emoji repeated
 * `max` times, filled up to the chosen value ("🍋🍋🍋" = 3), like the legacy EventScaleIntensityPicker. Each pip
 * is a button 48 tall that shares the row width (a 10-pip row fits a 360 screen); its label says the value
 * ("Limão: 3 de 10, para Ana"). Tapping the current value clears it. Selection haptic on every tap.
 */
export function IntensityPicker({
  emoji,
  label,
  max,
  value,
  onChange,
  target,
}: {
  emoji: string;
  /** Axis name, e.g. "Limão". */
  label: string;
  max: number;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Who is being rated, completes each pip's label. */
  target?: string;
}) {
  const { colors } = useTheme();
  const pips = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <View role="group" aria-label={`${label}${target ? `, para ${target}` : ''}: de 1 a ${max}`} style={styles.row}>
      {pips.map((n) => {
        const filled = value !== undefined && n <= value;
        const current = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${n} de ${max}${target ? `, para ${target}` : ''}`}
            aria-pressed={current}
            onPress={() => {
              haptic.selection();
              onChange(current ? undefined : n);
            }}
            style={({ pressed }) => [
              styles.pip,
              {
                backgroundColor: filled || pressed ? colors.bg.controlSelected : colors.bg.control,
                borderColor: current ? colors.accent.ring : 'transparent',
              },
            ]}
          >
            <Text maxFontSizeMultiplier={1.2} style={[styles.emoji, !filled && styles.dim]}>
              {emoji}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[1] },
  pip: {
    flex: 1,
    maxWidth: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18, lineHeight: 24 },
  dim: { opacity: 0.35 },
});
