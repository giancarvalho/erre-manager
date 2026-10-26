import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

/** Empty state (DESIGN §9.15): big emoji, one sentence of what this is, one action out of the empty. */
export function EmptyState({
  emoji,
  message,
  actionLabel,
  onAction,
}: {
  emoji: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.box}>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.emoji} maxFontSizeMultiplier={1}>
        {emoji}
      </Text>
      <Text variant="bodyLg" tone="muted" style={styles.center}>
        {message}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: space[3], paddingVertical: space[8] },
  emoji: { fontSize: 40, lineHeight: 48 },
  center: { textAlign: 'center' },
});
