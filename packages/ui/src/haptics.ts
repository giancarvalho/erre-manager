// Haptics (DESIGN §8). expo-haptics on native; on the web a short navigator.vibrate where the browser has it
// (Android Chrome), nothing elsewhere.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';

function vibrate(ms: number) {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as { vibrate?: (ms: number) => boolean });
  try {
    nav?.vibrate?.(ms);
  } catch {
    // Some browsers throw without a user gesture; vibration is only a nicety.
  }
}

const safe = (fn: () => Promise<void>, webMs: number) => {
  if (native) void fn().catch(() => undefined);
  else vibrate(webMs);
};

export const haptic = {
  /** Choosing or changing an emoji. */
  selection: () => safe(() => Haptics.selectionAsync(), 8),
  /** Votes sent, trophy won. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 20),
  /** Validation error (with the shake). */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 30),
  /** Destructive action confirmed. */
  impact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 15),
};
