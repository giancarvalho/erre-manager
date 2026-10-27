// Mural de avisos UI with a fake host: the API answers are the routes below (paths relative to /v1/avisos).
import moduleUi, { AvisosScreen } from '@erre/avisos/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { fakeModuleHost, json } from './helpers/module-host';

const AVISO = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Treino cancelado',
  body: 'Choveu, a quadra alagou.',
  createdAt: '2026-05-01T12:00:00.000Z',
  author: { userId: 'u1', displayName: 'Ana', avatarVariant: 'indigo' },
};

describe('Mural de avisos', () => {
  it('hub section shows the latest notice', async () => {
    const { wrap, host } = fakeModuleHost('avisos', { 'GET ': () => json({ avisos: [AVISO], canPublish: false }) });
    const Section = moduleUi.hubSection!;
    await render(wrap(<Section community={host.community} />));
    expect(await screen.findByText('Último aviso: Treino cancelado')).toBeTruthy();
  });

  it('a member reads the notices without the form or the delete button', async () => {
    const { wrap } = fakeModuleHost('avisos', { 'GET ': () => json({ avisos: [AVISO], canPublish: false }) });
    await render(wrap(<AvisosScreen />));
    expect(await screen.findByText('Treino cancelado')).toBeTruthy();
    expect(screen.getByText('Choveu, a quadra alagou.')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.queryByLabelText('Título')).toBeNull();
    expect(screen.queryByText('Apagar')).toBeNull();
  });

  it('a notice whose author left shows "Ex-membro"', async () => {
    const { wrap } = fakeModuleHost('avisos', {
      'GET ': () => json({ avisos: [{ ...AVISO, author: null }], canPublish: false }),
    });
    await render(wrap(<AvisosScreen />));
    expect(await screen.findByText('Ex-membro')).toBeTruthy();
  });

  it('empty board', async () => {
    const { wrap } = fakeModuleHost('avisos', { 'GET ': () => json({ avisos: [], canPublish: false }) });
    await render(wrap(<AvisosScreen />));
    expect(await screen.findByText('Nenhum aviso por enquanto.')).toBeTruthy();
  });

  it('error state with retry', async () => {
    const { wrap } = fakeModuleHost('avisos', {
      'GET ': () => json({ code: 'INTERNAL', message: 'Não deu pra carregar os avisos.' }, 500),
    });
    await render(wrap(<AvisosScreen />));
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
  });

  it('whoever can publish publishes (with validation) and deletes with confirmation', async () => {
    let avisos = [AVISO];
    const { wrap, calls } = fakeModuleHost(
      'avisos',
      {
        'GET ': () => json({ avisos, canPublish: true }),
        'POST ': (body) => {
          const input = body as { title: string; body: string };
          const created = { ...AVISO, id: '33333333-3333-4333-8333-333333333333', ...input };
          avisos = [created, ...avisos];
          return json({ id: created.id }, 201);
        },
        [`DELETE /${AVISO.id}`]: () => {
          avisos = avisos.filter((a) => a.id !== AVISO.id);
          return json({ ok: true });
        },
      },
      'owner',
    );
    await render(wrap(<AvisosScreen />));
    await screen.findByText('Treino cancelado');

    await fireEvent.press(screen.getByText('Publicar aviso'));
    expect(await screen.findByText('Escreva um título.')).toBeTruthy();
    expect(screen.getByText('Escreva o aviso.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await fireEvent.changeText(screen.getByLabelText('Título'), 'Festa sexta');
    await fireEvent.changeText(screen.getByLabelText('Aviso'), 'Traga um prato.');
    await fireEvent.press(screen.getByText('Publicar aviso'));
    expect(await screen.findByText('Festa sexta')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '', body: { title: 'Festa sexta', body: 'Traga um prato.' } });

    await fireEvent.press(screen.getAllByText('Apagar')[1]!);
    await fireEvent.press(await screen.findByText('Apagar aviso'));
    await waitFor(() => expect(screen.queryByText('Treino cancelado')).toBeNull());
  });
});
