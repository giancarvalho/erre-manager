import { ThemeProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NotificationsScreen from '../src/app/(app)/notificacoes';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/push', () => ({
  isPushOn: jest.fn(async () => false),
  pushUnavailableReason: jest.fn(async () => null),
  turnPushOn: jest.fn(async () => ({ ok: true })),
  turnPushOff: jest.fn(async () => ({ ok: true })),
}));
jest.mock('@/lib/auth', () => ({ sessionCookie: jest.fn(async () => undefined) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), api: jest.fn() }));

const push = jest.requireMock('@/lib/push') as Record<string, jest.Mock>;
const { api } = jest.requireMock('@/lib/api') as { api: jest.Mock };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <NotificationsScreen />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

let prefs: { type: string; label: string; module: string; enabled: boolean }[];

beforeEach(() => {
  jest.clearAllMocks();
  prefs = [{ type: 'errometro.resultado_pronto', label: 'Resultado liberado', module: 'errometro', enabled: true }];
  api.mockImplementation(
    async (path: string, init?: { method?: string; body?: { type: string; enabled: boolean } }) => {
      if (path === '/v1/notification-preferences' && init?.method === 'PUT') return init.body;
      if (path === '/v1/notification-preferences') return prefs;
      throw new Error(`unexpected ${path}`);
    },
  );
});

test('turns push on for this device', async () => {
  await renderScreen();
  const device = await screen.findByRole('switch', { name: 'Receber notificações' });
  await waitFor(() => expect(device).not.toBeDisabled());
  await fireEvent.press(device);
  await waitFor(() => expect(push.turnPushOn).toHaveBeenCalled());
});

test('explains why push is unavailable', async () => {
  push.pushUnavailableReason!.mockResolvedValueOnce('Este navegador não aceita notificações.');
  await renderScreen();
  expect(await screen.findByText('Este navegador não aceita notificações.')).toBeTruthy();
  expect(screen.getByRole('switch', { name: 'Receber notificações' })).toBeDisabled();
});

test('shows a failure reason from turning push on', async () => {
  push.turnPushOn!.mockResolvedValueOnce({ ok: false, reason: 'Você não permitiu notificações neste navegador.' });
  await renderScreen();
  const device = await screen.findByRole('switch', { name: 'Receber notificações' });
  await waitFor(() => expect(device).not.toBeDisabled());
  await fireEvent.press(device);
  expect(await screen.findByText('Você não permitiu notificações neste navegador.')).toBeTruthy();
});

test('changes a preference by type right away', async () => {
  await renderScreen();
  await fireEvent.press(await screen.findByRole('switch', { name: 'Resultado liberado' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/v1/notification-preferences', {
      method: 'PUT',
      body: { type: 'errometro.resultado_pronto', enabled: false },
    }),
  );
  expect(screen.getByRole('switch', { name: 'Resultado liberado' })).not.toBeChecked();
});

test('no types yet', async () => {
  prefs = [];
  await renderScreen();
  expect(await screen.findByText('Nenhum tipo de notificação por enquanto.')).toBeTruthy();
});
