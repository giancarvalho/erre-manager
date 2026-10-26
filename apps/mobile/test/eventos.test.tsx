// Eventos UI (Sprint 17): rendered with a fake module host. The issuance side of the blind signature is done here
// with raw RSA, so the client code under test runs for real (blind, unblind, verify).
import { webcrypto } from 'node:crypto';

import { base64UrlToBytes, bigIntToBytes, bytesToBase64Url, bytesToBigInt, modPow } from '@erre/anon-vote/client';
import { ModuleHostProvider, type HostStorage, type ModuleHost } from '@erre/core/client';
import eventosUi, { EventScreen, EventsScreen, ResultsScreen, VoteScreen } from '@erre/eventos/ui';
import { ThemeProvider, ToastProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const API = 'http://api.test';
const COMMUNITY = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
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

const blindSign = (blindedMsgB64: string) =>
  bytesToBase64Url(bigIntToBytes(modPow(bytesToBigInt(base64UrlToBytes(blindedMsgB64)), keys.d, keys.n), 256));

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

function view(over: Record<string, unknown> = {}) {
  return {
    id: EVENT,
    title: 'Churrasco',
    description: null,
    votingType: 'categorical',
    status: 'open',
    releaseMode: 'manual',
    scheduledOpenAt: null,
    scheduledReleaseAt: null,
    bannerRgb: '139 92 246',
    createdAt: '2026-05-01T12:00:00.000Z',
    openedAt: '2026-05-01T13:00:00.000Z',
    closedAt: null,
    ...over,
  };
}

const CATEGORICAL = [
  {
    id: 'coracao',
    char: '❤️',
    label: 'Coração',
    trophyName: 'Mais Amado',
    isCustom: false,
    description: 'Querido.',
    glowRgb: '1 2 3',
    scaleMax: null,
  },
  {
    id: 'cobra',
    char: '🐍',
    label: 'Cobra',
    trophyName: 'Mais Cobra',
    isCustom: false,
    description: 'Falso.',
    glowRgb: '1 2 3',
    scaleMax: null,
  },
];
const SCALE = [
  { ...CATEGORICAL[0]!, scaleMax: 5 },
  { ...CATEGORICAL[1]!, scaleMax: 1 },
];

function detail(over: Record<string, unknown> = {}, eventOver: Record<string, unknown> = {}) {
  return {
    event: view(eventOver),
    emojis: eventOver.votingType === 'scale' ? SCALE : CATEGORICAL,
    participants: [
      { userId: 'ana', displayName: 'Ana', avatarVariant: 'rose' },
      { userId: 'bia', displayName: 'Bia', avatarVariant: 'sky' },
      { userId: 'me', displayName: 'Eu Mesma', avatarVariant: 'teal' },
    ],
    participating: true,
    viewerId: 'me',
    canVote: true,
    canEdit: false,
    canModerate: false,
    ...over,
  };
}

type Routes = Record<string, (init?: RequestInit) => Response>;

function setup(routes: Routes = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const hostFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    calls.push({ method, url, body });
    const path = url.replace(`${API}/v1/eventos`, '');
    const handler = routes[`${method} ${path}`];
    if (handler) return handler(init);
    if (path === `/${EVENT}/chave`) return json({ eventId: EVENT, publicKeyJwk: keys.publicKeyJwk });
    if (path === `/${EVENT}/token`)
      return json({ eventId: EVENT, blindSignatureB64: blindSign((body as { blindedMsgB64: string }).blindedMsgB64) });
    throw new Error(`unexpected host fetch ${method} ${url}`);
  }) as unknown as typeof fetch;

  const anon: { url: string; init: RequestInit }[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    anon.push({ url, init: init ?? {} });
    if (url.endsWith('/votos')) return json({ status: 'inserted' });
    if (url.endsWith('/meus-votos')) return json({ votes: [] });
    throw new Error(`unexpected anonymous fetch ${url}`);
  }) as unknown as typeof fetch;

  const host: ModuleHost = {
    community: { id: COMMUNITY, name: 'turma', role: 'membro' },
    apiUrl: API,
    webUrl: 'http://web.test',
    fetch: hostFetch,
    navigate: jest.fn(),
    back: jest.fn(),
    openMember: jest.fn(),
    storage: memoryStorage(),
    secureStorage: memoryStorage(),
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
  return { calls, anon, host, wrap };
}

const list = (events: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
  events: events.map((e) => ({ participantCount: 2, participating: false, ...view(e) })),
  canCreate: false,
  canModerate: false,
  ...over,
});

describe('hub section', () => {
  it('highlights the open event with the event color and goes to the ballot', async () => {
    const { wrap, host } = setup({ 'GET ': () => json(list([{ status: 'open' }])) });
    const Section = eventosUi.hubSection!;
    await render(wrap(<Section community={host.community} />));
    expect(await screen.findByText('Votação aberta: Churrasco')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Votar agora' }));
    expect(host.navigate).toHaveBeenCalledWith(`/eventos/${EVENT}/votar`);
  });

  it('a closed event stays 2 days; after that only the way to the list', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    const { wrap, host } = setup({ 'GET ': () => json(list([{ status: 'closed', closedAt: recent }])) });
    const Section = eventosUi.hubSection!;
    await render(wrap(<Section community={host.community} />));
    expect(await screen.findByText('Votação encerrada: Churrasco')).toBeTruthy();

    const old = new Date(Date.now() - 3 * 24 * 3_600_000).toISOString();
    const second = setup({ 'GET ': () => json(list([{ status: 'closed', closedAt: old }])) });
    await render(second.wrap(<Section community={second.host.community} />));
    expect(await screen.findByText('Votações únicas, além do Errômetro de sempre.')).toBeTruthy();
  });
});

describe('events list', () => {
  it('members see published events with status and no create button', async () => {
    const { wrap, host } = setup({
      'GET ': () =>
        json(
          list([
            { status: 'closed', closedAt: '2026-05-02T20:00:00.000Z' },
            { id: 'x', status: 'open', title: 'Festa' },
          ]),
        ),
    });
    await render(wrap(<EventsScreen />));
    expect(await screen.findByText('Festa')).toBeTruthy();
    expect(screen.getByText('Em votação')).toBeTruthy();
    expect(screen.getByText('Encerrado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Novo evento' })).toBeNull();
    await fireEvent.press(screen.getByLabelText('Churrasco, Encerrado'));
    expect(host.navigate).toHaveBeenCalledWith(`/eventos/${EVENT}/resultados`);
  });

  it('the wizard creates a scale draft in 4 steps, checking each one', async () => {
    const created = view({ status: 'draft', votingType: 'scale' });
    const { wrap, calls, host } = setup({
      'GET ': () => json(list([], { canCreate: true, canModerate: true })),
      'POST ': () => json(created, 201),
      [`PUT /${EVENT}/emojis`]: () => json({ emojis: SCALE }),
      [`PATCH /${EVENT}`]: () => json(created),
    });
    await render(wrap(<EventsScreen />));
    expect(await screen.findByText('Nenhum evento criado ainda.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Novo evento' }));
    expect(screen.getByText('Novo evento · passo 1 de 4')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Título precisa ter entre 1 e 64 caracteres.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Quão sortudo?');
    await fireEvent.press(screen.getByLabelText('Escala'));
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByText('Eixos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Escolha pelo menos 1 emoji.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Adicionar Coração'));
    await fireEvent.press(screen.getByLabelText('Aumentar intensidade máxima de coração'));
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));

    await fireEvent.press(screen.getByRole('tab', { name: 'Agendado' }));
    await fireEvent.changeText(screen.getByLabelText('Abre em (data)'), '31/02/2030');
    await fireEvent.changeText(screen.getByLabelText('Abre em (hora)'), '20:00');
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('Data de abertura inválida. Use dd/mm/aaaa e hh:mm.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Manual' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByText('Cor do banner')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Verde'));
    await fireEvent.press(screen.getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => expect(host.navigate).toHaveBeenCalledWith(`/eventos/${EVENT}`));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ title: 'Quão sortudo?', votingType: 'scale', releaseMode: 'manual' });
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({
      entries: [{ isCustom: false, emojiId: 'coracao', scaleMax: 6 }],
    });
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ bannerRgb: '34 197 94' });
  });
});

describe('event screen', () => {
  it('a member who has not signed up joins; then waits for voting to open', async () => {
    let joined = false;
    const { wrap, calls } = setup({
      [`GET /${EVENT}`]: () => json(detail({ participating: joined }, { status: 'accepting_applications' })),
      [`POST /${EVENT}/inscricao`]: () => ((joined = true), json({ participating: true })),
    });
    await render(wrap(<EventScreen id={EVENT} />));
    expect(await screen.findByText('3 pessoas inscritas')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Participar do evento' }));
    expect(await screen.findByText('Você já está confirmado!')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/inscricao'))).toBe(true);
  });

  it('moderators publish and delete, each after a confirmation', async () => {
    const { wrap, calls, host } = setup({
      [`GET /${EVENT}`]: () => json(detail({ canEdit: true, canModerate: true }, { status: 'draft' })),
      [`POST /${EVENT}/publicar`]: () => json(view({ status: 'accepting_applications' })),
      [`DELETE /${EVENT}`]: () => json({ ok: true }),
      'GET ': () => json(list([])),
    });
    await render(wrap(<EventScreen id={EVENT} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar evento' }));
    expect(screen.getByText('Publicar o evento?')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Publicar evento' }).at(-1)!);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/publicar'))).toBe(true));

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir evento' }));
    expect(screen.getByText('Excluir o evento?')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Excluir evento' }).at(-1)!);
    await waitFor(() => expect(host.navigate).toHaveBeenCalledWith('/eventos'));
  });
});

describe('voting', () => {
  it('categorical: never the viewer; the ballot goes with no identity at all', async () => {
    const { wrap, anon } = setup({ [`GET /${EVENT}`]: () => json(detail()) });
    await render(wrap(<VoteScreen id={EVENT} />));
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.queryByText('Eu Mesma')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Cobra: Falso., para Ana'));
    expect(screen.getByText('1 de 2 pessoas votadas')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar votos' }));
    expect(await screen.findByText('Votos registrados!')).toBeTruthy();
    const ballot = anon.find((a) => a.url === `${API}/v1/eventos/anon/c/${COMMUNITY}/${EVENT}/votos`)!;
    expect(ballot.init.credentials).toBe('omit');
    expect(Object.keys(ballot.init.headers as Record<string, string>)).toEqual(['content-type']);
    expect((JSON.parse(String(ballot.init.body)) as { votes: unknown }).votes).toEqual([
      { targetId: 'ana', emojiId: 'cobra' },
    ]);
  });

  it('scale: one row of pips per axis; tapping the current value clears it', async () => {
    const { wrap, anon } = setup({ [`GET /${EVENT}`]: () => json(detail({}, { votingType: 'scale' })) });
    await render(wrap(<VoteScreen id={EVENT} />));
    await fireEvent.press(await screen.findByLabelText('Coração: 4 de 5, para Bia'));
    expect(screen.getByLabelText('Coração: 4 de 5, para Bia')).toHaveProp('aria-pressed', true);
    await fireEvent.press(screen.getByLabelText('Cobra: 1 de 1, para Ana'));
    await fireEvent.press(screen.getByLabelText('Cobra: 1 de 1, para Ana'));
    expect(screen.getByText('1 de 2 pessoas votadas')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar votos' }));
    await screen.findByText('Votos registrados!');
    const ballot = anon.find((a) => a.url.endsWith('/votos'))!;
    expect((JSON.parse(String(ballot.init.body)) as { votes: unknown }).votes).toEqual([
      { targetId: 'bia', emojiId: 'coracao', value: 4 },
    ]);
  });

  it('before voting opens, explains it instead of a ballot', async () => {
    const { wrap } = setup({ [`GET /${EVENT}`]: () => json(detail({}, { status: 'accepting_applications' })) });
    await render(wrap(<VoteScreen id={EVENT} />));
    expect(await screen.findByText('Esse evento ainda não abriu para votos.')).toBeTruthy();
  });
});

describe('results', () => {
  it('scale: trophies, one ranking per axis in percent (×N on a ceiling-1 axis)', async () => {
    const result = {
      votingType: 'scale',
      targets: [
        {
          targetId: 'ana',
          byEmoji: [
            { emojiId: 'coracao', average: 4, sum: 12, voteCount: 3 },
            { emojiId: 'cobra', average: 1, sum: 3, voteCount: 3 },
          ],
        },
        { targetId: 'bia', byEmoji: [{ emojiId: 'coracao', average: 2.5, sum: 5, voteCount: 2 }] },
      ],
      trophies: [
        { emojiId: 'cobra', average: 3, winnerTargetId: 'ana', tiedTargetIds: [] },
        { emojiId: 'coracao', average: 4, winnerTargetId: 'ana', tiedTargetIds: [] },
      ],
    };
    const closed = { status: 'closed', closedAt: '2026-05-02T20:00:00.000Z', votingType: 'scale' };
    const { wrap } = setup({
      [`GET /${EVENT}`]: () => json(detail({}, closed)),
      [`GET /${EVENT}/resultados`]: () =>
        json({
          event: view(closed),
          emojis: SCALE,
          result,
          releasedAt: '2026-05-02T20:00:00.000Z',
          people: {
            ana: { displayName: 'Ana', avatarVariant: 'rose' },
            bia: { displayName: 'Bia', avatarVariant: 'sky' },
          },
        }),
    });
    await render(wrap(<ResultsScreen id={EVENT} />));
    expect(await screen.findByText('Troféus deste evento')).toBeTruthy();
    expect(screen.getByLabelText('Mais Amado: Ana, 80%')).toBeTruthy();
    expect(screen.getByLabelText('Mais Cobra: Ana, ×3')).toBeTruthy();
    expect(screen.getByLabelText(/^2º lugar, Bia, 50%/)).toBeTruthy();
    expect(screen.getByLabelText(/^1º lugar, Ana, ×3/)).toBeTruthy();
  });
});
