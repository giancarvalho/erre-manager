import { useEffect, useId, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptic } from '../haptics';
import { useShake } from '../motion';
import { useTheme } from '../theme';
import { fonts, layout, radius, space, type } from '../tokens';
import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  help?: string;
  error?: string | null;
};

/** Overline label above, help or error below (DESIGN §9.2). */
export function TextField({ label, help, error, onFocus, onBlur, ...input }: TextFieldProps) {
  // Long text (DESIGN §9.2): grows with the content from about four lines, text starting at the top.
  const { colors, name } = useTheme();
  const [focused, setFocused] = useState(false);
  const id = useId();
  const borderColor = error ? colors.danger.text : focused ? colors.border.focus : colors.border.input;
  const shake = useShake(error);
  useEffect(() => {
    if (error) haptic.error();
  }, [error]);
  return (
    <Animated.View style={[styles.wrap, shake]}>
      <Text variant="overline" tone="muted" nativeID={`${id}-label`}>
        {label}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        {...(error || help ? { accessibilityHint: error ?? help } : {})}
        keyboardAppearance={name}
        placeholderTextColor={colors.text.placeholder}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          type.body,
          { fontFamily: fonts['400'] },
          styles.input,
          input.multiline && styles.multiline,
          { backgroundColor: colors.bg.input, borderColor, color: colors.text.primary },
          focused && { outlineColor: colors.border.focus, outlineWidth: 1, outlineStyle: 'solid' },
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        <Text variant="caption" tone="muted">
          {help}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1.5] },
  input: { minHeight: layout.minTouch, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space[4] },
  multiline: { minHeight: layout.minTouch * 2, paddingVertical: space[3], textAlignVertical: 'top' },
});
