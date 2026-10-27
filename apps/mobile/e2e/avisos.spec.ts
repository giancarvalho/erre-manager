// Mural de avisos (Sprint 20): the module built with the generator, end to end on the web export.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { devices, expect, test, type Browser, type Page } from '@playwright/test';

import { fakeGoogle } from './helpers';

const shots = path.resolve(__dirname, '../../../docs/migration/relatorios/sprint-20');

async function person(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:8081' });
  const page = await context.newPage();
  const id = `${name}-${Date.now().toString(36)}`.toLowerCase();
  await fakeGoogle(page, { sub: `e2e-${id}`, email: `e2e-${id}@example.com`, name });
  return page;
}

test('publish a notice on the board and delete it', async ({ browser }) => {
  const owner = await person(browser, 'Dona');
  await owner.goto('/');
  await owner.getByRole('button', { name: 'Continuar com Google' }).click();
  await owner.getByRole('button', { name: 'Continuar' }).click();
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await owner.getByLabel('Nome da comunidade').fill(`mural-${Date.now().toString(36)}`);
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();

  await expect(
    owner
      .getByText('Nada por aqui ainda.')
      .or(owner.getByText(/Nenhum aviso/))
      .first(),
  ).toBeVisible();
  await owner.goto('/avisos');
  await expect(owner.getByRole('heading', { name: 'Avisos da comunidade' })).toBeVisible();
  await owner.getByRole('textbox', { name: 'Título' }).fill('Treino de sábado cancelado');
  await owner.getByRole('textbox', { name: 'Aviso' }).fill('Choveu demais, a quadra alagou. Volta semana que vem.');
  await owner.getByRole('button', { name: 'Publicar aviso' }).click();
  await expect(owner.getByText('Aviso publicado. A comunidade foi avisada.')).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Treino de sábado cancelado' })).toBeVisible();

  if (process.env.AVISOS_SHOTS) {
    // Prints for the sprint report (DESIGN §14): both themes.
    mkdirSync(shots, { recursive: true });
    await owner.waitForTimeout(600);
    await owner.screenshot({ path: path.join(shots, 'avisos-dark.png') });
    await owner.evaluate(() => localStorage.setItem('erre:theme', 'light'));
    await owner.reload();
    await expect(owner.getByRole('heading', { name: 'Treino de sábado cancelado' })).toBeVisible();
    await owner.waitForTimeout(600);
    await owner.screenshot({ path: path.join(shots, 'avisos-light.png') });
  }

  await owner.getByRole('button', { name: 'Apagar', exact: true }).click();
  await owner.getByRole('button', { name: 'Apagar aviso' }).click();
  await expect(owner.getByText('Aviso apagado.')).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Treino de sábado cancelado' })).toHaveCount(0);
});
