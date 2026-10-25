import { expect, test, type Page } from '@playwright/test';

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test('opens in the dark theme by default', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(await background(page)).toBe('rgb(9, 9, 11)');
});

test('follows a stored light preference', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('erre:theme', 'light'));
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(await background(page)).toBe('rgb(250, 250, 250)');
});
