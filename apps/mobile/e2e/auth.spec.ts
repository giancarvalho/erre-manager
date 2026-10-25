import { expect, test } from '@playwright/test';

import { fakeGoogle } from './helpers';

test('sign in with Google, confirm the name, stay signed in and sign out', async ({ page }) => {
  const id = Date.now();
  await fakeGoogle(page, { sub: `e2e-${id}`, email: `e2e-${id}@example.com`, name: 'Pessoa do Teste' });

  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByRole('button', { name: 'Continuar com Google' }).click();

  // First sign-in: confirm the name taken from Google.
  await expect(page.getByRole('heading', { name: 'Como você quer aparecer pra comunidade?' })).toBeVisible();
  const field = page.getByLabel('Seu nome');
  await expect(field).toHaveValue('Pessoa do Teste');
  await field.fill('a');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Mínimo 2 caracteres.')).toBeVisible();
  await field.fill('Pessoa');
  await page.getByRole('button', { name: 'Continuar' }).click();
  const empty = page.getByRole('heading', { name: 'Você ainda não está em nenhuma comunidade' });
  await expect(empty).toBeVisible();
  await expect(page.getByText('Pessoa', { exact: true })).toBeVisible();

  // The session survives a reload.
  await page.reload();
  await expect(empty).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar/);
});

test('a returning person skips onboarding', async ({ page }) => {
  const id = Date.now();
  const profile = { sub: `e2e-r-${id}`, email: `e2e-r-${id}@example.com`, name: 'Volta' };
  await fakeGoogle(page, profile);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Volta', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();

  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await expect(page.getByText('Volta', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como você quer aparecer pra comunidade?' })).toHaveCount(0);
});
