import { ThemeProvider, ToastProvider } from '@erre/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Gallery } from '../src/app/dev/ui';

jest.mock('expo-router', () => ({ Redirect: () => null }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderGallery(theme: 'dark' | 'light') {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider initial={theme}>
        <ToastProvider>
          <Gallery />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

test.each(['dark', 'light'] as const)('every component renders in the %s theme', async (theme) => {
  await renderGallery(theme);
  expect(screen.getByRole('header', { name: 'Galeria de componentes' })).toBeTruthy();
  for (const text of ['Criar comunidade', 'Rodada liberada', 'Resultados reservados', 'Nenhum evento ainda.']) {
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  }
});

test('emoji toggles selection; segments and accordion announce their state', async () => {
  await renderGallery('dark');
  const cobra = screen.getByLabelText('Cobra: falso, age pelas costas');
  expect(cobra).toBeSelected();
  await fireEvent.press(cobra);
  expect(screen.getByLabelText('Cobra: falso, age pelas costas')).not.toBeSelected();

  await fireEvent.press(screen.getByRole('tab', { name: 'Não votados' }));
  expect(screen.getByRole('tab', { name: 'Não votados' })).toBeSelected();

  const accordion = screen.getByRole('button', { name: 'O que significa cada emoji?' });
  expect(accordion).not.toBeExpanded();
  await fireEvent.press(accordion);
  expect(screen.getByRole('button', { name: 'O que significa cada emoji?' })).toBeExpanded();
  expect(screen.getByText('🪴 Planta: existe, mas ninguém percebe')).toBeTruthy();
});

test('disabled button explains why; toasts appear', async () => {
  await renderGallery('light');
  expect(screen.getByText('Escolha pelo menos um emoji para continuar.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Mostrar aviso'));
  expect(await screen.findByText('Conta criada. Bora votar.')).toBeTruthy();
});

test('theme picker switches the theme', async () => {
  await renderGallery('dark');
  await fireEvent.press(screen.getByRole('radio', { name: 'Claro' }));
  expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
});
