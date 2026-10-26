/// <reference types="node" />
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// Needs a build with EXPO_PUBLIC_DEV_GALLERY=1 (CI sets it; production builds don't).
const shots = path.resolve(__dirname, '../../../docs/migration/relatorios/sprint-10');

for (const theme of ['dark', 'light'] as const) {
  test(`gallery renders in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('erre:theme', t), theme);
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { name: 'Galeria de componentes' })).toBeVisible();
    for (const text of ['Criar comunidade', 'Rodada liberada', 'Resultados reservados', 'Nenhum evento ainda.']) {
      await expect(page.getByText(text).first()).toBeVisible();
    }
    if (process.env.GALLERY_SHOTS) {
      // The page scrolls inside the app, so a tall viewport captures the whole gallery.
      await page.setViewportSize({ width: 412, height: 6400 });
      await page.waitForTimeout(500);
      mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `galeria-${theme}.png`), fullPage: true });
    }
  });
}

test('gallery interactions: sheet, dialog and toast', async ({ page }) => {
  await page.goto('/dev/ui');
  await page.getByRole('button', { name: 'Abrir sheet' }).click();
  await expect(page.getByRole('heading', { name: 'Como funciona' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  await expect(page.getByRole('heading', { name: 'Como funciona' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByText('Ana perde o acesso à comunidade. Pode pedir para entrar de novo.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();

  await page.getByRole('button', { name: 'Mostrar aviso' }).click();
  await expect(page.getByText('Conta criada. Bora votar.')).toBeVisible();
});
