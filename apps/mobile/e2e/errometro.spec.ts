/// <reference types="node" />
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { devices, expect, test, type Browser, type Page, type Request } from '@playwright/test';

import { fakeGoogle } from './helpers';

const API = 'http://localhost:3000';
const WEB = 'http://localhost:8081';
const shots = path.resolve(__dirname, '../../../docs/migration/relatorios/sprint-14');

async function person(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB });
  const page = await context.newPage();
  const id = `${name}-${Date.now().toString(36)}`.toLowerCase();
  await fakeGoogle(page, { sub: `e2e-${id}`, email: `e2e-${id}@example.com`, name });
  return page;
}

/** Calls the API with the page's session (the moderation screens come in Sprint 15). */
async function apiAs(page: Page, method: 'GET' | 'POST', path: string, communityId?: string) {
  const res = await page.request.fetch(`${API}${path}`, {
    method,
    headers: { origin: WEB, ...(communityId ? { 'x-community-id': communityId } : {}) },
  });
  expect(res.ok(), `${method} ${path}: ${res.status()}`).toBe(true);
  return res.json() as Promise<unknown>;
}

test('one request joins community and Errômetro; voting is anonymous on the wire', async ({ browser }) => {
  test.setTimeout(90_000);
  const community = `erro-${Date.now().toString(36)}`;

  // Owner: community + invite link that also asks for the Errômetro (selected by default).
  const owner = await person(browser, 'Dona');
  await owner.goto('/');
  await owner.getByRole('button', { name: 'Continuar com Google' }).click();
  await owner.getByRole('button', { name: 'Continuar' }).click();
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await owner.getByLabel('Nome da comunidade').fill(community);
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(owner.getByRole('heading', { name: community })).toBeVisible();
  await expect(owner.getByText('Você ainda não participa da votação desta comunidade.')).toBeVisible();
  await owner.getByRole('button', { name: 'Quero participar do Errômetro' }).click();
  await expect(owner.getByText('Pedido enviado. Falta a aprovação de quem administra a comunidade.')).toBeVisible();

  await owner.getByRole('button', { name: 'Convidar pessoas' }).click();
  await expect(owner.getByRole('radio', { name: 'Entrar e participar do Errômetro' })).toBeChecked();
  await owner.getByRole('button', { name: 'Criar link de convite' }).click();
  const linkText = owner.getByLabel('Link de convite', { exact: true });
  await expect(linkText).toBeVisible();
  const link = (await linkText.textContent())!.trim();

  // Guest: one request, approved once, and they vote in the Errômetro too (D-023).
  const guest = await person(browser, 'Gui');
  await guest.goto(link);
  await expect(guest.getByText(/Entrar e participar do Errômetro/)).toBeVisible();
  await guest.getByRole('button', { name: 'Entrar para pedir' }).click();
  await guest.getByRole('button', { name: 'Continuar com Google' }).click();
  await guest.getByRole('button', { name: 'Pedir para entrar' }).click();
  await expect(guest.getByText('Pedido enviado')).toBeVisible();

  await owner.goto('/');
  await owner.getByRole('button', { name: 'Membros' }).click();
  await owner.getByRole('button', { name: 'Aprovar Gui' }).click();
  await expect(owner.getByText('2 membros')).toBeVisible();

  // The owner approves her own voting request through the API (moderation screen: Sprint 15).
  const [mine] = (await apiAs(owner, 'GET', '/v1/me/communities')) as { id: string }[];
  const me = (await apiAs(owner, 'GET', '/v1/me')) as { id: string };
  await apiAs(owner, 'POST', `/v1/errometro/participantes/${me.id}/aprovar`, mine!.id);

  // Owner votes. The ballot request must carry no session at all.
  const anonRequests: Request[] = [];
  owner.on('request', (r) => {
    if (r.url().includes('/v1/errometro/anon/')) anonRequests.push(r);
  });
  await owner.goto('/');
  await owner.getByRole('button', { name: 'Votar' }).click();
  await expect(owner.getByRole('heading', { name: community })).toBeVisible();
  await expect(owner.getByText('Toque em um emoji para cada pessoa.', { exact: false })).toBeVisible();
  await expect(owner.getByRole('button', { name: /, para Gui$/ }).first()).toBeVisible();
  await expect(owner.getByRole('button', { name: /, para Dona$/ })).toHaveCount(0); // nobody votes on themselves
  await owner.getByRole('button', { name: 'O que significa cada emoji?' }).click();
  await expect(owner.getByText(/Erra com convicção/)).toBeVisible();

  await owner.getByRole('button', { name: /^Cobra: .*, para Gui$/ }).click();
  await expect(owner.getByText('1 de 1 pessoa votada')).toBeVisible();
  await owner.getByRole('button', { name: 'Enviar votos' }).click();
  await expect(owner.getByText('Votos enviados.')).toBeVisible();
  await expect(owner.getByText('Você já votou nesta rodada.')).toBeVisible();

  const ballot = anonRequests.find((r) => r.url().endsWith('/votos') && r.method() === 'POST')!;
  expect(ballot).toBeTruthy();
  const headers = await ballot.allHeaders();
  expect(headers.cookie).toBeUndefined();
  expect(headers.authorization).toBeUndefined();
  expect(headers['x-community-id']).toBeUndefined();

  // Reload: the device's token brings back the votes (by the code, anonymously).
  await owner.reload();
  await expect(owner.getByRole('button', { name: 'Atualizar votos' })).toBeVisible();
  await expect(owner.getByRole('button', { name: /^Cobra: .*, para Gui$/ })).toHaveAttribute('aria-selected', 'true');
  await owner.getByRole('button', { name: 'Problemas com seu voto?' }).click();
  await expect(owner.getByText(/^[0-9a-f]{64}$/)).toBeVisible();
  const meusVotos = anonRequests.filter((r) => r.url().endsWith('/meus-votos'));
  expect(meusVotos.length).toBeGreaterThan(0);
  expect((await meusVotos[0]!.allHeaders()).cookie).toBeUndefined();

  if (process.env.ERROMETRO_SHOTS) {
    // Prints for the sprint report (DESIGN §14): voting screen in both themes, and the hub section.
    mkdirSync(shots, { recursive: true });
    await owner.getByRole('button', { name: 'O que significa cada emoji?' }).click();
    await owner.waitForTimeout(400);
    await owner.screenshot({ path: path.join(shots, 'votacao-dark.png') });
    await owner.evaluate(() => localStorage.setItem('erre:theme', 'light'));
    await owner.reload();
    await expect(owner.getByRole('button', { name: 'Atualizar votos' })).toBeVisible();
    await owner.waitForTimeout(400);
    await owner.screenshot({ path: path.join(shots, 'votacao-light.png') });
    await guest.goto('/');
    await guest.getByRole('button', { name: 'Continuar' }).click(); // onboarding
    await expect(guest.getByText('Você participa da votação desta comunidade.')).toBeVisible();
    await guest.screenshot({ path: path.join(shots, 'hub-dark.png') });
  }
});
