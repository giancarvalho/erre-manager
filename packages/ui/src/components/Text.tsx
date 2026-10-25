import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../theme';
import { type as typeScale, type ThemeColors } from '../tokens';

export type TextVariant = keyof typeof typeScale;
export type TextTone = keyof ThemeColors['text'] | 'accent' | 'danger' | 'success';

export type TextProps = RNTextProps & { variant?: TextVariant; tone?: TextTone };

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
          : colors.text[tone];
  return <RNText {...rest} style={[typeScale[variant], { color }, style]} />;
}
