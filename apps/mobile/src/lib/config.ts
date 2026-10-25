/** API base URL, set at build time (`EXPO_PUBLIC_API_URL`). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Deep link scheme of the native app (app.json). */
export const APP_SCHEME = 'erre';
