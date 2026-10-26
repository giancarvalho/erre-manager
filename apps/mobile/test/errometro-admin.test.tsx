// Errômetro results and administration (Sprint 15), rendered with a fake module host.
import { ModuleHostProvider, type HostStorage, type ModuleHost } from '@erre/core/client';
import errometroUi, { AdminScreen, ResultsScreen } from '@erre/errometro/ui';
import { ThemeProvider, ToastProvider } from '@erre/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const API = 'http://api.test';
const C = '11111111-1111-4111-8111-111111111111';
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const storage: HostStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const round = (canModerate: boolean) => ({
  period: { label: '2026-11-09', from: '2026-11-02T15:00:00.000Z', to: '2026-11-09T15:00:00.000Z' },
  cadence: {
    config: { frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 },
    isDefault: true,
    description: 'Toda segunda às 12h',
    nextRelease: { at: '2026-11-09T15:00:00.000Z', label: 'segunda, 12h' },
  },
  emojis: [],
  targets: [],
  participation: { status: 'approved', full: false, approvedCount: 2, limit: 50 },
  viewerId: 'me',
  canModerate,
});

const results = (period: string) => ({
  days: ['2026-11-02', '2026-10-26'],
  period,
  ranking: [
    {
      member: { userId: 'ana', displayName: 'Ana', avatarVariant: 'rose' },
      byEmoji: [{ emojiId: 'coracao', char: '❤️', count: period === '2026-11-02' ? 3 : 1 }],
      total: period === '2026-11-02' ? 3 : 1,
      trophies: { wins: period === '2026-11-02' ? [{ emojiId: 'coracao' }] : [], nearMisses: [] },
    },
    {
      member: { userId: 'me', displayName: 'Eu', avatarVariant: 'teal' },
      byEmoji: [],
      total: 0,
      trophies: { wins: [], nearMisses: [] },
    },
  ],
  trophies:
    period === '2026-11-02'
      ? [
          {
            emojiId: 'coracao',
            count: 3,
            winnerTargetId: 'ana',
            tiedTargetIds: [],
            char: '❤️',
            trophyName: 'Troféu Amado',
          },
        ]
      : [],
  commentCounts: { ana: 1 },
  nextReleaseAt: '2026-11-09T15:00:00.000Z',
  hiddenCount: null,
});

type Call = { url: string; method: string; body: unknown };

function setup(routes: (call: Call) => Response | undefined, canModerate = true) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: String(input).replace(`${API}/v1/errometro`, ''),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    if (call.url === '/rodada') return json(round(canModerate));
    const res = routes(call);
    if (!res) throw new Error(`unexpected ${call.method} ${call.url}`);
    return res;
  }) as unknown as typeof fetch;
  const host: ModuleHost = {
    community: { id: C, name: 'turma', role: 'owner' },
    apiUrl: API,
    webUrl: 'http://web.test',
    fetch: fetchImpl,
    navigate: jest.fn(),
    back: jest.fn(),
    storage,
    secureStorage: storage,
  };
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
  return { calls, host, wrap };
}

describe('results', () => {
  it('shows the latest round: ranking, trophies, and moves between rounds', async () => {
    const { wrap, calls } = setup((c) => {
      if (c.url.startsWith('/resultados')) {
        const period = new URL(`http://x${c.url}`).searchParams.get('rodada') ?? '2026-11-02';
        return json(results(period));
      }
    });
    await render(wrap(<ResultsScreen />));
    expect(await screen.findByText('Rodada de 2 de novembro de 2026')).toBeTruthy();
    expect(screen.getByText('Troféus da rodada')).toBeTruthy();
    expect(screen.getByLabelText(/1º lugar, Ana, 3 votos.*Troféu Amado/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Próxima ›' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: '‹ Anterior' }));
    expect(await screen.findByText('Rodada de 26 de outubro de 2026')).toBeTruthy();
    expect(calls.some((c) => c.url === '/resultados?rodada=2026-10-26')).toBe(true);
    expect(screen.queryByText('Troféus da rodada')).toBeNull();
  });

  it('nothing closed yet: says when the next result comes out', async () => {
    const { wrap } = setup((c) =>
      c.url.startsWith('/resultados')
        ? json({
            days: [],
            period: null,
            ranking: [],
            trophies: [],
            commentCounts: {},
            nextReleaseAt: null,
            hiddenCount: 0,
          })
        : undefined,
    );
    await render(wrap(<ResultsScreen />));
    expect(await screen.findByText('Nenhum resultado disponível ainda. O próximo sai segunda, 12h.')).toBeTruthy();
  });

  it('comments: open, write, delete with confirmation', async () => {
    const comments = [
      {
        id: 'c1',
        targetId: 'ana',
        authorId: 'me',
        authorName: 'Eu',
        period: '2026-11-02',
        text: 'Mereceu',
        createdAt: 'x',
        updatedAt: null,
      },
    ];
    const { wrap, calls } = setup((c) => {
      if (c.url.startsWith('/resultados')) return json(results('2026-11-02'));
      if (c.url.startsWith('/comentarios?')) return json(comments);
      if (c.url === '/comentarios' && c.method === 'POST')
        return json({ ...comments[0], id: 'c2', text: 'Brabo' }, 201);
      if (c.url === '/comentarios/c1' && c.method === 'DELETE') return json({ ok: true });
    });
    await render(wrap(<ResultsScreen />));
    await fireEvent.press(await screen.findByRole('button', { name: '1 comentário' }));
    expect(await screen.findByText('Mereceu')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Comentar sobre Ana'), '  Brabo ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar comentário' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url === '/comentarios' && c.method === 'POST')?.body).toEqual({
        targetId: 'ana',
        period: '2026-11-02',
        text: 'Brabo',
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Apagar comentário' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/comentarios/c1' && c.method === 'DELETE')).toBe(true));
  });
});

describe('administration', () => {
  function adminRoutes(c: Call) {
    if (c.url === '/participantes')
      return json([
        { userId: 'ana', displayName: 'Ana', avatarVariant: 'rose', status: 'pending', requestedAt: 'x' },
        { userId: 'bia', displayName: 'Bia', avatarVariant: 'sky', status: 'approved', requestedAt: 'x' },
      ]);
    if (c.url.startsWith('/participantes/')) return json({ status: 'ok' });
    if (c.url === '/rodadas')
      return json({
        closed: [{ period: '2026-11-02', hidden: false, releasedAt: 'x', notified: true }],
        withVotes: [{ period: '2026-11-09', voteCount: 4, voterCount: 2 }],
      });
    if (c.url === '/rodada/liberar') return json({ period: '2026-11-09', targetCount: 2 });
    if (c.url.endsWith('/ocultar')) return json({ period: '2026-11-02', hidden: true });
    if (c.url === '/votos/anular') return json({ deletedCount: 2 });
    if (c.url === '/config/cadencia' && c.method === 'GET')
      return json({
        config: { frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 },
        isDefault: true,
        description: 'Toda segunda às 12h',
      });
    if (c.url === '/config/cadencia')
      return json({ roundClosedEarly: true, config: {}, isDefault: false, description: 'x' });
    if (c.url === '/config/emojis' && c.method === 'GET')
      return json({
        active: [
          {
            id: 'coracao',
            char: '❤️',
            label: 'Coração',
            trophyName: 'T',
            isCustom: false,
            description: null,
            glowRgb: '1 2 3',
          },
        ],
        inactiveCustom: [],
      });
    if (c.url === '/config/emojis') return json({ active: [] });
  }

  it('is only for moderators', async () => {
    const { wrap } = setup(adminRoutes, false);
    await render(wrap(<AdminScreen />));
    expect(await screen.findByText('Só quem administra a comunidade mexe no Errômetro.')).toBeTruthy();
  });

  it('voters: approve right away, remove after confirming', async () => {
    const { wrap, calls } = setup(adminRoutes);
    await render(wrap(<AdminScreen />));
    expect(await screen.findByText('1 de 50 votantes.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Aprovar Ana' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/participantes/ana/aprovar')).toBe(true));
    await fireEvent.press(screen.getByRole('button', { name: 'Remover da votação' }));
    expect(calls.some((c) => c.url === '/participantes/bia/remover')).toBe(false);
    await fireEvent.press(await screen.findByRole('button', { name: 'Remover Bia' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/participantes/bia/remover')).toBe(true));
  });

  it('rounds: release now and hide ask first; the open round can only be recomputed', async () => {
    const { wrap, calls } = setup(adminRoutes);
    await render(wrap(<AdminScreen />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Liberar resultado agora' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Liberar resultado' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/rodada/liberar')).toBe(true));

    const closed = await screen.findByText('Rodada de 2 de novembro de 2026');
    expect(closed).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Esconder' })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Esconder' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Esconder rodada' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url === '/rodadas/2026-11-02/ocultar')?.body).toEqual({ hidden: true }),
    );
  });

  it('annul: validates the code, confirms, reports how many votes went away', async () => {
    const { wrap, calls } = setup(adminRoutes);
    await render(wrap(<AdminScreen />));
    const field = await screen.findByLabelText('Código do voto');
    await fireEvent.changeText(field, 'abc');
    expect(screen.getByText('O código tem 64 letras e números.')).toBeTruthy();
    await fireEvent.changeText(field, ` ${'A'.repeat(64)} `);
    await fireEvent.press(screen.getByRole('button', { name: 'Anular voto' }));
    const dialog = await screen.findByText('Anular este voto?');
    expect(dialog).toBeTruthy();
    const confirm = screen.getAllByRole('button', { name: 'Anular voto' }).at(-1)!;
    await fireEvent.press(confirm);
    expect(await screen.findByText('2 votos anulados.')).toBeTruthy();
    expect(calls.find((c) => c.url === '/votos/anular')?.body).toEqual({ voterTag: 'a'.repeat(64) });
  });

  it('cadence: legacy weekly shows as Monday; saving asks first and sends days and hour', async () => {
    const { wrap, calls } = setup(adminRoutes);
    await render(wrap(<AdminScreen />));
    await screen.findByLabelText('Segunda-feira');
    await waitFor(() => expect(screen.getByLabelText('Segunda-feira').props['aria-pressed']).toBe(true));
    await fireEvent.press(screen.getByLabelText('Sexta-feira'));
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar hora' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar cadência' }));
    const buttons = await screen.findAllByRole('button', { name: 'Salvar cadência' });
    await fireEvent.press(buttons.at(-1)!);
    await waitFor(() =>
      expect(calls.find((c) => c.url === '/config/cadencia' && c.method === 'PUT')?.body).toEqual({
        config: { frequency: 'custom', releaseHour: 13, releaseWeekdays: [1, 5] },
      }),
    );
  });

  it('emojis: add from the catalog, create one, save the full list in order', async () => {
    const { wrap, calls } = setup(adminRoutes);
    await render(wrap(<AdminScreen />));
    await fireEvent.press(await screen.findByLabelText('Adicionar Cobra'));
    await fireEvent.changeText(screen.getByLabelText('Emoji'), '🦄🐍');
    await fireEvent.changeText(screen.getByLabelText('Nome do emoji'), 'Unicórnio');
    await fireEvent.changeText(screen.getByLabelText('Nome do troféu'), 'Troféu Mágico');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar emoji' }));
    expect(screen.getByText('O emoji precisa ser um único emoji (nada de texto colado).')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Emoji'), '🦄');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar emoji' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar emojis' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url === '/config/emojis' && c.method === 'PUT')?.body).toEqual({
        entries: [
          { isCustom: false, emojiId: 'coracao' },
          { isCustom: false, emojiId: 'cobra' },
          { isCustom: true, char: '🦄', label: 'Unicórnio', trophyName: 'Troféu Mágico', glowRgb: '245 158 11' },
        ],
      }),
    );
  });
});

describe('profile section', () => {
  it('renders the trophies of a member', async () => {
    const Section = errometroUi.profileSections!['errometro.trofeus']!;
    const { wrap } = setup(() => undefined);
    await render(
      wrap(
        <Section
          userId="ana"
          data={[{ emojiId: 'coracao', char: '❤️', trophyName: 'Troféu Amado', glowRgb: '1 2 3', winCount: 2 }]}
        />,
      ),
    );
    expect(screen.getByLabelText('Troféu Amado, 2 vezes')).toBeTruthy();
  });
});
