import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Prototype: points at the auth spike (prototypes/auth-spike). Google sign-in needs real
// OAuth client ids and a device or browser; see docs/migration/relatorios/sprint-02.md.
export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  plugins: Platform.OS === 'web' ? [] : [expoClient({ scheme: 'erreprototipo', storage: SecureStore })],
});
