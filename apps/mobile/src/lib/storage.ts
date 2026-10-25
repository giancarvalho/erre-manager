import { Platform } from 'react-native';

// Small per-device preferences. Web: localStorage (may be blocked: ignore). Native: memory until the
// persistent storage library arrives with Sprint 10.
const memory = new Map<string, string>();

export function readPref(key: string): string | null {
  if (Platform.OS !== 'web') return memory.get(key) ?? null;
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null): void {
  if (Platform.OS !== 'web') {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    return;
  }
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // storage blocked: the choice lasts for this session only
  }
}
