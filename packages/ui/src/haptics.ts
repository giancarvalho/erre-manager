// Haptics (DESIGN §8). Native only; nothing on the web.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';
const safe = (fn: () => Promise<void>) => {
  if (native) void fn().catch(() => undefined);
};

export const haptic = {
  /** Choosing or changing an emoji. */
  selection: () => safe(() => Haptics.selectionAsync()),
  /** Votes sent, trophy won. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Validation error (with the shake). */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Destructive action confirmed. */
  impact: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
