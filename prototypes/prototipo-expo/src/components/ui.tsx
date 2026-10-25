import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { avatar, minTouch, radius, space, type, type AvatarVariant, type ThemePreference } from '@/theme/tokens';

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.canvas }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function ScreenHeader({ overline, title, description }: { overline?: string; title: string; description?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[1.5], marginBottom: space[6] }}>
      {overline ? <Text style={[type.overline, { color: colors.text.muted }]}>{overline}</Text> : null}
      <Text accessibilityRole="header" style={[type.titleLg, { color: colors.text.primary }]}>
        {title}
      </Text>
      {description ? <Text style={[type.bodyLg, { color: colors.text.muted }]}>{description}</Text> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';
export function Button({ label, onPress, variant = 'secondary', disabled, fullWidth }: { label: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; fullWidth?: boolean }) {
  const { colors } = useTheme();
  const look: Record<ButtonVariant, { bg: string; fg: string; border: string; weight: '500' | '600' }> = {
    primary: { bg: colors.primary.bg, fg: colors.primary.text, border: 'transparent', weight: '600' },
    accent: { bg: colors.accent.solid, fg: colors.accent.onSolid, border: 'transparent', weight: '600' },
    secondary: { bg: 'transparent', fg: colors.text.primary, border: colors.border.default, weight: '500' },
    ghost: { bg: 'transparent', fg: colors.text.muted, border: 'transparent', weight: '500' },
  };
  const l = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: l.bg, borderColor: l.border, opacity: disabled ? 0.4 : 1 },
        fullWidth && { alignSelf: 'stretch' },
        pressed && !disabled && { transform: [{ scale: fullWidth ? 0.98 : 0.95 }] },
      ]}
    >
      <Text style={[type.label, { color: l.fg, fontWeight: l.weight }]}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ name, variant, size = 64 }: { name: string; variant: AvatarVariant; size?: number }) {
  const v = avatar[variant];
  return (
    <View accessible={false} style={{ width: size, height: size, borderRadius: radius.full, backgroundColor: v.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: v.text, fontWeight: '600', fontSize: Math.max(16, size * 0.38) }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function EmojiButton({ emoji, label, selected, onPress }: { emoji: string; label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.emoji,
        {
          backgroundColor: selected ? colors.bg.controlSelected : colors.bg.control,
          borderColor: selected ? colors.accent.ring : 'transparent',
        },
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </Pressable>
  );
}

/** Ring that pulses when `active`: meaning "your vote is here" (DESIGN §7). Opacity-only, so it behaves the same on Android, iOS and web. */
function PulseRing({ active, color, style }: { active: boolean; color: string; style?: ViewStyle }) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active) {
      opacity.value = withTiming(0, { duration: 150 });
      return;
    }
    if (reduce) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.ease) })),
      -1,
    );
  }, [active, reduce, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: color, borderRadius: radius.lg }, style, animated]} />;
}

export type EmojiOption = { id: string; char: string; label: string };
export function VoteCard({ name, variant, emojis, selected, onSelect }: { name: string; variant: AvatarVariant; emojis: EmojiOption[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.voteCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
      <PulseRing active={selected !== null} color={colors.accent.ring} />
      <Avatar name={name} variant={variant} />
      <Text style={[type.label, { color: colors.text.primary }]}>{name}</Text>
      <View accessibilityLabel={`Votar em ${name}`} style={styles.emojiGrid}>
        {emojis.map((e) => (
          <EmojiButton key={e.id} emoji={e.char} label={e.label} selected={selected === e.id} onPress={() => onSelect(selected === e.id ? null : e.id)} />
        ))}
      </View>
    </View>
  );
}

export function SegmentedControl<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { borderColor: colors.border.default }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)} style={[styles.segment, on && { backgroundColor: colors.bg.controlSelected }]}>
            <Text style={[type.label, { color: on ? colors.text.primary : colors.text.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StickyActionBar({ label, hint, disabled, onPress }: { label: string; hint?: string; disabled?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg.overlay, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
      <View style={[styles.column, { padding: space[4], gap: space[2] }]}>
        <Button label={label} variant="primary" fullWidth disabled={disabled} onPress={onPress} />
        {hint ? <Text style={[type.caption, { color: colors.text.muted, textAlign: 'center' }]}>{hint}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

export function TrophyMedallion({ emoji, tone = 'gold' }: { emoji: string; tone?: 'gold' | 'silver' }) {
  const { colors } = useTheme();
  const ring = tone === 'gold' ? colors.trophy.gold : colors.trophy.silver;
  return (
    <View accessibilityLabel="Troféu" style={{ width: 40, height: 40, borderRadius: radius.full, borderWidth: 2, borderColor: ring, backgroundColor: colors.trophy.goldSubtle, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <View style={{ position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: radius.full, backgroundColor: ring, borderWidth: 2, borderColor: colors.bg.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 9 }}>🏆</Text>
      </View>
    </View>
  );
}

export function RankingRow({ position, name, variant, chips, total, podium, trophy }: { position: number; name: string; variant: AvatarVariant; chips: string[]; total: number; podium?: 'gold' | 'silver'; trophy?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.rankRow,
        { backgroundColor: trophy ? colors.trophy.goldSubtle : colors.bg.surface, borderColor: podium === 'gold' ? colors.trophy.gold : podium === 'silver' ? colors.trophy.silver : colors.border.subtle },
      ]}
    >
      <Text style={[type.label, { color: colors.text.muted, width: 24, textAlign: 'center' }]}>{position}</Text>
      <Avatar name={name} variant={variant} size={40} />
      <View style={{ flex: 1, gap: space[1] }}>
        <Text numberOfLines={1} style={[type.label, { color: colors.text.primary }]}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
          {chips.map((c) => (
            <Text key={c} style={[type.caption, styles.chip, { backgroundColor: colors.bg.control, color: colors.text.secondary }]}>
              {c}
            </Text>
          ))}
        </View>
      </View>
      {trophy ? <TrophyMedallion emoji={trophy} /> : null}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[type.titleMd, { color: colors.text.primary }]}>{total}</Text>
        <Text style={[type.overline, { color: colors.text.muted }]}>Total</Text>
      </View>
    </View>
  );
}

export function ThemeSwitcher() {
  const { colors, preference, setPreference } = useTheme();
  const options: { value: ThemePreference; label: string; hint?: string }[] = [
    { value: 'dark', label: 'Escuro', hint: 'Padrão' },
    { value: 'light', label: 'Claro' },
    { value: 'system', label: 'Igual ao sistema' },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Aparência" style={[styles.list, { borderColor: colors.border.subtle, backgroundColor: colors.bg.surface }]}>
      {options.map((o, i) => {
        const on = preference === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => setPreference(o.value)}
            style={[styles.listRow, i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}
          >
            <Text style={[type.label, { color: colors.text.primary, flex: 1 }]}>
              {o.label}
              {o.hint ? <Text style={[type.caption, { color: colors.text.muted }]}>{`  ${o.hint}`}</Text> : null}
            </Text>
            {on ? <Text style={[type.label, { color: colors.accent.text }]}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[10] },
  column: { width: '100%', maxWidth: 512, alignSelf: 'center' },
  button: { minHeight: minTouch, paddingHorizontal: space[5], borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  emoji: { width: minTouch, height: minTouch, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  voteCard: { flex: 1, minWidth: 160, alignItems: 'center', gap: space[3], paddingVertical: space[4], paddingHorizontal: space[3], borderRadius: radius.lg, borderWidth: 1 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], width: minTouch * 3 + space[2] * 2 },
  segmented: { flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: radius.lg, borderWidth: 1, alignSelf: 'flex-start' },
  segment: { minHeight: 36, paddingHorizontal: space[3], borderRadius: radius.md, justifyContent: 'center' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, borderWidth: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space[4] },
});
