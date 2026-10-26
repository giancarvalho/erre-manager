// Ported in behavior from queridometro@7c5c5bf:src/app/actions/voting-events.test.ts,
// src/lib/events/close-voting-event.test.ts (openApplications, openVoting, deleteVotingEvent) and the
// "só em rascunho" part of src/lib/events/voting-event-emoji-config.test.ts, against the real API.
import { createModuleHarness, permissionMatrix, type RoleFixture } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { CATEGORICAL, helpers, type EventView } from './helpers';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi] });
const t = helpers(h, inject('db').admin);

let fx: RoleFixture;
beforeAll(async () => {
  fx = await h.fixture();
});
afterAll(() => h.close());

const ALL = ['owner', 'admin', 'moderador', 'membro'] as const;
const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe('permissions (matrix)', () => {
  it('create and edit drafts: owner and admin (eventos.criar)', async () => {
    const created = await permissionMatrix(fx, ['owner', 'admin'], (_u, headers) =>
      h.app.request('/v1/eventos', {
        method: 'POST',
        headers: { ...headers, origin: 'http://localhost:8081', 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Matriz', votingType: 'categorical', releaseMode: 'manual' }),
      }),
    );
    expect(created.problems).toEqual([]);
    const ev = await t.draft(fx);
    const edit = await permissionMatrix(fx, ['owner', 'admin'], (u) =>
      t.call(u, 'PATCH', `/${ev.id}`, fx.communityId, { title: 'Outro' }),
    );
    expect(edit.problems).toEqual([]);
    const roster = await permissionMatrix(fx, ['owner', 'admin'], (u) =>
      t.call(u, 'PUT', `/${ev.id}/emojis`, fx.communityId, { entries: CATEGORICAL }),
    );
    expect(roster.problems).toEqual([]);
  });

  it('lifecycle actions: owner and admin (eventos.moderar)', async () => {
    const ev = await t.draft(fx);
    for (const action of ['publicar', 'abrir', 'encerrar']) {
      const { problems } = await permissionMatrix(fx, ['owner', 'admin'], (u) =>
        t.call(u, 'POST', `/${ev.id}/${action}`, fx.communityId),
      );
      expect(problems, action).toEqual([]);
    }
    const del = await permissionMatrix(fx, ['owner', 'admin'], (u) => t.call(u, 'DELETE', `/${ev.id}`, fx.communityId));
    expect(del.problems).toEqual([]);
  });

  it('list, read, sign up and vote: every approved member (eventos.ver, eventos.votar)', async () => {
    const list = await permissionMatrix(fx, ALL, (u) => t.call(u, 'GET', '', fx.communityId));
    expect(list.problems).toEqual([]);
    const ev = await t.draft(fx);
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/publicar`, fx.communityId));
    const signUp = await permissionMatrix(fx, ALL, (u) => t.call(u, 'POST', `/${ev.id}/inscricao`, fx.communityId));
    expect(signUp.problems).toEqual([]);
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/abrir`, fx.communityId));
    const key = await permissionMatrix(fx, ALL, (u) => t.call(u, 'GET', `/${ev.id}/chave`, fx.communityId));
    expect(key.problems).toEqual([]);
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });
});

describe('drafts', () => {
  it('creates a draft with trimmed fields and no banner color', async () => {
    const ev = await t.json<EventView & { description: string | null; bannerRgb: string | null }>(
      t.call(fx.users.admin, 'POST', '', fx.communityId, {
        title: '  Amigo Secreto  ',
        description: '   ',
        votingType: 'scale',
        releaseMode: 'manual',
      }),
      201,
    );
    expect(ev).toEqual(
      expect.objectContaining({ title: 'Amigo Secreto', description: null, status: 'draft', bannerRgb: null }),
    );
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });

  it('business rule errors are 422 INVALID_EVENT with the pt-BR message', async () => {
    const res = await t.json<{ code: string; message: string }>(
      t.call(fx.users.owner, 'POST', '', fx.communityId, {
        title: 'Agendado',
        votingType: 'categorical',
        releaseMode: 'scheduled',
      }),
      422,
    );
    expect(res).toEqual({
      code: 'INVALID_EVENT',
      message: 'Liberação agendada precisa de uma data de abertura e uma de fechamento.',
    });
  });

  it('edits title, description and banner color while a draft', async () => {
    const ev = await t.draft(fx);
    const updated = await t.json<{ title: string; bannerRgb: string }>(
      t.call(fx.users.owner, 'PATCH', `/${ev.id}`, fx.communityId, { title: 'Novo', bannerRgb: '12 34 56' }),
    );
    expect(updated).toEqual(expect.objectContaining({ title: 'Novo', bannerRgb: '12 34 56' }));
    await t.json(t.call(fx.users.owner, 'PATCH', `/${ev.id}`, fx.communityId, { bannerRgb: '300 0 0' }), 422);
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });

  it('a draft is invisible to members (404) and visible to whoever manages events', async () => {
    const ev = await t.draft(fx);
    await t.json(t.call(fx.users.membro, 'GET', `/${ev.id}`, fx.communityId), 404);
    const list = await t.json<{ events: { id: string }[] }>(t.call(fx.users.membro, 'GET', '', fx.communityId));
    expect(list.events.map((e) => e.id)).not.toContain(ev.id);
    await t.json(t.call(fx.users.admin, 'GET', `/${ev.id}`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });

  it('the roster is validated against the voting type (scale needs scaleMax)', async () => {
    const ev = await t.json<EventView>(
      t.call(fx.users.owner, 'POST', '', fx.communityId, { title: 'E', votingType: 'scale', releaseMode: 'manual' }),
      201,
    );
    const res = await t.json<{ code: string }>(
      t.call(fx.users.owner, 'PUT', `/${ev.id}/emojis`, fx.communityId, { entries: CATEGORICAL }),
      422,
    );
    expect(res.code).toBe('INVALID_EMOJIS');
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });
});

describe('publish, open, close, delete (R-EVT-01 to R-EVT-06)', () => {
  it('publishing needs a roster', async () => {
    const ev = await t.json<EventView>(
      t.call(fx.users.owner, 'POST', '', fx.communityId, {
        title: 'Sem',
        votingType: 'categorical',
        releaseMode: 'manual',
      }),
      201,
    );
    const res = await t.json<{ code: string; message: string }>(
      t.call(fx.users.owner, 'POST', `/${ev.id}/publicar`, fx.communityId),
      422,
    );
    expect(res).toEqual({
      code: 'PUBLISH_BLOCKED',
      message: 'Adicione pelo menos um emoji ao evento antes de publicá-lo.',
    });
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });

  it('once published, fields and roster are locked (R-EVT-04)', async () => {
    const ev = await t.draft(fx);
    const published = await t.json<EventView>(t.call(fx.users.owner, 'POST', `/${ev.id}/publicar`, fx.communityId));
    expect(published.status).toBe('accepting_applications');
    expect(
      (
        await t.json<{ code: string }>(
          t.call(fx.users.owner, 'PATCH', `/${ev.id}`, fx.communityId, { title: 'X' }),
          409,
        )
      ).code,
    ).toBe('NOT_DRAFT');
    expect(
      (
        await t.json<{ code: string }>(
          t.call(fx.users.owner, 'PUT', `/${ev.id}/emojis`, fx.communityId, { entries: CATEGORICAL }),
          409,
        )
      ).code,
    ).toBe('NOT_DRAFT');
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
  });

  it('at most one live event per community; drafts and closed ones do not count; deleting frees the slot (R-EVT-03)', async () => {
    const first = await t.draft(fx, { title: 'Primeiro' });
    const second = await t.draft(fx, { title: 'Segundo' });
    await t.json(t.call(fx.users.owner, 'POST', `/${first.id}/publicar`, fx.communityId));
    const blocked = await t.json<{ code: string; message: string }>(
      t.call(fx.users.owner, 'POST', `/${second.id}/publicar`, fx.communityId),
      409,
    );
    expect(blocked).toEqual({
      code: 'LIVE_EVENT_EXISTS',
      message: 'Esta comunidade já tem um evento em andamento. Feche-o antes de publicar outro.',
    });
    // Open counts as live too.
    await t.json(t.call(fx.users.owner, 'POST', `/${first.id}/abrir`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'POST', `/${second.id}/publicar`, fx.communityId), 409);
    // Closing frees the slot.
    await t.json(t.call(fx.users.owner, 'POST', `/${first.id}/encerrar`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'POST', `/${second.id}/publicar`, fx.communityId));
    // Deleting a live event frees it right away.
    await t.json(t.call(fx.users.owner, 'DELETE', `/${second.id}`, fx.communityId));
    const third = await t.draft(fx, { title: 'Terceiro' });
    await t.json(t.call(fx.users.owner, 'POST', `/${third.id}/publicar`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'DELETE', `/${third.id}`, fx.communityId));
  });

  it('transitions out of order are 409 INVALID_TRANSITION', async () => {
    const ev = await t.draft(fx);
    for (const action of ['abrir', 'encerrar']) {
      const res = await t.json<{ code: string }>(
        t.call(fx.users.owner, 'POST', `/${ev.id}/${action}`, fx.communityId),
        409,
      );
      expect(res.code, action).toBe('INVALID_TRANSITION');
    }
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/publicar`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/encerrar`, fx.communityId), 409); // voting never started
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/abrir`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/abrir`, fx.communityId), 409);
    const closed = await t.json<EventView>(t.call(fx.users.owner, 'POST', `/${ev.id}/encerrar`, fx.communityId));
    expect(closed.status).toBe('closed');
    // Closing twice doesn't recompute or move closedAt.
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/encerrar`, fx.communityId), 409);
    const again = await t.json<{ event: EventView }>(t.call(fx.users.owner, 'GET', `/${ev.id}`, fx.communityId));
    expect(again.event.closedAt).toBe(closed.closedAt);
  });

  it('a scheduled event can be opened and closed early by an admin (R-EVT-06)', async () => {
    const ev = await t.json<EventView>(
      t.call(fx.users.owner, 'POST', '', fx.communityId, {
        title: 'Agendado',
        votingType: 'categorical',
        releaseMode: 'scheduled',
        scheduledOpenAt: future(24),
        scheduledReleaseAt: future(48),
      }),
      201,
    );
    await t.json(t.call(fx.users.owner, 'PUT', `/${ev.id}/emojis`, fx.communityId, { entries: CATEGORICAL }));
    await t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/publicar`, fx.communityId));
    expect((await t.json<EventView>(t.call(fx.users.admin, 'POST', `/${ev.id}/abrir`, fx.communityId))).status).toBe(
      'open',
    );
    expect((await t.json<EventView>(t.call(fx.users.admin, 'POST', `/${ev.id}/encerrar`, fx.communityId))).status).toBe(
      'closed',
    );
  });

  it('soft delete works at any status; the event is gone everywhere but the row stays', async () => {
    const ev = await t.draft(fx);
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'GET', `/${ev.id}`, fx.communityId), 404);
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId), 404);
    const list = await t.json<{ events: { id: string }[] }>(t.call(fx.users.owner, 'GET', '', fx.communityId));
    expect(list.events.map((e) => e.id)).not.toContain(ev.id);
    const rows = await t.admin('SELECT deleted_at FROM eventos_events WHERE id = $1', [ev.id]);
    expect(rows).toHaveLength(1);
  });

  it('the one-live-event index holds in the database too', async () => {
    const a = await t.draft(fx);
    const b = await t.draft(fx);
    await t.json(t.call(fx.users.owner, 'POST', `/${a.id}/publicar`, fx.communityId));
    await expect(t.admin(`UPDATE eventos_events SET status = 'open' WHERE id = $1`, [b.id])).rejects.toThrow(
      /eventos_events_one_live_idx/,
    );
    await t.json(t.call(fx.users.owner, 'DELETE', `/${a.id}`, fx.communityId));
    await t.json(t.call(fx.users.owner, 'DELETE', `/${b.id}`, fx.communityId));
  });
});

describe('isolation between communities', () => {
  it("an event id from another community is 404 for every route, even for that community's owner", async () => {
    const other = await h.fixture();
    const ev = await t.draft(other);
    for (const [method, path, body] of [
      ['GET', `/${ev.id}`, undefined],
      ['PATCH', `/${ev.id}`, { title: 'invadido' }],
      ['PUT', `/${ev.id}/emojis`, { entries: CATEGORICAL }],
      ['POST', `/${ev.id}/publicar`, undefined],
      ['DELETE', `/${ev.id}`, undefined],
    ] as const) {
      const res = await t.call(fx.users.owner, method, path, fx.communityId, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const [row] = await t.admin<{ title: string; status: string; deleted_at: Date | null }>(
      'SELECT title, status, deleted_at FROM eventos_events WHERE id = $1',
      [ev.id],
    );
    expect(row).toEqual({ title: 'Festa', status: 'draft', deleted_at: null });
  });
});
