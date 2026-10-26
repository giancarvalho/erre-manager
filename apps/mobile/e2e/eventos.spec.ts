/// <reference types="node" />
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { devices, expect, test, type Browser, type Page, type Request } from '@playwright/test';

import { fakeGoogle } from './helpers';

const WEB = 'http://localhost:8081';
const shots = path.resolve(__dirname, '../../../docs/migration/relatorios/sprint-17');

async function person(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB });
  const page = await context.newPage();
  const id = `${name}-${Date.now().toString(36)}`.toLowerCase();
  await fakeGoogle(page, { sub: `e2e-${id}`, email: `e2e-${id}@example.com`, name });
  return page;
}

/** The wizard: title, type, two catalog emojis (scale: ceiling 5), manual release, default color. */
async function createEvent(page: Page, title: string, type: 'Categórico' | 'Escala') {
  await page.getByRole('button', { name: 'Novo evento' }).click();
  await page.getByLabel('Título').fill(title);
  await page.getByRole('radio', { name: type }).click();
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByRole('button', { name: 'Adicionar Coração', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Cobra', exact: true }).click();
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function confirm(page: Page, open: string, action: string) {
  await page.getByRole('button', { name: open }).click();
  await page.getByRole('button', { name: action, exact: true }).last().click();
}

test('create, publish, sign up by invite, vote anonymously, close and see the result', async ({ browser }) => {
  test.setTimeout(180_000);
  const community = `evt-${Date.now().toString(36)}`;

  // Owner: community, then an event from the hub.
  const owner = await person(browser, 'Dona');
  await owner.goto('/');
  await owner.getByRole('button', { name: 'Continuar com Google' }).click();
  await owner.getByRole('button', { name: 'Continuar' }).click();
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await owner.getByLabel('Nome da comunidade').fill(community);
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(owner.getByText('Votações únicas, além do Errômetro de sempre.')).toBeVisible();
  await owner.getByRole('button', { name: 'Eventos', exact: true }).click();
  await expect(owner.getByText('Nenhum evento criado ainda.')).toBeVisible();
  await createEvent(owner, 'Churrasco', 'Categórico');
  await confirm(owner, 'Publicar evento', 'Publicar evento');
  await expect(owner.getByText('Evento publicado. Bora chamar a galera.')).toBeVisible();
  await owner.getByRole('button', { name: 'Participar do evento' }).click();
  await expect(owner.getByText('Você já está confirmado!')).toBeVisible();

  // Invite with the events intent: approving the request signs the guest up for the live event.
  await owner.goto('/');
  await expect(owner.getByText('Aceitando inscrições: Churrasco')).toBeVisible();
  await owner.getByRole('button', { name: 'Convidar pessoas' }).click();
  await owner.getByRole('radio', { name: 'Entrar e participar do evento em andamento' }).click();
  await owner.getByRole('button', { name: 'Criar link de convite' }).click();
  const linkText = owner.getByLabel('Link de convite', { exact: true });
  await expect(linkText).toBeVisible();
  const link = (await linkText.textContent())!.trim();

  const guest = await person(browser, 'Gui');
  await guest.goto(link);
  await guest.getByRole('button', { name: 'Entrar para pedir' }).click();
  await guest.getByRole('button', { name: 'Continuar com Google' }).click();
  await guest.getByRole('button', { name: 'Pedir para entrar' }).click();
  await expect(guest.getByText('Pedido enviado')).toBeVisible();
  await owner.goto('/');
  await owner.getByRole('button', { name: 'Membros' }).click();
  await owner.getByRole('button', { name: 'Aprovar Gui' }).click();
  await expect(owner.getByText('2 membros')).toBeVisible();

  // Owner opens voting from the event screen.
  await owner.goto('/eventos');
  await owner.getByRole('button', { name: /^Churrasco, / }).click();
  await expect(owner.getByText('2 pessoas inscritas')).toBeVisible();
  await confirm(owner, 'Abrir votação agora', 'Abrir votação');
  await expect(owner.getByText('Votação aberta.')).toBeVisible();

  // Guest votes from the hub banner; the ballot carries no session at all.
  const anonRequests: Request[] = [];
  guest.on('request', (r) => {
    if (r.url().includes('/v1/eventos/anon/')) anonRequests.push(r);
  });
  await guest.goto('/');
  await guest.getByRole('button', { name: 'Continuar' }).click(); // onboarding (first time on the hub)
  await expect(guest.getByText('Votação aberta: Churrasco')).toBeVisible();
  await guest.getByRole('button', { name: 'Votar agora' }).click();
  await expect(guest.getByRole('button', { name: /, para Dona$/ }).first()).toBeVisible();
  await expect(guest.getByRole('button', { name: /, para Gui$/ })).toHaveCount(0);
  await guest.getByRole('button', { name: /^Cobra: .*, para Dona$/ }).click();
  await guest.getByRole('button', { name: 'Enviar votos' }).click();
  await expect(guest.getByText('Votos registrados!')).toBeVisible();
  const ballot = anonRequests.find((r) => r.url().endsWith('/votos'))!;
  expect(ballot).toBeTruthy();
  const headers = await ballot.allHeaders();
  expect(headers.cookie).toBeUndefined();
  expect(headers.authorization).toBeUndefined();
  expect(headers['x-community-id']).toBeUndefined();

  // Owner closes; everyone sees the result.
  await owner.reload();
  await confirm(owner, 'Fechar votação agora', 'Fechar votação');
  await expect(owner.getByText('Votação fechada. O resultado saiu.')).toBeVisible();
  await guest.goto('/');
  await expect(guest.getByText('Votação encerrada: Churrasco')).toBeVisible();
  await guest.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(guest.getByRole('heading', { name: 'Churrasco' })).toBeVisible();
  await expect(guest.getByLabel(/^1º lugar, Dona, 1 votos/)).toBeVisible();

  // A scale event right after: one row of pips per axis.
  await owner.goto('/eventos');
  await createEvent(owner, 'Quão sortudo?', 'Escala');
  await confirm(owner, 'Publicar evento', 'Publicar evento');
  await owner.getByRole('button', { name: 'Participar do evento' }).click();
  await guest.goto('/');
  await guest.getByRole('button', { name: 'Participar', exact: true }).click();
  await guest.getByRole('button', { name: 'Participar do evento' }).click();
  await expect(guest.getByText('Você já está confirmado!')).toBeVisible();
  await owner.reload();
  await confirm(owner, 'Abrir votação agora', 'Abrir votação');
  await guest.goto('/');
  await guest.getByRole('button', { name: 'Votar agora' }).click();
  await guest.getByRole('button', { name: 'Coração: 4 de 5, para Dona' }).click();
  await expect(guest.getByRole('button', { name: 'Coração: 4 de 5, para Dona' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await guest.getByRole('button', { name: 'Enviar votos' }).click();
  await expect(guest.getByText('Votos registrados!')).toBeVisible();

  if (process.env.EVENTOS_SHOTS) {
    // Prints for the sprint report (DESIGN §14): hub banner, voting by scale, the wizard and the result.
    mkdirSync(shots, { recursive: true });
    await guest.waitForTimeout(400);
    await guest.screenshot({ path: path.join(shots, 'votacao-escala-dark.png') });
    await guest.evaluate(() => localStorage.setItem('erre:theme', 'light'));
    await guest.reload();
    await expect(guest.getByRole('button', { name: 'Coração: 4 de 5, para Dona' })).toBeVisible();
    await guest.waitForTimeout(400);
    await guest.screenshot({ path: path.join(shots, 'votacao-escala-light.png') });
    await guest.goto('/');
    await expect(guest.getByText('Votação aberta: Quão sortudo?')).toBeVisible();
    await guest.waitForTimeout(300);
    await guest.screenshot({ path: path.join(shots, 'hub-light.png') });
    await owner.goto('/eventos');
    await owner.getByRole('button', { name: 'Novo evento' }).click();
    await owner.getByLabel('Título').fill('Amigo Secreto');
    await owner.getByRole('button', { name: 'Próximo' }).click();
    await owner.getByRole('button', { name: 'Adicionar Coração', exact: true }).click();
    await owner.waitForTimeout(300);
    await owner.screenshot({ path: path.join(shots, 'assistente-dark.png') });
    await owner.goto('/eventos');
    await owner.getByRole('button', { name: /^Churrasco, / }).click();
    await owner.getByRole('button', { name: 'Ver resultados' }).click();
    await expect(owner.getByText('Troféus deste evento').or(owner.getByText(/Ninguém levou troféu/))).toBeVisible();
    await owner.waitForTimeout(400);
    await owner.screenshot({ path: path.join(shots, 'resultados-dark.png') });
  }
});
