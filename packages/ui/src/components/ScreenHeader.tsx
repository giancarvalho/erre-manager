import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Text } from './Text';

/** overline → title → description (DESIGN §4, "padrão de cabeçalho de tela"). */
export function ScreenHeader({
  overline,
  title,
  description,
}: {
  overline?: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.header}>
      {overline ? (
        <Text variant="overline" tone="muted">
          {overline}
        </Text>
      ) : null}
      <Text variant="titleLg" accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodyLg" tone="muted">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ header: { gap: space[1.5], marginBottom: space[6] } });
