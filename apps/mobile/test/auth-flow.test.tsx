import type { Me } from '@erre/core/client';
import { ThemeProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Slot } from 'expo-router';

import AppLayout from '../src/app/(app)/_layout';
import Home from '../src/app/(app)/index';
import SignIn from '../src/app/(auth)/entrar';
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

function mockMe(me: Me | null) {
  api.mockImplementation(async (path: string, init?: { method?: string; body?: { displayName: string } }) => {
    if (path === '/v1/me/profile' && init?.method === 'PATCH') {
      if (init.body!.displayName.length > 32) throw new ApiError(400, 'VALIDATION_ERROR', 'Máximo 32 caracteres.');
      me = { ...me!, displayName: init.body!.displayName, nameConfirmed: true };
      return me;
    }
    if (path === '/v1/me') {
      if (!me) throw new ApiError(401, 'UNAUTHENTICATED', 'Você precisa entrar para continuar.');
      return me;
    }
    throw new Error(`unexpected ${path}`);
  });
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
  expect(await screen.findByText('Oi, Aninha')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/v1/me/profile', { method: 'PATCH', body: { displayName: 'Aninha' } });
});

test('signed in: home shows the name and signs out', async () => {
  mockMe(baseMe);
  await open('/');
  expect(await screen.findByText('Oi, Ana')).toBeTruthy();
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
