import { devices, expect, test, type Browser, type Page } from '@playwright/test';

import { fakeGoogle } from './helpers';

async function person(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:8081' });
  const page = await context.newPage();
  const id = `${name}-${Date.now().toString(36)}`.toLowerCase();
  await fakeGoogle(page, { sub: `e2e-${id}`, email: `e2e-${id}@example.com`, name });
  return page;
}

async function signIn(page: Page) {
  await page.getByRole('button', { name: /Continuar com Google|Entrar para pedir/ }).click();
  if (
    await page
      .getByRole('button', { name: 'Continuar com Google' })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole('button', { name: 'Continuar com Google' }).click();
  }
}

test('invite link → request → approval → member → leave; revoked link stops working', async ({ browser }) => {
  const community = `turma-${Date.now().toString(36)}`;

  // Owner creates the community and an invite link.
  const owner = await person(browser, 'Dona');
  await owner.goto('/');
  await signIn(owner);
  await owner.getByRole('button', { name: 'Continuar' }).click();
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await owner.getByLabel('Nome da comunidade').fill(community);
  await owner.getByRole('button', { name: 'Criar comunidade' }).click();
  await expect(owner.getByRole('heading', { name: community })).toBeVisible();
  await owner.getByRole('button', { name: 'Convidar pessoas' }).click();
  await owner.getByRole('button', { name: 'Criar link de convite' }).click();
  const linkText = owner.getByLabel('Link de convite', { exact: true });
  await expect(linkText).toBeVisible();
  const link = (await linkText.textContent())!.trim();
  expect(link).toMatch(/^http:\/\/localhost:8081\/convite\/[A-Za-z0-9_-]{34}$/);

  // Someone opens the link, signs in and asks to join.
  const guest = await person(browser, 'Convidado');
  await guest.goto(link);
  await expect(guest.getByRole('heading', { name: community })).toBeVisible();
  await guest.getByRole('button', { name: 'Entrar para pedir' }).click();
  await guest.getByRole('button', { name: 'Continuar com Google' }).click();
  await expect(guest.getByRole('heading', { name: community })).toBeVisible();
  await guest.getByRole('button', { name: 'Pedir para entrar' }).click();
  await expect(guest.getByText('Pedido enviado')).toBeVisible();
  await guest.getByRole('button', { name: 'Ir para o início' }).click();
  await guest.getByRole('button', { name: 'Continuar' }).click(); // onboarding
  await expect(guest.getByText('Aguardando aprovação')).toBeVisible();
  await expect(guest.getByText(community)).toBeVisible();

  // Owner approves.
  await owner.goto('/');
  await owner.getByRole('button', { name: 'Membros' }).click();
  await owner.getByRole('button', { name: 'Aprovar Convidado' }).click();
  await expect(owner.getByText('2 membros')).toBeVisible();

  // The guest is in, then leaves.
  await guest.reload();
  await expect(guest.getByRole('heading', { name: community })).toBeVisible();
  await expect(guest.getByText('Seu papel: membro')).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Convidar pessoas' })).toHaveCount(0);
  await guest.getByRole('button', { name: 'Membros' }).click();
  await guest.getByRole('button', { name: 'Sair da comunidade' }).click();
  await guest.getByRole('button', { name: `Sair de ${community}` }).click();
  await expect(guest.getByRole('heading', { name: 'Você ainda não está em nenhuma comunidade' })).toBeVisible();

  // Owner turns the link off; it stops working.
  await owner.goto('/comunidade/convites');
  await owner.getByRole('button', { name: 'Desativar' }).click();
  await owner.getByRole('button', { name: 'Desativar link' }).click();
  await expect(owner.getByText('Nenhum link ativo.')).toBeVisible();
  await guest.goto(link);
  await expect(guest.getByText(/Esse convite não vale mais/)).toBeVisible();
});
