import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, space } from '../tokens';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';

/**
 * Footer bar with the primary action (DESIGN §9.9): bg.overlay with blur (solid on Android, where blur is
 * expensive), top border, safe area, and a caption with the state below the button.
 */
export function StickyActionBar({ hint, ...button }: Omit<ButtonProps, 'variant' | 'fullWidth'> & { hint?: string }) {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.inner, { paddingBottom: space[4] + insets.bottom }]}>
      <View style={styles.column}>
        <Button {...button} variant="primary" fullWidth />
        {hint ? (
          <Text variant="caption" tone="muted" style={styles.hint} accessibilityLiveRegion="polite">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
  const frame = [styles.bar, { borderTopColor: colors.border.subtle }];
  if (Platform.OS === 'android')
    return <View style={[...frame, { backgroundColor: colors.bg.overlay }]}>{content}</View>;
  return (
    <BlurView intensity={20} tint={name} style={[...frame, { backgroundColor: colors.bg.overlay }]}>
      {content}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1 },
  inner: { paddingTop: space[4], paddingHorizontal: layout.screenPadding },
  column: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', gap: space[2] },
  hint: { textAlign: 'center' },
});
