import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Restricted use (DESIGN §9.13): content that depends on an action of the person. Blurred content
 * behind (hidden from accessibility), a raised card with title, one line and the accent action.
 */
export function ReservedContent({
  children,
  title,
  description,
  actionLabel,
  onAction,
}: {
  children: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const { colors, name } = useTheme();
  return (
    <View style={styles.wrap}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.behind}>
        {children}
      </View>
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg.overlay }]} />
      ) : (
        <BlurView intensity={20} tint={name} style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.center}>
        <View style={[styles.card, { backgroundColor: colors.bg.raised, borderColor: colors.border.subtle }]}>
          <Text variant="titleMd" accessibilityRole="header">
            {title}
          </Text>
          <Text tone="muted">{description}</Text>
          <Button label={actionLabel} variant="accent" fullWidth onPress={onAction} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tall enough for the card even when the content behind is short.
  wrap: { position: 'relative', borderRadius: radius.lg, overflow: 'hidden', minHeight: 300 },
  behind: { opacity: 0.5 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
  card: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: radius.lg, padding: space[6], gap: space[3] },
});
