import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

/**
 * A code the person may copy and share (vote code, invite code): mono text that can also be selected by hand,
 * and a "Copiar" button that confirms with "Copiado!" (DESIGN §4 mono, §10.1).
 */
export function CopyableCode({ code, copyLabel = 'Copiar código' }: { code: string; copyLabel?: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { backgroundColor: colors.bg.input, borderColor: colors.border.default }]}>
        <Text variant="mono" tone="secondary" selectable>
          {code}
        </Text>
      </View>
      <Button
        variant="secondary"
        label={copied ? 'Copiado!' : copyLabel}
        onPress={() => {
          void Clipboard.setStringAsync(code).then(() => {
            haptic.success();
            setCopied(true);
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  box: { borderWidth: 1, borderRadius: radius.md, paddingVertical: space[2], paddingHorizontal: space[3] },
});
