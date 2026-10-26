import type { ReactElement, ReactNode } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, space } from '../tokens';

/**
 * Screen frame for long lists (DESIGN §10.6): same frame as Screen (safe area, 512 max width, padding), but the
 * content is a virtualized FlatList, with `header` above the items and `footer` (e.g. StickyActionBar) fixed
 * below. `numColumns` > 1 lays items in a grid with the card gap (12).
 */
export function ListScreen<T>({
  header,
  data,
  renderItem,
  keyExtractor,
  numColumns = 1,
  empty,
  listFooter,
  footer,
}: {
  header?: ReactElement | undefined;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  numColumns?: number;
  empty?: ReactElement | undefined;
  /** Scrolls with the list, after the last item. */
  listFooter?: ReactElement | undefined;
  /** Fixed below the list (e.g. StickyActionBar). */
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg.canvas }]} edges={['top', 'left', 'right']}>
      <FlatList
        // FlatList can't change numColumns on the fly: a new key remounts it.
        key={`cols-${numColumns}`}
        style={styles.list}
        contentContainerStyle={styles.content}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        {...(numColumns > 1 ? { columnWrapperStyle: styles.row } : {})}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={listFooter}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
      />
      {footer}
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { width: '100%', maxWidth: layout.contentMaxWidth + 2 * layout.screenPadding, alignSelf: 'center' },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: space[4], paddingBottom: space[10] },
  row: { gap: space[3] },
  separator: { height: space[3] },
});
