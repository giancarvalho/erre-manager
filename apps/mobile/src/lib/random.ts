import { getRandomValues } from 'expo-crypto';
import { Platform } from 'react-native';

// Hermes has no crypto.getRandomValues. The anonymous vote client (@erre/anon-vote/client, D-011) needs a secure
// source: on native it comes from expo-crypto; browsers already have one.
export function installSecureRandom(): void {
  if (Platform.OS === 'web') return;
  const g = globalThis as { crypto?: { getRandomValues?: unknown } };
  if (typeof g.crypto?.getRandomValues === 'function') return;
  g.crypto = { ...(g.crypto ?? {}), getRandomValues };
}
