import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space, type ThemeColors } from '../tokens';
import { Text } from './Text';

export type BannerTone = 'info' | 'warning' | 'error' | 'highlight' | 'event';

// DESIGN §7: highlight gradient goes from accent.subtle to a faint violet.
const HIGHLIGHT_END = 'rgba(139,92,246,0.05)';

function look(c: ThemeColors, tone: BannerTone, rgb?: string) {
  switch (tone) {
    case 'warning':
      return { bg: c.warning.subtle, border: c.warning.border, title: c.warning.text };
    case 'error':
      return { bg: c.danger.subtle, border: c.danger.border, title: c.danger.text };
    case 'highlight':
      return { bg: c.accent.subtle, border: c.accent.border, title: c.text.primary };
    case 'event':
      // Event color only tints background and border; text keeps the text tokens (DESIGN §3.4).
      return {
        bg: rgb ? `rgba(${rgb},0.12)` : c.accent.subtle,
        border: rgb ? `rgba(${rgb},0.35)` : c.accent.border,
        title: c.text.primary,
      };
    case 'info':
      return { bg: c.bg.surface, border: c.border.subtle, title: c.text.primary };
  }
}

/** Banner (DESIGN §9.12). `eventRgb` like "34 211 238" or "34,211,238" for the event tone. */
export function Banner({
  tone = 'info',
  title,
  description,
  icon,
  action,
  eventRgb,
}: {
  tone?: BannerTone;
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
  eventRgb?: string;
}) {
  const { colors } = useTheme();
  const rgb = eventRgb
    ?.trim()
    .split(/[\s,]+/)
    .join(',');
  const l = look(colors, tone, rgb);
  const iconBox = tone === 'highlight' || tone === 'event';
  const body = (
    <View style={styles.row}>
      {icon ? (
        <View
          style={[
            iconBox ? styles.iconBox : null,
            iconBox && { backgroundColor: tone === 'event' && rgb ? `rgba(${rgb},0.15)` : colors.accent.subtle },
          ]}
        >
          <Text variant="titleMd" maxFontSizeMultiplier={1.4}>
            {icon}
          </Text>
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="label" style={{ color: l.title }}>
          {title}
        </Text>
        {description ? (
          <Text variant="caption" tone={tone === 'warning' ? 'warning' : tone === 'error' ? 'danger' : 'muted'}>
            {description}
          </Text>
        ) : null}
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
  const role = tone === 'error' ? 'alert' : undefined;
  if (tone === 'highlight') {
    return (
      <LinearGradient
        colors={[colors.accent.subtle, HIGHLIGHT_END]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.box, { borderColor: l.border }]}
      >
        {body}
      </LinearGradient>
    );
  }
  return (
    <View accessibilityRole={role} style={[styles.box, { backgroundColor: l.bg, borderColor: l.border }]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: space[4] },
  row: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  iconBox: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space[1] },
  action: { marginTop: space[2] },
});
