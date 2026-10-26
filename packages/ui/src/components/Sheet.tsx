import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

/**
 * Bottom sheet (DESIGN §9.10): raised surface with 16 top radius, scrim, handle, close button and
 * Android back. Structure: overline → title → content → actions (secondary left, primary right).
 * Swipe-to-close arrives when a gesture library is approved.
 */
export function Sheet({
  visible,
  onClose,
  overline,
  title,
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  overline?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Pressable
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.scrim }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg.raised,
              borderColor: colors.border.subtle,
              paddingBottom: space[6] + insets.bottom,
              shadowColor: colors.shadow.color,
              shadowOpacity: colors.shadow.opacity,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
          <View style={styles.header}>
            <View style={styles.flex}>
              {overline ? (
                <Text variant="overline" tone="muted">
                  {overline}
                </Text>
              ) : null}
              <Text variant="titleLg" accessibilityRole="header">
                {title}
              </Text>
            </View>
            <IconButton glyph="✕" label="Fechar" onPress={onClose} />
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: layout.contentMaxWidth + 2 * layout.screenPadding,
    alignSelf: 'center',
    maxHeight: '90%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: layout.screenPadding,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    marginTop: space[2],
    marginBottom: space[2],
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], marginBottom: space[4] },
  flex: { flex: 1, gap: space[1.5], paddingTop: space[2] },
  body: { flexGrow: 0 },
  bodyContent: { gap: space[4] },
  actions: { flexDirection: 'row', gap: space[3], justifyContent: 'flex-end', marginTop: space[6] },
});
