// Theme state: dark (default) | light | system (D-025). Sprint 10 adds native persistence and the pre-paint web script.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { themes, type ThemeColors, type ThemeName, type ThemePreference } from './tokens';

const STORAGE_KEY = 'erre:theme';

type ThemeContextValue = {
  name: ThemeName;
  colors: ThemeColors;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Persistence: localStorage on web, memory on native until Sprint 10 adds AsyncStorage.
function readStored(): ThemePreference {
  if (Platform.OS !== 'web') return 'dark';
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return v === 'light' || v === 'system' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

function writeStored(p: ThemePreference) {
  if (Platform.OS !== 'web') return;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, p);
  } catch {
    // storage blocked: preference lasts for this session only
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const name: ThemeName = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = globalThis.document?.documentElement;
    if (root) {
      root.style.colorScheme = name;
      root.style.backgroundColor = themes[name].bg.canvas;
    }
    globalThis.document?.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[name].bg.canvas);
  }, [name]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      colors: themes[name],
      preference,
      setPreference: (p) => {
        setPreferenceState(p);
        writeStored(p);
      },
    }),
    [name, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
