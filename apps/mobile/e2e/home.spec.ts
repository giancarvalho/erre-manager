import { expect, test } from '@playwright/test';

test('home opens in the dark theme by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Em construção' })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe('rgb(9, 9, 11)');
});

test('home follows a stored light preference', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('erre:theme', 'light'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Em construção' })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe('rgb(250, 250, 250)');
});
