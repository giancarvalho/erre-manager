/** API base URL, set at build time (`EXPO_PUBLIC_API_URL`). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Deep link scheme of the native app (app.json). */
export const APP_SCHEME = 'erre';

/** Public web address of the app, used in invite links. */
export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL ??
  (typeof globalThis.location !== 'undefined' ? globalThis.location.origin : 'http://localhost:8081')
).replace(/\/$/, '');
