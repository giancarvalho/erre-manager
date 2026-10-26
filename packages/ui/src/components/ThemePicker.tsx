import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { space, type ThemePreference } from '../tokens';
import { Card } from './Card';
import { Text } from './Text';

const OPTIONS: { value: ThemePreference; label: string; hint?: string }[] = [
  { value: 'dark', label: 'Escuro', hint: 'Padrão' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Igual ao sistema', hint: 'Muda junto com o celular ou o navegador' },
];

/** Appearance choice (DESIGN §3.1): saved on the device, applied immediately. */
export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Aparência" style={styles.list}>
      {OPTIONS.map((o) => (
        <Card
          key={o.value}
          selected={preference === o.value}
          accessibilityLabel={o.label}
          onPress={() => setPreference(o.value)}
        >
          <Text variant="label">{o.label}</Text>
          {o.hint ? (
            <Text variant="caption" tone="muted">
              {o.hint}
            </Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: space[3] } });
