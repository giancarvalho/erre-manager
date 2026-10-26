// Errômetro voting UI (Sprint 14): rendered with a fake module host. The issuance side of the blind signature
// is done here with raw RSA, so the client code under test runs for real (blind, unblind, verify).
import { webcrypto } from 'node:crypto';

import { base64UrlToBytes, bigIntToBytes, bytesToBase64Url, bytesToBigInt, modPow } from '@erre/anon-vote/client';
import { ModuleHostProvider, type HostStorage, type ModuleHost } from '@erre/core/client';
import errometroUi, { VoteScreen } from '@erre/errometro/ui';
import { ThemeProvider, ToastProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const API = 'http://api.test';
const COMMUNITY = '11111111-1111-4111-8111-111111111111';
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

type Jwk = { kty: string; n: string; e: string; d: string };
let keys: { publicKeyJwk: { kty: 'RSA'; n: string; e: string }; d: bigint; n: bigint };

beforeAll(async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-384' },
    true,
    ['sign', 'verify'],
  );
  const jwk = (await webcrypto.subtle.exportKey('jwk', pair.privateKey)) as Jwk;
  keys = {
    publicKeyJwk: { kty: 'RSA', n: jwk.n, e: jwk.e },
    d: bytesToBigInt(base64UrlToBytes(jwk.d)),
    n: bytesToBigInt(base64UrlToBytes(jwk.n)),
  };
});

/** Raw RSA blind signature, as the server's library does it. */
function blindSign(blindedMsgB64: string): string {
  const s = modPow(bytesToBigInt(base64UrlToBytes(blindedMsgB64)), keys.d, keys.n);
  return bytesToBase64Url(bigIntToBytes(s, 256));
}

function memoryStorage(): HostStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Participation = { status: string | null; full: boolean; approvedCount: number; limit: number };

function round(participation: Partial<Participation> = {}) {
  return {
    period: { label: '2026-11-02', from: '2026-10-26T15:00:00.000Z', to: '2026-11-02T15:00:00.000Z' },
    cadence: {
      config: { frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 },
      isDefault: true,
      description: 'Toda segunda às 12h',
      nextRelease: { at: '2026-11-02T15:00:00.000Z', label: 'segunda, 12h' },
    },
    emojis: [
      {
        id: 'coracao',
        char: '❤️',
        label: 'Coração',
        trophyName: 'T',
        isCustom: false,
        description: 'Querido.',
        glowRgb: '1 2 3',
      },
      {
        id: 'cobra',
        char: '🐍',
        label: 'Cobra',
        trophyName: 'T',
        isCustom: false,
        description: 'Falso.',
        glowRgb: '1 2 3',
      },
    ],
    targets: [
      { userId: 'me', displayName: 'Eu Mesma', avatarVariant: 'teal' },
      { userId: 'ana', displayName: 'Ana', avatarVariant: 'rose' },
      { userId: 'bia', displayName: 'Bia', avatarVariant: 'sky' },
    ],
    participation: { status: 'approved', full: false, approvedCount: 3, limit: 50, ...participation },
    viewerId: 'me',
  };
}

type Setup = {
  round?: ReturnType<typeof round>;
  tokenStatus?: number;
  storedToken?: boolean;
  remembered?: Record<string, string>;
};

function setup({ round: r = round(), tokenStatus = 200, remembered }: Setup = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const hostFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ...(init ? { init } : {}) });
    if (url.endsWith('/rodada')) return json(r);
    if (url.endsWith('/participacao')) return json({ status: 'pending', justRequested: true });
    if (url.endsWith('/chave')) return json({ period: r.period.label, publicKeyJwk: keys.publicKeyJwk });
    if (url.endsWith('/token')) {
      if (tokenStatus !== 200) return json({ code: 'TOKEN_ALREADY_ISSUED', message: 'x' }, tokenStatus);
      const { blindedMsgB64 } = JSON.parse(String(init?.body)) as { blindedMsgB64: string };
      return json({ period: r.period.label, blindSignatureB64: blindSign(blindedMsgB64) });
    }
    throw new Error(`unexpected host fetch ${url}`);
  }) as unknown as typeof fetch;

  const anon: { url: string; init: RequestInit }[] = [];
  const globalFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    anon.push({ url, init: init ?? {} });
    if (url.endsWith('/votos')) return json({ status: 'inserted' });
    if (url.endsWith('/meus-votos')) return json({ period: r.period.label, votes: { ana: 'cobra' } });
    throw new Error(`unexpected anonymous fetch ${url}`);
  });
  global.fetch = globalFetch as unknown as typeof fetch;

  const storage = memoryStorage();
  const secureStorage = memoryStorage();
  if (remembered) storage.data.set(`errometro.lastvotes.${COMMUNITY}`, JSON.stringify(remembered));
  const host: ModuleHost = {
    community: { id: COMMUNITY, name: 'turma', role: 'membro' },
    apiUrl: API,
    webUrl: 'http://web.test',
    fetch: hostFetch,
    navigate: jest.fn(),
    back: jest.fn(),
    storage,
    secureStorage,
  };
  // gcTime Infinity: TanStack's garbage-collection timers would keep Jest from exiting.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const wrap = (children: ReactNode) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <ModuleHostProvider host={host}>{children}</ModuleHostProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return { calls, anon, storage, secureStorage, wrap, qc };
}

describe('voting screen', () => {
  it('lists the others (never the viewer), toggles emojis and counts the votes', async () => {
    const { wrap } = setup();
    await render(wrap(<VoteScreen />));
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.queryByText('Eu Mesma')).toBeNull();
    expect(screen.getByText('Escolha pelo menos um emoji para continuar.')).toBeTruthy();

    const cobraForAna = screen.getByLabelText('Cobra: Falso., para Ana');
    await fireEvent.press(cobraForAna);
    expect(screen.getByLabelText('Cobra: Falso., para Ana')).toBeSelected();
    expect(screen.getByText('1 de 2 pessoas votadas')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cobra: Falso., para Ana'));
    expect(screen.getByLabelText('Cobra: Falso., para Ana')).not.toBeSelected();
  });

  it('sends the ballot anonymously: no cookie, no Authorization, no community header, credentials omitted', async () => {
    const { wrap, anon, calls, secureStorage, storage } = setup();
    await render(wrap(<VoteScreen />));
    await fireEvent.press(await screen.findByLabelText('Coração: Querido., para Bia'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar votos' }));
    expect(await screen.findByText('Votos enviados.')).toBeTruthy();

    // Issuance went through the authenticated host client...
    expect(calls.map((c) => c.url)).toEqual(
      expect.arrayContaining([`${API}/v1/errometro/chave`, `${API}/v1/errometro/token`]),
    );
    // ...and the ballot through a plain fetch with no identity at all.
    const ballot = anon.find((a) => a.url === `${API}/v1/errometro/anon/c/${COMMUNITY}/votos`)!;
    expect(ballot.init.credentials).toBe('omit');
    const headers = Object.keys((ballot.init.headers ?? {}) as Record<string, string>).map((h) => h.toLowerCase());
    expect(headers).toEqual(['content-type']);
    const body = JSON.parse(String(ballot.init.body)) as { votes: Record<string, string>; preparedMsgB64: string };
    expect(body.votes).toEqual({ bia: 'coracao' });
    expect(Object.keys(body).sort()).toEqual(['preparedMsgB64', 'signatureB64', 'votes']);

    // The token stays on the device; the votes are remembered for next round; the button now updates.
    const stored = JSON.parse(secureStorage.data.get(`errometro.vtoken.${COMMUNITY}.2026-11-02`)!) as {
      voterTag: string;
    };
    expect(stored.voterTag).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(storage.data.get(`errometro.lastvotes.${COMMUNITY}`)!)).toEqual({ bia: 'coracao' });
    expect(screen.getByRole('button', { name: 'Atualizar votos' })).toBeTruthy();
    expect(screen.getByText('Você já votou nesta rodada.')).toBeTruthy();

    // "Problemas com seu voto?" shows the code only this device has.
    await fireEvent.press(screen.getByRole('button', { name: 'Problemas com seu voto?' }));
    expect(screen.getByText(stored.voterTag)).toBeTruthy();
  });

  it('with a token on this device: loads my votes by the code, anonymously', async () => {
    const { wrap, secureStorage, anon } = setup();
    secureStorage.data.set(
      `errometro.vtoken.${COMMUNITY}.2026-11-02`,
      JSON.stringify({ preparedMsgB64: 'p', signatureB64: 's', voterTag: 'a'.repeat(64) }),
    );
    await render(wrap(<VoteScreen />));
    await waitFor(() => expect(screen.getByLabelText('Cobra: Falso., para Ana')).toBeSelected());
    const mine = anon.find((a) => a.url.endsWith('/meus-votos'))!;
    expect(mine.init.credentials).toBe('omit');
    expect(JSON.parse(String(mine.init.body))).toEqual({ voterTag: 'a'.repeat(64) });
  });

  it('prefills with last round’s votes, dropping people and emojis that are gone', async () => {
    const { wrap } = setup({ remembered: { ana: 'coracao', saiu: 'cobra', bia: 'emoji-removido' } });
    await render(wrap(<VoteScreen />));
    expect(await screen.findByText('Pré-preenchido com seus votos da rodada passada.')).toBeTruthy();
    expect(screen.getByLabelText('Coração: Querido., para Ana')).toBeSelected();
    expect(screen.getByText('1 de 2 pessoas votadas')).toBeTruthy();
  });

  it('a token already taken elsewhere locks the screen and says why', async () => {
    const { wrap } = setup({ tokenStatus: 409 });
    await render(wrap(<VoteScreen />));
    await fireEvent.press(await screen.findByLabelText('Coração: Querido., para Bia'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar votos' }));
    expect(await screen.findByText(/Você já votou nesta rodada em outro aparelho/)).toBeTruthy();
    expect(screen.getByText('Cada pessoa vota uma vez por rodada.')).toBeTruthy();
  });

  it('someone who does not vote sees the state and can ask to participate', async () => {
    const { wrap, calls } = setup({ round: round({ status: null }) });
    await render(wrap(<VoteScreen />));
    expect(await screen.findByText('Você ainda não participa da votação desta comunidade.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Quero participar do Errômetro' }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/participacao') && c.init?.method === 'POST')).toBe(true),
    );
  });

  it('explains the queue when the 50-voter cap is full', async () => {
    const { wrap } = setup({ round: round({ status: 'pending', full: true, approvedCount: 50 }) });
    await render(wrap(<VoteScreen />));
    expect(await screen.findByText(/Pedido na fila: o Errômetro já tem 50 votantes/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quero participar do Errômetro' })).toBeNull();
  });
});

describe('hub section', () => {
  it('shows the cadence and the participation state', async () => {
    const { wrap } = setup({ round: round({ status: 'pending' }) });
    const Section = errometroUi.hubSection!;
    await render(wrap(<Section community={{ id: COMMUNITY, name: 'turma', role: 'membro' }} />));
    expect(await screen.findByText('Toda segunda às 12h. Próximo resultado: segunda, 12h.')).toBeTruthy();
    expect(screen.getByText('Pedido enviado. Falta a aprovação de quem administra a comunidade.')).toBeTruthy();
  });
});

afterEach(() => act(() => undefined));
