import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Small per-device preferences, read synchronously by the app. Web: localStorage (may be blocked:
// ignore). Native: AsyncStorage, loaded into memory once at start (hydratePrefs) and written through.
const memory = new Map<string, string>();
const isWeb = Platform.OS === 'web';

export const PREF_KEYS = ['erre:community', 'erre:push-token'] as const;

export async function hydratePrefs(): Promise<void> {
  if (isWeb) return;
  try {
    for (const [k, v] of await AsyncStorage.multiGet([...PREF_KEYS])) if (v !== null) memory.set(k, v);
  } catch {
    // storage unavailable: start empty
  }
}

export function readPref(key: string): string | null {
  if (!isWeb) return memory.get(key) ?? null;
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null): void {
  if (!isWeb) {
    if (value === null) {
      memory.delete(key);
      void AsyncStorage.removeItem(key).catch(() => undefined);
    } else {
      memory.set(key, value);
      void AsyncStorage.setItem(key, value).catch(() => undefined);
    }
    return;
  }
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // storage blocked: the choice lasts for this session only
  }
}
