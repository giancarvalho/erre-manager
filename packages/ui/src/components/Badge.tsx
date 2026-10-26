import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePop } from '../motion';
import { useTheme } from '../theme';
import { radius, space, type ThemeColors } from '../tokens';
import { Text } from './Text';

export type BadgeTone = 'accent' | 'neutral' | 'warning' | 'danger';

function look(c: ThemeColors, tone: BadgeTone) {
  switch (tone) {
    case 'accent':
      return { bg: c.accent.subtle, fg: c.accent.text };
    case 'warning':
      return { bg: c.warning.subtle, fg: c.warning.text };
    case 'danger':
      return { bg: c.danger.subtle, fg: c.danger.text };
    case 'neutral':
      return { bg: c.bg.control, fg: c.text.secondary };
  }
}

/** Pill with an overline label (DESIGN §9.6). `pop` animates it in. */
export function Badge({ label, tone = 'neutral', pop = false }: { label: string; tone?: BadgeTone; pop?: boolean }) {
  const { colors } = useTheme();
  const l = look(colors, tone);
  const popStyle = usePop(pop);
  return (
    <Animated.View style={[styles.badge, { backgroundColor: l.bg }, popStyle]}>
      <View>
        <Text variant="overline" maxFontSizeMultiplier={1.4} style={{ color: l.fg, letterSpacing: 0 }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingVertical: space[1], paddingHorizontal: 10 },
});
