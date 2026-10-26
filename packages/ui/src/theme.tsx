// Theme state (DESIGN §3.1, D-025): dark (default) | light | system, saved on the device.
// Web: localStorage, read synchronously (the inline script in index.html already painted the right
// background). Native: AsyncStorage, read once at start; `ready` lets the app keep the splash until then.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { DEFAULT_THEME, themes, type ThemeColors, type ThemeName, type ThemePreference } from './tokens';

import { THEME_STORAGE_KEY } from './boot';

export { THEME_STORAGE_KEY };
const isWeb = Platform.OS === 'web';

type ThemeContextValue = {
  name: ThemeName;
  colors: ThemeColors;
  statusBar: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** False on native until the saved preference is read (keep the splash). Always true on the web. */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isPreference = (v: unknown): v is ThemePreference => v === 'dark' || v === 'light' || v === 'system';

function readWeb(): ThemePreference {
  try {
    const v = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return isPreference(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function write(p: ThemePreference) {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, p);
    } catch {
      // storage blocked: the choice lasts for this session
    }
    return;
  }
  void AsyncStorage.setItem(THEME_STORAGE_KEY, p).catch(() => undefined);
}

export function ThemeProvider({ children, initial }: { children: ReactNode; initial?: ThemePreference }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => initial ?? (isWeb ? readWeb() : DEFAULT_THEME),
  );
  const [ready, setReady] = useState(isWeb || initial !== undefined);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((v) => {
        if (alive && isPreference(v)) setPreferenceState(v);
      })
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);

  const name: ThemeName = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  useEffect(() => {
    if (!isWeb) return;
    const doc = globalThis.document;
    const root = doc?.documentElement;
    if (!root) return;
    root.style.colorScheme = name;
    root.style.backgroundColor = themes[name].bg.canvas;
    root.dataset.theme = name;
    doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[name].bg.canvas);
  }, [name]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    write(p);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      colors: themes[name],
      statusBar: name === 'dark' ? 'light' : 'dark',
      preference,
      setPreference,
      ready,
    }),
    [name, preference, setPreference, ready],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
