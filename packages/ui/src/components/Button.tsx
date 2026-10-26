import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '../motion';
import { useTheme } from '../theme';
import { layout, radius, space, type ThemeColors } from '../tokens';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Shown instead of the label while loading, e.g. "Salvando…" (DESIGN §9.1). */
  loadingLabel?: string;
  loading?: boolean;
  /** Why the button is disabled; rendered below it (DESIGN §9.1). */
  disabledReason?: string | null;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
};

function look(colors: ThemeColors, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary.bg, fg: colors.primary.text, border: colors.primary.bg, weight: '600' as const };
    case 'accent':
      return {
        bg: colors.accent.solid,
        fg: colors.accent.onSolid,
        border: colors.accent.solid,
        weight: '600' as const,
      };
    case 'destructive':
      return { bg: colors.danger.subtle, fg: colors.danger.text, border: colors.danger.border, weight: '500' as const };
    case 'ghost':
      return { bg: undefined, fg: colors.text.muted, border: undefined, weight: '500' as const };
    case 'secondary':
      return { bg: undefined, fg: colors.text.primary, border: colors.border.default, weight: '500' as const };
  }
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  loadingLabel,
  loading = false,
  disabledReason,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const l = look(colors, variant);
  const inactive = disabled || loading || !!disabledReason;
  const press = usePressScale(fullWidth);
  return (
    <View style={[fullWidth && styles.stretch, styles.wrap]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
        aria-disabled={inactive}
        aria-busy={loading}
        {...(accessibilityHint ? { accessibilityHint } : {})}
        disabled={inactive}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.button,
          { backgroundColor: l.bg, borderColor: l.border ?? 'transparent' },
          fullWidth ? styles.stretch : styles.start,
          (disabled || !!disabledReason) && styles.disabled,
          press.style,
        ]}
      >
        {({ pressed }) => (
          <Text
            variant="label"
            style={{ color: variant === 'ghost' && pressed ? colors.text.primary : l.fg, fontWeight: l.weight }}
          >
            {loading && loadingLabel ? loadingLabel : label}
          </Text>
        )}
      </AnimatedPressable>
      {disabledReason ? (
        <Text variant="caption" tone="muted" style={fullWidth ? styles.reason : undefined}>
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1.5] },
  button: {
    minHeight: layout.minTouch,
    paddingHorizontal: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stretch: { alignSelf: 'stretch' },
  start: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.4 },
  reason: { textAlign: 'center' },
});
