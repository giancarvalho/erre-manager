/// <reference types="node" />
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { fakeGoogle } from './helpers';

const shots = path.resolve(__dirname, '../../../docs/migration/relatorios/sprint-18');

test('landing explains how it works; the web app is installable (manifest, icons, share image)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByRole('heading', { name: 'Errômetro' })).toBeVisible();
  await expect(page.getByText(/Até 50 votantes e 300 membros por comunidade/)).toBeVisible();
  await page.getByRole('button', { name: 'Como funciona' }).click();
  await expect(page.getByText(/Ninguém vê quem votou o quê/)).toBeVisible();

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as {
    name: string;
    display: string;
    icons: { src: string }[];
  };
  expect(manifest).toMatchObject({ name: 'Errômetro', display: 'standalone' });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
  expect((await page.request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  expect((await page.request.get('/og.png')).ok()).toBe(true);
  if (process.env.PROFILE_SHOTS) {
    mkdirSync(shots, { recursive: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, 'landing-dark.png') });
  }
});

test('profile: change name and avatar color; member page from the members list', async ({ page }) => {
  const id = Date.now().toString(36);
  await fakeGoogle(page, { sub: `e2e-p-${id}`, email: `e2e-p-${id}@example.com`, name: 'Perfilada' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Criar comunidade' }).click();
  await page.getByLabel('Nome da comunidade').fill(`perfil-${id}`);
  await page.getByRole('button', { name: 'Criar comunidade' }).click();

  await page.getByRole('button', { name: 'Seu perfil, Perfilada' }).click();
  await expect(page.getByRole('heading', { name: 'Perfilada' })).toBeVisible();
  await page.getByLabel('Seu nome').fill('Perfilada Nova');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Perfil salvo.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perfilada Nova' })).toBeVisible();
  await page.getByRole('radio', { name: 'Turquesa' }).click();
  await expect(page.getByRole('radio', { name: 'Turquesa' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/Seus troféus em perfil-/)).toBeVisible();
  await expect(page.getByText('Nenhum troféu por aqui ainda.')).toBeVisible();

  await page.goto('/comunidade/membros');
  await page.getByRole('button', { name: /^Perfilada Nova, / }).click();
  await expect(page.getByRole('heading', { name: 'Perfilada Nova' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar meu perfil' })).toBeVisible();
  if (process.env.PROFILE_SHOTS) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shots, 'membro-dark.png') });
    await page.evaluate(() => localStorage.setItem('erre:theme', 'light'));
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { name: 'Perfilada Nova' })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(shots, 'perfil-light.png'), fullPage: true });
  }
});
