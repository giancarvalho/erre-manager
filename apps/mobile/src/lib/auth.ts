import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_URL, APP_SCHEME } from './config';

const isWeb = Platform.OS === 'web';

// Web: the session lives in an httpOnly cookie. Native: the Expo plugin keeps it in the secure store and
// sends it as a cookie header.
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/v1/auth',
  fetchOptions: { credentials: 'include' },
  plugins: isWeb ? [] : [expoClient({ scheme: APP_SCHEME, storagePrefix: 'erre', storage: SecureStore })],
});

/** Cookie header for calls to our own API on native; undefined on web (the browser sends the cookie). */
export async function sessionCookie(): Promise<string | undefined> {
  if (isWeb) return undefined;
  const client = authClient as unknown as { getCookie?: () => Promise<string> | string };
  const cookie = await client.getCookie?.();
  return cookie || undefined;
}

/** Starts Google sign-in. `next` is an internal app path to return to after login. */
export async function signInWithGoogle(next: string): Promise<{ error: boolean }> {
  const origin = isWeb ? globalThis.location.origin : '';
  const res = await authClient.signIn.social({
    provider: 'google',
    callbackURL: `${origin}${next}`,
    errorCallbackURL: `${origin}/entrar?erro=1`,
  });
  return { error: !!res.error };
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
}
