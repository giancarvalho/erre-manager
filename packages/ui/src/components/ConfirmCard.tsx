import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

/**
 * Inline confirmation for destructive actions (DESIGN §10.3): says the consequence, the button repeats
 * the verb ("Remover Ana"). Sprint 10 adds the modal ConfirmDialog; this one stays for inline cases.
 */
export function ConfirmCard({
  message,
  confirmLabel,
  loadingLabel,
  loading = false,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card>
      <View style={styles.body}>
        <Text variant="body" accessibilityLiveRegion="polite">
          {message}
        </Text>
        <View style={styles.actions}>
          <Button
            label={confirmLabel}
            {...(loadingLabel ? { loadingLabel } : {})}
            loading={loading}
            variant="destructive"
            onPress={onConfirm}
          />
          <Button label="Cancelar" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[4] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
});
