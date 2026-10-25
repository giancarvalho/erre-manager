import { expect, test } from '@playwright/test';

import { fakeGoogle } from './helpers';

test('create communities, keep the choice after reload and switch', async ({ page }) => {
  const id = Date.now().toString(36);
  await fakeGoogle(page, { sub: `e2e-c-${id}`, email: `e2e-c-${id}@example.com`, name: 'Criadora' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  const field = page.getByLabel('Nome da comunidade');
  await field.fill('Com Espaço');
  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(page.getByText(/letras minúsculas, números e hífens/).first()).toBeVisible();
  await field.fill(`alfa-${id}`);
  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(page.getByRole('heading', { name: `alfa-${id}` })).toBeVisible();
  await expect(page.getByText('Seu papel: dono')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trocar de comunidade' })).toHaveCount(0);

  // Second community becomes the current one; the switcher appears.
  await page.getByRole('button', { name: 'Criar outra comunidade' }).click();
  await page.getByLabel('Nome da comunidade').fill(`beta-${id}`);
  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(page.getByRole('heading', { name: `beta-${id}` })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: `beta-${id}` })).toBeVisible();

  await page.getByRole('button', { name: 'Trocar de comunidade' }).click();
  await page.getByRole('radio', { name: `alfa-${id}, seu papel: dono` }).click();
  await expect(page.getByRole('heading', { name: `alfa-${id}` })).toBeVisible();
});

test('the name of an existing community is refused', async ({ page }) => {
  const id = Date.now().toString(36);
  const name = `dup-${id}`;
  for (const who of ['a', 'b']) {
    await page.context().clearCookies();
    await fakeGoogle(page, {
      sub: `e2e-d-${who}-${id}`,
      email: `e2e-d-${who}-${id}@example.com`,
      name: `Pessoa ${who}`,
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Continuar com Google' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Criar comunidade' }).click();
    await page.getByLabel('Nome da comunidade').fill(name);
    await page.getByRole('button', { name: 'Criar comunidade' }).click();
  }
  await expect(page.getByText('Esse nome já existe. Tente outro.')).toBeVisible();
});
