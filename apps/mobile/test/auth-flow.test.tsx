import type { Me } from '@erre/core/client';
import { ThemeProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Slot } from 'expo-router';

import AppLayout from '../src/app/(app)/_layout';
import ChooseCommunity from '../src/app/(app)/comunidades/index';
import NewCommunity from '../src/app/(app)/comunidades/nova';
import Home from '../src/app/(app)/index';
import SignIn from '../src/app/(auth)/entrar';
import InviteScreen from '../src/app/convite/[codigo]';
import EnterInvite from '../src/app/convite/index';
import NotFound from '../src/app/+not-found';
import { ErrorBoundary } from '../src/app/_layout';
import OnboardingName from '../src/app/onboarding/nome';
import { ApiError } from '@/lib/api';

jest.mock('@/lib/auth', () => ({
  signInWithGoogle: jest.fn(async () => ({ error: false })),
  signOut: jest.fn(async () => undefined),
  sessionCookie: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: jest.fn() };
});

const { api } = jest.requireMock('@/lib/api') as { api: jest.Mock };
const auth = jest.requireMock('@/lib/auth') as { signInWithGoogle: jest.Mock; signOut: jest.Mock };

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const baseMe: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  avatarVariant: 'teal',
  nameConfirmed: true,
};

type Community = { id: string; slug: string; name: string; role: 'owner' | 'admin' | 'moderador' | 'membro' };

function mockMe(me: Me | null, communities: Community[] = []) {
  api.mockImplementation(
    async (
      path: string,
      init?: { method?: string; body?: { displayName?: string; name?: string }; communityId?: string },
    ) => {
      if (path === '/v1/me/communities') return communities;
      if (path === '/v1/me/requests') return [];
      if (path === '/v1/modules') return [];
      const invite = /^\/v1\/invites\/([^/]+)(\/join)?$/.exec(path);
      if (invite) {
        if (invite[1] === 'revogado')
          throw new ApiError(
            404,
            'NOT_FOUND',
            'Esse convite não vale mais. Peça um novo link a quem administra a comunidade.',
          );
        if (invite[2]) {
          if (!me) throw new ApiError(401, 'UNAUTHENTICATED', 'Você precisa entrar para continuar.');
          return { communityId: 'c-convite', status: 'pending' };
        }
        return { community: { id: 'c-convite', name: 'turma-do-convite' }, intent: null, myStatus: null };
      }
      if (path === '/v1/communities' && init?.method === 'POST') {
        if (init.body!.name === 'ja-existe')
          throw new ApiError(409, 'COMMUNITY_NAME_TAKEN', 'Esse nome já existe. Tente outro.');
        const created: Community = {
          id: `id-${init.body!.name}`,
          slug: init.body!.name!,
          name: init.body!.name!,
          role: 'owner',
        };
        communities = [...communities, created];
        return created;
      }
      const detail = /^\/v1\/communities\/([^/]+)$/.exec(path);
      if (detail) {
        const c = communities.find((x) => x.id === detail[1]);
        if (!c || init?.communityId !== c.id)
          throw new ApiError(403, 'FORBIDDEN', 'Você não tem acesso a esta comunidade.');
        return { ...c, permissions: [] };
      }
      if (path === '/v1/me/profile' && init?.method === 'PATCH') {
        me = { ...me!, displayName: init.body!.displayName!, nameConfirmed: true };
        return me;
      }
      if (path === '/v1/me') {
        if (!me) throw new ApiError(401, 'UNAUTHENTICATED', 'Você precisa entrar para continuar.');
        return me;
      }
      throw new Error(`unexpected ${path}`);
    },
  );
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
      '(auth)/entrar': SignIn,
      '(app)/_layout': AppLayout,
      '(app)/index': Home,
      'onboarding/nome': OnboardingName,
      '(app)/comunidades/index': ChooseCommunity,
      '(app)/comunidades/nova': NewCommunity,
      'convite/[codigo]': InviteScreen,
      'convite/index': EnterInvite,
      '+not-found': NotFound,
    },
    { initialUrl: url },
  );
}

beforeEach(() => jest.clearAllMocks());

test('without a session, a protected route sends to sign-in and keeps the destination', async () => {
  mockMe(null);
  await open('/');
  await screen.findByText('Continuar com Google');
  expect(screen).toHavePathname('/entrar');
  await fireEvent.press(screen.getByText('Continuar com Google'));
  await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledWith('/'));
});

test('sign-in ignores an external destination', async () => {
  mockMe(null);
  await open('/entrar?next=https://evil.example');
  await fireEvent.press(await screen.findByText('Continuar com Google'));
  await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledWith('/'));
});

test('first sign-in asks to confirm the name, validates it and continues', async () => {
  mockMe({ ...baseMe, displayName: 'Ana Souza', nameConfirmed: false });
  await open('/');
  const field = await screen.findByLabelText('Seu nome');
  expect(screen).toHavePathname('/onboarding/nome');
  expect(field.props.value).toBe('Ana Souza');

  await fireEvent.changeText(screen.getByLabelText('Seu nome'), ' a ');
  await fireEvent.press(screen.getByText('Continuar'));
  expect(await screen.findByText('Mínimo 2 caracteres.')).toBeTruthy();
  expect(api).not.toHaveBeenCalledWith('/v1/me/profile', expect.anything());

  await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Aninha');
  await fireEvent.press(screen.getByText('Continuar'));
  expect(await screen.findByText('Você ainda não está em nenhuma comunidade')).toBeTruthy();
  expect(screen.getByText('Aninha')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/v1/me/profile', { method: 'PATCH', body: { displayName: 'Aninha' } });
});

test('signed in: home shows the name and signs out', async () => {
  mockMe(baseMe);
  await open('/');
  expect(await screen.findByText('Ana')).toBeTruthy();
  await fireEvent.press(screen.getByText('Sair'));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  await screen.findByText('Continuar com Google');
});

test('a server error shows a retry instead of a blank screen', async () => {
  api.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Erro inesperado.'));
  await open('/');
  expect(await screen.findByText('Não deu pra carregar sua conta.')).toBeTruthy();
  expect(screen.getByText('Tentar de novo')).toBeTruthy();
});

test('without communities: create one and land on it', async () => {
  mockMe(baseMe);
  await open('/');
  await fireEvent.press(await screen.findByText('Criar comunidade'));
  const field = await screen.findByLabelText('Nome da comunidade');
  await fireEvent.changeText(field, 'Minha Bagunça');
  await fireEvent.press(screen.getByText('Criar comunidade'));
  expect(await screen.findByText(/letras minúsculas, números e hífens/)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Nome da comunidade'), 'ja-existe');
  await fireEvent.press(screen.getByText('Criar comunidade'));
  expect(await screen.findByText('Esse nome já existe. Tente outro.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Nome da comunidade'), 'bagunca');
  await fireEvent.press(screen.getByText('Criar comunidade'));
  expect(await screen.findByText('Seu papel: dono')).toBeTruthy();
  expect(screen.getByRole('header')).toHaveTextContent('bagunca');
  expect(api).toHaveBeenCalledWith('/v1/communities/id-bagunca', { communityId: 'id-bagunca' });
});

test('with several communities: opens the first and switches', async () => {
  mockMe(baseMe, [
    { id: 'a', slug: 'alfa', name: 'alfa', role: 'membro' },
    { id: 'b', slug: 'beta', name: 'beta', role: 'admin' },
  ]);
  await open('/');
  expect(await screen.findByText('Seu papel: membro')).toBeTruthy();
  await fireEvent.press(screen.getByText('Trocar de comunidade'));
  await fireEvent.press(await screen.findByLabelText('beta, seu papel: admin'));
  expect(await screen.findByText('Seu papel: admin')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/v1/communities/b', { communityId: 'b' });
});

test('with one community: no switcher', async () => {
  mockMe(baseMe, [{ id: 'a', slug: 'alfa', name: 'alfa', role: 'owner' }]);
  await open('/');
  expect(await screen.findByText('Seu papel: dono')).toBeTruthy();
  expect(screen.queryByText('Trocar de comunidade')).toBeNull();
});

test('invite without a session: preview, then sign in to ask', async () => {
  mockMe(null);
  await open('/convite/abc');
  expect(await screen.findByText('turma-do-convite')).toBeTruthy();
  await fireEvent.press(screen.getByText('Entrar para pedir'));
  expect(await screen.findByText('Continuar com Google')).toBeTruthy();
  expect(screen).toHavePathname('/entrar');
  await fireEvent.press(screen.getByText('Continuar com Google'));
  await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledWith('/convite/abc'));
});

test('invite with a session: ask to join and wait for approval', async () => {
  mockMe(baseMe);
  await open('/convite/abc');
  await fireEvent.press(await screen.findByText('Pedir para entrar'));
  expect(await screen.findByText('Pedido enviado')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/v1/invites/abc/join', { method: 'POST' });
});

test('revoked invite says so, without a retry', async () => {
  mockMe(baseMe);
  await open('/convite/revogado');
  expect(await screen.findByText(/Esse convite não vale mais/)).toBeTruthy();
  expect(screen.queryByText('Tentar de novo')).toBeNull();
});

const CODE = 'AAAAAAAAAAAAAAAAAAAAAAsegredo12345';

test('without a community: paste the invite link and land on the invite (CORE-07)', async () => {
  mockMe(baseMe);
  await open('/');
  await fireEvent.press(await screen.findByText('Entrar com o código de convite'));
  expect(screen).toHavePathname('/convite');
  const field = screen.getByLabelText('Link ou código do convite');
  await fireEvent.changeText(field, 'olha o convite: nada');
  await fireEvent.press(screen.getByText('Continuar'));
  expect(await screen.findByText(/Isso não parece um convite/)).toBeTruthy();
  await fireEvent.changeText(field, `  https://errometro.app/convite/${CODE}  `);
  await fireEvent.press(screen.getByText('Continuar'));
  expect(await screen.findByText('turma-do-convite')).toBeTruthy();
  expect(screen).toHavePathname(`/convite/${CODE}`);
});

test('an unknown route says so and leads home (CORE-23)', async () => {
  mockMe(baseMe);
  await open('/nao-existe');
  expect(await screen.findByText('Essa página não existe ou mudou de lugar.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Ir para o início'));
  expect(await screen.findByText('Você ainda não está em nenhuma comunidade')).toBeTruthy();
});

test('a render error shows plain words and retries (CORE-23)', async () => {
  const retry = jest.fn(async () => undefined);
  await render(<ErrorBoundary error={new Error('detalhe interno')} retry={retry} />);
  expect(await screen.findByText('Algo deu errado por aqui. Tente de novo.')).toBeTruthy();
  expect(screen.queryByText(/detalhe interno/)).toBeNull();
  await fireEvent.press(screen.getByText('Tentar de novo'));
  expect(retry).toHaveBeenCalled();
});
