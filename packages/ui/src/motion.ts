// Motion tokens (DESIGN §8) as Reanimated helpers. Every animation respects "reduzir movimento".
import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motion } from './tokens';

const bezier = (b: readonly number[]) => Easing.bezier(b[0]!, b[1]!, b[2]!, b[3]!);
export const easing = {
  out: Easing.out(Easing.quad),
  pop: bezier(motion.pop.easing),
  expand: bezier(motion.expand.easing),
  shake: bezier(motion.shake.easing),
  inOut: Easing.inOut(Easing.quad),
};

export { useReducedMotion };

/** Scale while pressed: 0.95 small, 0.98 wide (motion.press). */
export function usePressScale(wide = false) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const to = wide ? motion.press.scaleWide : motion.press.scaleSmall;
  return {
    style,
    onPressIn: () => {
      if (!reduced) scale.value = withTiming(to, { duration: motion.press.duration, easing: easing.out });
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: motion.press.duration, easing: easing.out });
    },
  };
}

/** "Pop" in when `active` turns true (medal, badge, chosen emoji); fade only with reduced motion. */
export function usePop(active: boolean) {
  const reduced = useReducedMotion();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withTiming(1, reduced ? { duration: 150 } : { duration: motion.pop.duration, easing: easing.pop });
  }, [active, p, reduced]);
  return useAnimatedStyle(() =>
    reduced ? { opacity: p.value } : { opacity: Math.min(1, p.value * 2), transform: [{ scale: 0.6 + 0.4 * p.value }] },
  );
}

/** List item entrance (motion.fadeUp), staggered by index up to 10 items. */
export function useFadeUp(index = 0) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    const delay = Math.min(index, motion.fadeUp.maxStaggered) * motion.fadeUp.stagger;
    const t = setTimeout(() => {
      p.value = withTiming(1, reduced ? { duration: 150 } : { duration: motion.fadeUp.duration, easing: easing.pop });
    }, delay);
    return () => clearTimeout(t);
  }, [index, p, reduced]);
  return useAnimatedStyle(() => ({
    opacity: p.value,
    transform: reduced ? [] : [{ translateY: (1 - p.value) * motion.fadeUp.distance }],
  }));
}

/** Shake on validation error (motion.shake); nothing with reduced motion (the message and haptic stay). */
export function useShake(trigger: unknown) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!trigger || reduced) return;
    const d = motion.shake.distance;
    const step = motion.shake.duration / 6;
    const t = (v: number) => withTiming(v, { duration: step, easing: easing.shake });
    x.value = withSequence(t(-d), t(d), t(-d / 2), t(d / 2), t(-d / 4), t(0));
  }, [trigger, reduced, x]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

/** Infinite pulse 0→1→0 (pulseNeon / pulseGold); stays at `still` with reduced motion or when off. */
export function usePulse(kind: 'neon' | 'gold', on = true, still = 0.6): SharedValue<number> {
  const reduced = useReducedMotion();
  const v = useSharedValue(still);
  useEffect(() => {
    if (!on || reduced) {
      cancelAnimation(v);
      v.value = still;
      return;
    }
    const duration = (kind === 'neon' ? motion.pulseNeon.duration : motion.pulseGold.duration) / 2;
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: easing.inOut }),
        withTiming(0.35, { duration, easing: easing.inOut }),
      ),
      -1,
    );
    return () => cancelAnimation(v);
  }, [kind, on, reduced, still, v]);
  return v;
}
