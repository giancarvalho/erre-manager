import { ThemeProvider, Text } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppLayout from '../src/app/(app)/_layout';
import Home from '../src/app/(app)/index';
import { withModule } from '@/lib/modules';

jest.mock('@/modules', () => ({ MODULE_UIS: [jest.requireActual('@erre/contrato-teste/ui').default] }));
jest.mock('@/lib/auth', () => ({
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  sessionCookie: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: jest.fn(), moduleFetch: jest.fn() };
});

const { api, moduleFetch } = jest.requireMock('@/lib/api') as { api: jest.Mock; moduleFetch: jest.Mock };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const manifest = jest.requireActual('@erre/contrato-teste').default;
const fetched: string[] = [];

function mockApi(enabled: boolean) {
  api.mockImplementation(async (path: string) => {
    if (path === '/v1/me')
      return { id: 'u1', email: 'a@b.c', displayName: 'Ana', avatarVariant: 'teal', nameConfirmed: true };
    if (path === '/v1/me/communities') return [{ id: 'c1', slug: 'turma', name: 'turma', role: 'membro' }];
    if (path === '/v1/me/requests') return [];
    if (path === '/v1/communities/c1')
      return { id: 'c1', slug: 'turma', name: 'turma', role: 'membro', permissions: [] };
    if (path === '/v1/modules') return enabled ? [manifest] : [];
    throw new Error(`unexpected ${path}`);
  });
  moduleFetch.mockImplementation((communityId: string) => async (input: string) => {
    fetched.push(`${communityId} ${input}`);
    return new Response(JSON.stringify([{ id: 'i1' }, { id: 'i2' }]), {
      headers: { 'content-type': 'application/json' },
    });
  });
}

function ModuleScreen() {
  return <Text>Tela do módulo</Text>;
}

// What a thin route file does: export default withModule('<id>', Screen).
const Gated = withModule('contratoteste', ModuleScreen);
function GatedRoute() {
  return <Gated />;
}

async function open(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Root = ({ children }: { children?: ReactNode }) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
  return renderRouter(
    {
      _layout: () => (
        <Root>
          <Slot />
        </Root>
      ),
      '(app)/_layout': AppLayout,
      '(app)/index': Home,
      '(app)/contratoteste/index': GatedRoute,
    },
    { initialUrl: url },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  fetched.length = 0;
});

test('an enabled module shows its hub section and menu, using its typed client', async () => {
  mockApi(true);
  await open('/');
  expect(await screen.findByText('2 itens')).toBeTruthy();
  expect(fetched).toEqual(['c1 http://localhost:3000/v1/contratoteste/items']);
  await fireEvent.press(screen.getByText('Teste'));
  expect(await screen.findByText('Tela do módulo')).toBeTruthy();
});

test('a disabled module is hidden from the hub', async () => {
  mockApi(false);
  await open('/');
  expect(await screen.findByText('Seu papel: membro')).toBeTruthy();
  expect(screen.queryByText('Contrato (teste)')).toBeNull();
  expect(screen.queryByText('Teste')).toBeNull();
});

test('opening a disabled module route says it is unavailable', async () => {
  mockApi(false);
  await open('/contratoteste');
  expect(await screen.findByText('Funcionalidade indisponível')).toBeTruthy();
  expect(screen.queryByText('Tela do módulo')).toBeNull();
});
