// Member page and profile (Sprint 18): the core page shows every enabled module's profile section with the
// module's own renderer (the real Errômetro and Eventos ones here).
import { ThemeProvider, ToastProvider } from '@erre/ui';
import errometro from '@erre/errometro';
import eventos from '@erre/eventos';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppLayout from '../src/app/(app)/_layout';
import Member from '../src/app/(app)/comunidade/membro/[id]';
import Home from '../src/app/(app)/index';
import Profile from '../src/app/(app)/perfil/index';

jest.mock('@/lib/auth', () => ({
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(async () => undefined),
  sessionCookie: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    api: jest.fn(),
    moduleFetch: jest.fn(() => async () => new Response('{"events":[],"canCreate":false,"canModerate":false}')),
  };
});

const { api } = jest.requireMock('@/lib/api') as { api: jest.Mock };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

let me = { id: 'u1', email: 'ana@example.com', displayName: 'Ana', avatarVariant: 'teal', nameConfirmed: true };
const sections = [
  {
    id: 'errometro.trofeus',
    module: 'errometro',
    data: [{ emojiId: 'coracao', char: '❤️', trophyName: 'Mais Amado', glowRgb: '1 2 3', winCount: 2 }],
  },
  {
    id: 'eventos.trofeus',
    module: 'eventos',
    data: {
      categorical: [],
      scale: [
        {
          eventId: 'e1',
          eventTitle: 'Churrasco',
          emojiId: 'limao',
          char: '🍋',
          label: 'Limão',
          trophyName: 'Mais Azedo',
          glowRgb: '1 2 3',
          average: 7,
          scaleMax: 10,
          wonAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    },
  },
];

function mockApi(modules = true) {
  api.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, string> }) => {
    if (path === '/v1/me') return me;
    if (path === '/v1/me/profile' && init?.method === 'PATCH') {
      me = { ...me, ...init.body };
      return me;
    }
    if (path === '/v1/me/communities') return [{ id: 'c1', slug: 'turma', name: 'turma', role: 'membro' }];
    if (path === '/v1/me/requests') return [];
    if (path === '/v1/communities/c1')
      return { id: 'c1', slug: 'turma', name: 'turma', role: 'membro', permissions: [] };
    if (path === '/v1/communities/c1/members')
      return [
        { userId: 'u1', displayName: me.displayName, avatarVariant: me.avatarVariant, role: 'membro' },
        { userId: 'u2', displayName: 'Bia', avatarVariant: 'rose', role: 'admin' },
      ];
    if (path === '/v1/modules') return modules ? [errometro, eventos] : [];
    if (path === '/v1/profile/u2/sections') return sections;
    if (path === '/v1/profile/u1/sections') return [];
    throw new Error(`unexpected ${path}`);
  });
}

async function open(url: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const Root = ({ children }: { children?: ReactNode }) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
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
      '(app)/perfil/index': Profile,
      '(app)/comunidade/membro/[id]': Member,
    },
    { initialUrl: url },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  me = { id: 'u1', email: 'ana@example.com', displayName: 'Ana', avatarVariant: 'teal', nameConfirmed: true };
  mockApi();
});

test("a member's page shows the trophies of every module, with each module's renderer", async () => {
  await open('/comunidade/membro/u2');
  expect(await screen.findByText('Bia')).toBeTruthy();
  expect(screen.getByText('admin')).toBeTruthy();
  expect(await screen.findByText('Troféus do Errômetro')).toBeTruthy();
  expect(screen.getByText('2×')).toBeTruthy();
  expect(screen.getByText('Troféus de eventos')).toBeTruthy();
  expect(screen.getByLabelText('Mais Azedo em Churrasco, 70%')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Editar meu perfil' })).toBeNull();
});

test('the hub opens my profile from the avatar; I change my name and color', async () => {
  mockApi(false); // the hub's module sections are covered by their own tests
  await open('/');
  await fireEvent.press(await screen.findByLabelText('Seu perfil, Ana'));
  expect(await screen.findByText('Nenhum troféu por aqui ainda.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'a');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nome' }));
  expect(await screen.findByText('Mínimo 2 caracteres.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Aninha');
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nome' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/v1/me/profile', { method: 'PATCH', body: { displayName: 'Aninha' } }),
  );
  await fireEvent.press(screen.getByLabelText('Rosa'));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/v1/me/profile', { method: 'PATCH', body: { avatarVariant: 'rose' } }),
  );
});
