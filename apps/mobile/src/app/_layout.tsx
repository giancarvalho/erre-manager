// One import per weight: the package root would bundle all 18 Geist files.
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { ThemeProvider, ToastProvider, useTheme } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { registerServiceWorker, useNotificationRouting } from '@/lib/push';
import { hydratePrefs } from '@/lib/storage';

// The splash stays until the theme, the fonts and the saved preferences are ready (DESIGN §3.1).
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStack() {
  const { colors, statusBar, ready: themeReady } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
  });
  const [prefsReady, setPrefsReady] = useState(false);
  const ready = themeReady && (fontsLoaded || !!fontError) && prefsReady;
  useNotificationRouting();
  useEffect(registerServiceWorker, []);
  useEffect(() => {
    void hydratePrefs().finally(() => setPrefsReady(true));
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(colors.bg.canvas).catch(() => undefined);
  }, [colors.bg.canvas]);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;
  return (
    <>
      <StatusBar style={statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.canvas } }} />
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <ThemedStack />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
