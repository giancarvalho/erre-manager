import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, space } from '../tokens';

/** Screen frame: safe area, scroll, 512 max width centered (DESIGN §5). */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg.canvas }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: space[4], paddingBottom: space[10] },
  column: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
});
