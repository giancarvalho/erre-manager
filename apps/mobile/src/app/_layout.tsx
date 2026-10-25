import { ThemeProvider, useTheme } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function ThemedStack() {
  const { colors, statusBar } = useTheme();
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
          <ThemedStack />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
