import { themes } from '@erre/ui/tokens';
import { expect, test, type Page } from '@playwright/test';

/** Computed CSS color (three channels) as lowercase hex, to compare with a token. */
const hexOf = (computed: string) =>
  `#${(computed.match(/\d+/g) ?? [])
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test('opens in the dark theme by default', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(hexOf(await background(page))).toBe(themes.dark.bg.canvas);
});

test('follows a stored light preference', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('erre:theme', 'light'));
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(hexOf(await background(page))).toBe(themes.light.bg.canvas);
});
