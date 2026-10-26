// Minimal Reanimated for Jest: animations resolve to their final value immediately. Covers only the API
// used by @erre/ui (motion.ts and components); extend it when the UI starts using more.
import { View } from 'react-native';

const identity = <T,>(v: T) => v;
const easingFn = () => (t: number) => t;
const layoutAnim = { duration: () => layoutAnim, delay: () => layoutAnim };

export const Easing = {
  bezier: easingFn,
  out: easingFn,
  in: easingFn,
  inOut: easingFn,
  quad: (t: number) => t,
  linear: (t: number) => t,
};
export const useSharedValue = <T,>(initial: T) => ({ value: initial });
export const useAnimatedStyle = <T,>(fn: () => T) => fn();
export const withTiming = identity;
export const withRepeat = identity;
export const withSequence = (...values: unknown[]) => values[values.length - 1];
export const cancelAnimation = () => undefined;
export const useReducedMotion = () => false;
export const FadeInUp = layoutAnim;
export const FadeOutUp = layoutAnim;
export const createAnimatedComponent = identity;

const Animated = { View, createAnimatedComponent };
export default Animated;
