import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';

export type CardProps = {
  children: ReactNode;
  /** Tappable card: pressed background (DESIGN §9.3). */
  onPress?: () => void;
  /** Selectable card: 2 px accent ring when selected. */
  selected?: boolean;
  accessibilityLabel?: string;
  /** Defaults to "radio" for selectable cards and "button" for tappable ones. */
  accessibilityRole?: AccessibilityRole;
};

export function Card({ children, onPress, selected, accessibilityLabel, accessibilityRole }: CardProps) {
  const { colors } = useTheme();
  const selectable = selected !== undefined;
  const base = [
    styles.card,
    { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
    selected && { borderColor: colors.accent.ring, borderWidth: 2, padding: space[4] - 1 },
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole ?? (selectable ? 'radio' : 'button')}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(selectable ? { accessibilityState: { checked: !!selected, selected: !!selected } } : {})}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.bg.surfacePressed }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], minHeight: layout.minTouch },
});
