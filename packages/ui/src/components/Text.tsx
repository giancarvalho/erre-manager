import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import { fonts, type as typeScale, type ThemeColors } from '../tokens';

export type TextVariant = keyof typeof typeScale;
export type TextTone = keyof ThemeColors['text'] | 'accent' | 'danger' | 'success' | 'warning';

export type TextProps = RNTextProps & { variant?: TextVariant; tone?: TextTone };

/** Geist family for a weight; mono for the mono variant. */
export function fontFor(style: TextStyle, variant?: TextVariant): TextStyle {
  if (variant === 'mono') return { fontFamily: fonts.mono };
  const weight = String(style.fontWeight ?? '400') as keyof typeof fonts;
  return { fontFamily: fonts[weight] ?? fonts['400'], fontWeight: undefined };
}

/** Text in the type scale (DESIGN §4). Font scaling stays on; dense components cap it themselves. */
export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'accent'
      ? colors.accent.text
      : tone === 'danger'
        ? colors.danger.text
        : tone === 'success'
          ? colors.success.text
          : tone === 'warning'
            ? colors.warning.text
            : colors.text[tone];
  const flat: TextStyle = StyleSheet.flatten([typeScale[variant] as TextStyle, { color }, style]) ?? {};
  return <RNText {...rest} style={[flat, fontFor(flat, variant)]} />;
}
