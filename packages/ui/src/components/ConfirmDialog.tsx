import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Centered confirmation for short destructive decisions (DESIGN §9.10, §10.3). The message says the
 * consequence; the confirm button repeats the verb ("Remover Ana").
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  loadingLabel,
  loading = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.fill}>
        <Pressable
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.scrim }]}
          onPress={onCancel}
        />
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bg.raised,
              borderColor: colors.border.subtle,
              shadowColor: colors.shadow.color,
              shadowOpacity: colors.shadow.opacity,
            },
          ]}
        >
          <Text variant="titleMd" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" tone="secondary">
            {message}
          </Text>
          <View style={styles.actions}>
            <Button label="Cancelar" variant="secondary" onPress={onCancel} />
            <Button
              label={confirmLabel}
              {...(loadingLabel ? { loadingLabel } : {})}
              loading={loading}
              variant="destructive"
              onPress={() => {
                haptic.impact();
                onConfirm();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.screenPadding },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space[6],
    gap: space[3],
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[3], marginTop: space[3] },
});
