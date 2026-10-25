import type { Page } from '@playwright/test';

const API = 'http://localhost:3000';

/** Stands in for Google: sends the browser straight back to the API callback with a code carrying the profile. */
export async function fakeGoogle(page: Page, profile: { sub: string; email: string; name: string }) {
  await page.route('https://accounts.google.com/**', async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state') ?? '';
    const b64url = btoa(JSON.stringify(profile)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const code = `e2e.${b64url}`;
    await route.fulfill({
      status: 302,
      headers: { location: `${API}/v1/auth/callback/google?code=${code}&state=${encodeURIComponent(state)}` },
    });
  });
}
