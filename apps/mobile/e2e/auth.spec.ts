import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3000';

/** Stands in for Google: sends the browser straight back to the API callback with a code carrying the profile. */
async function fakeGoogle(page: Page, profile: { sub: string; email: string; name: string }) {
  await page.route('https://accounts.google.com/**', async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state') ?? '';
    const b64url = btoa(JSON.stringify(profile)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const code = `e2e.${b64url}`;
    await route.fulfill({
      status: 302,
      headers: { location: `${API}/v1/auth/callback/google?code=${code}&state=${encodeURIComponent(state)}` },
    });
  });
}

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
  await expect(page.getByRole('heading', { name: 'Oi, Pessoa' })).toBeVisible();

  // The session survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Oi, Pessoa' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Oi, Volta' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();

  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  await expect(page.getByRole('heading', { name: 'Oi, Volta' })).toBeVisible();
});
