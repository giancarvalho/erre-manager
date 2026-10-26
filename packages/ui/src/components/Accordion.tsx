import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { easing, useReducedMotion } from '../motion';
import { useTheme } from '../theme';
import { layout, motion, radius, space } from '../tokens';
import { Text } from './Text';

/** Row with icon, title and a rotating chevron; content opens with motion.expand (DESIGN §9.8). */
export function Accordion({
  title,
  icon,
  children,
  initiallyOpen = false,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const reduced = useReducedMotion();
  const p = useSharedValue(initiallyOpen ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, { duration: reduced ? 0 : motion.expand.duration, easing: easing.expand });
  }, [open, p, reduced]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 180}deg` }] }));
  const body = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={[styles.box, { borderColor: colors.border.subtle, backgroundColor: colors.bg.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.row}
      >
        {icon ? <Text variant="bodyLg">{icon}</Text> : null}
        <Text variant="label" style={styles.flex}>
          {title}
        </Text>
        <Animated.View style={chevron}>
          <Text tone="muted">⌄</Text>
        </Animated.View>
      </Pressable>
      {open ? <Animated.View style={[styles.content, body]}>{children}</Animated.View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
  },
  flex: { flex: 1 },
  content: { paddingHorizontal: space[4], paddingBottom: space[4] },
});
