import { expect, test } from '@playwright/test';

import { fakeGoogle } from './helpers';

test('the service worker is registered and the notifications screen explains when push is off', async ({ page }) => {
  const id = Date.now().toString(36);
  await fakeGoogle(page, { sub: `e2e-n-${id}`, email: `e2e-n-${id}@example.com`, name: 'Notifica' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect
    .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.active))
    .toBe(true);
  const sw = await page.request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain('notificationclick');

  await page.getByRole('button', { name: 'Notificações' }).click();
  await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
  await expect(page.getByText('As notificações estão desligadas no momento.')).toBeVisible();
  await expect(page.getByText('Nenhum tipo de notificação por enquanto.')).toBeVisible();
});
