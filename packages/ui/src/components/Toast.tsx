import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../motion';
import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type ToastInput = { title: string; description?: string; tone?: 'info' | 'error' };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ show: (t: ToastInput) => void } | null>(null);

/**
 * Toasts at the top (DESIGN §9.11): disappear after 4 s; errors stay until closed. A toast is never the
 * only place an important error appears.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const close = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback((t: ToastInput) => {
    seq.current += 1;
    setItems((all) => [...all.slice(-2), { ...t, id: seq.current }]);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack items={items} onClose={close} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function ToastStack({ items, onClose }: { items: ToastItem[]; onClose: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + space[2] }]}>
      {items.map((t) => (
        <ToastView key={t.id} item={t} onClose={() => onClose(t.id)} />
      ))}
    </View>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (item.tone === 'error') return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [item.tone, onClose]);
  return (
    <Animated.View
      {...(reduced ? {} : { entering: FadeInUp.duration(200), exiting: FadeOutUp.duration(150) })}
      accessibilityLiveRegion={item.tone === 'error' ? 'assertive' : 'polite'}
      accessibilityRole={item.tone === 'error' ? 'alert' : 'text'}
      style={[
        styles.toast,
        {
          backgroundColor: colors.bg.raised,
          borderColor: item.tone === 'error' ? colors.danger.border : colors.border.subtle,
          shadowColor: colors.shadow.color,
          shadowOpacity: colors.shadow.opacity,
        },
      ]}
    >
      <View style={styles.text}>
        <Text variant="label" tone={item.tone === 'error' ? 'danger' : 'primary'}>
          {item.title}
        </Text>
        {item.description ? (
          <Text variant="caption" tone="muted">
            {item.description}
          </Text>
        ) : null}
      </View>
      <IconButton glyph="✕" label="Fechar aviso" onPress={onClose} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: layout.screenPadding,
    right: layout.screenPadding,
    alignItems: 'center',
    gap: space[2],
  },
  toast: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingLeft: space[4],
    paddingVertical: space[1],
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  text: { flex: 1, gap: space[0.5], paddingVertical: space[2] },
});
