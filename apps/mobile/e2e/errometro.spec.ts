import { expect, test } from '@playwright/test';

import { fakeGoogle } from './helpers';

// Sprint 12 registers the Errômetro: its hub entry opens the module's (placeholder) screen.
test('the Errômetro shows up on the hub and opens its screen', async ({ page }) => {
  const id = Date.now().toString(36);
  await fakeGoogle(page, { sub: `e2e-e-${id}`, email: `e2e-e-${id}@example.com`, name: 'Errante' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  await page.getByLabel('Nome da comunidade').fill(`erro-${id}`);
  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(page.getByRole('heading', { name: `erro-${id}` })).toBeVisible();

  await page.getByRole('button', { name: 'Errômetro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Errômetro' })).toBeVisible();
  await expect(page.getByText('A votação do Errômetro chega aqui em breve.')).toBeVisible();
});
