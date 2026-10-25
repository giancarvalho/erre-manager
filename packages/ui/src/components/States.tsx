import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

/** Short, unpredictable wait (e.g. checking the session). Longer loads use skeletons (DESIGN §9.15). */
export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg.canvas }]} accessibilityLabel={label} accessible>
      <ActivityIndicator color={colors.text.muted} />
    </View>
  );
}

/** What happened in plain words + "Tentar de novo" (DESIGN §9.15). */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
      <Text variant="bodyLg" tone="muted" style={styles.message} accessibilityLiveRegion="polite">
        {message}
      </Text>
      {onRetry ? <Button label="Tentar de novo" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], padding: space[6] },
  message: { textAlign: 'center' },
});
