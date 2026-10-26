// Ported in behavior from queridometro@7c5c5bf:src/lib/jobs/open-scheduled-events.test.ts and
// close-scheduled-events.test.ts (per community, with the module's jobs), plus what is new here: the
// "resultado saiu" push to participants, the profile section and the join intent.
import {
  createModuleHarness,
  createTestUser,
  HARNESS_ORIGIN,
  type RoleFixture,
  type TestUser,
} from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { CATEGORICAL, helpers, type EventView } from './helpers';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi], recordPush: true });
const t = helpers(h, inject('db').admin);

const open = (now: Date) => h.runtime.runJob('eventos.abrir_agendados', now);
const close = (now: Date) => h.runtime.runJob('eventos.fechar_agendados', now);

async function pushesAfter<T>(action: () => Promise<T>) {
  await h.runtime.notifier.idle();
  const before = h.pushes.length;
  await action();
  await h.runtime.notifier.idle();
  return h.pushes.slice(before);
}

let fx: RoleFixture;
let ana: TestUser;
let bia: TestUser;
let caio: TestUser;

beforeAll(async () => {
  fx = await h.fixture();
  ana = await t.newMember(fx, 'Ana');
  bia = await t.newMember(fx, 'Bia');
  caio = await t.newMember(fx, 'Caio');
  for (const u of [ana, bia, caio, fx.users.owner]) await h.subscribe(u);
});
afterAll(() => h.close());

async function scheduled(c: RoleFixture, openInMs: number, closeInMs: number) {
  const now = Date.now();
  const ev = await t.json<EventView>(
    t.call(c.users.owner, 'POST', '', c.communityId, {
      title: 'Agendado',
      votingType: 'categorical',
      releaseMode: 'scheduled',
      scheduledOpenAt: new Date(now + openInMs).toISOString(),
      scheduledReleaseAt: new Date(now + closeInMs).toISOString(),
    }),
    201,
  );
  await t.json(t.call(c.users.owner, 'PUT', `/${ev.id}/emojis`, c.communityId, { entries: CATEGORICAL }));
  await t.json(t.call(c.users.owner, 'POST', `/${ev.id}/publicar`, c.communityId));
  return { ev, openAt: new Date(now + openInMs), closeAt: new Date(now + closeInMs) };
}
const status = async (c: RoleFixture, id: string) =>
  (await t.json<{ event: EventView }>(t.call(c.users.owner, 'GET', `/${id}`, c.communityId))).event.status;

const HOUR = 3_600_000;

describe('scheduled open and close (R-EVT-06)', () => {
  it('opens once scheduled_open_at passes and closes once scheduled_release_at passes, never before', async () => {
    const { ev, openAt, closeAt } = await scheduled(fx, HOUR, 2 * HOUR);
    for (const u of [ana, bia, caio]) await t.json(t.call(u, 'POST', `/${ev.id}/inscricao`, fx.communityId));

    await open(new Date(openAt.getTime() - 60_000));
    expect(await status(fx, ev.id)).toBe('accepting_applications');
    await open(new Date(openAt.getTime() + 60_000));
    expect(await status(fx, ev.id)).toBe('open');

    for (const voter of [ana, bia]) {
      const tk = await t.getToken(fx.communityId, ev.id, voter);
      await t.json(t.vote(fx.communityId, ev.id, tk, [{ targetId: caio.id, emojiId: 'coracao' }]));
    }

    await close(new Date(closeAt.getTime() - 60_000));
    expect(await status(fx, ev.id)).toBe('open');
    const at = new Date(closeAt.getTime() + 60_000);
    const sent = await pushesAfter(() => close(at));
    expect(await status(fx, ev.id)).toBe('closed');
    const [snap] = await t.admin<{ created_at: Date }>('SELECT created_at FROM eventos_snapshots WHERE event_id = $1', [
      ev.id,
    ]);
    expect(snap!.created_at.toISOString()).toBe(at.toISOString());

    // "Resultado saiu" to each participant once; the owner didn't sign up.
    expect(sent.map((p) => p.userId).sort()).toEqual([ana.id, bia.id, caio.id].sort());
    expect(sent[0]!.title).toBe('Resultado de Agendado saiu! 📊');
    expect(sent[0]!.url).toBe(`/eventos/${ev.id}/resultados?comunidade=${fx.communityId}`);
    expect(await pushesAfter(() => close(new Date(at.getTime() + HOUR)))).toEqual([]);
  });

  it('the jobs ignore manual and deleted events', async () => {
    const manual = await t.openEvent(fx, [ana]);
    await close(new Date(Date.now() + 365 * 24 * HOUR));
    expect(await status(fx, manual.id)).toBe('open');
    await t.json(t.call(fx.users.owner, 'POST', `/${manual.id}/encerrar`, fx.communityId));

    const { ev, openAt } = await scheduled(fx, HOUR, 2 * HOUR);
    await t.json(t.call(fx.users.owner, 'DELETE', `/${ev.id}`, fx.communityId));
    await open(new Date(openAt.getTime() + 60_000));
    const [row] = await t.admin<{ status: string }>('SELECT status FROM eventos_events WHERE id = $1', [ev.id]);
    expect(row!.status).toBe('accepting_applications');
  });

  it('runs per community: due events of several communities open and close in the same run', async () => {
    const other = await h.fixture();
    const a = await scheduled(fx, HOUR, 2 * HOUR);
    const b = await scheduled(other, HOUR, 2 * HOUR);
    await open(new Date(Math.max(a.openAt.getTime(), b.openAt.getTime()) + 60_000));
    expect(await status(fx, a.ev.id)).toBe('open');
    expect(await status(other, b.ev.id)).toBe('open');
    await close(new Date(Math.max(a.closeAt.getTime(), b.closeAt.getTime()) + 60_000));
    expect(await status(fx, a.ev.id)).toBe('closed');
    expect(await status(other, b.ev.id)).toBe('closed');
  });
});

describe('manual close notifies too', () => {
  it('participants who are still members get the push; nobody else', async () => {
    const ev = await t.openEvent(fx, [ana, bia]);
    const sent = await pushesAfter(() => t.json(t.call(fx.users.owner, 'POST', `/${ev.id}/encerrar`, fx.communityId)));
    expect(sent.map((p) => p.userId).sort()).toEqual([ana.id, bia.id].sort());
  });
});

describe('profile section eventos.trofeus (R-EVT-10)', () => {
  it("shows the winner's categorical ×N and scale wins; a deleted event's trophies disappear", async () => {
    const c = await h.fixture();
    const [w, x, y, z] = [
      await t.newMember(c, 'W'),
      await t.newMember(c, 'X'),
      await t.newMember(c, 'Y'),
      await t.newMember(c, 'Z'),
    ];
    const run = async (
      votingType: 'categorical' | 'scale',
      rows: (target: string) => { targetId: string; emojiId: string; value?: number }[],
    ) => {
      const ev = await t.openEvent(c, [w, x, y, z], {
        votingType,
        title: votingType === 'scale' ? 'Escala' : 'Categórico',
      });
      for (const voter of [x, y, z]) {
        const tk = await t.getToken(c.communityId, ev.id, voter);
        await t.json(t.vote(c.communityId, ev.id, tk, rows(w.id)));
      }
      await t.json(t.call(c.users.owner, 'POST', `/${ev.id}/encerrar`, c.communityId));
      return ev;
    };
    await run('categorical', (id) => [{ targetId: id, emojiId: 'coracao' }]);
    await run('categorical', (id) => [{ targetId: id, emojiId: 'coracao' }]);
    const scaleEvent = await run('scale', (id) => [{ targetId: id, emojiId: 'coracao', value: 8 }]);

    const sections = await t.json<{ id: string; data: { categorical: unknown[]; scale: unknown[] } }[]>(
      h.req(c.users.membro, 'GET', `/v1/profile/${w.id}/sections`, { community: c.communityId }),
    );
    expect(sections).toEqual([
      {
        id: 'eventos.trofeus',
        module: 'eventos',
        data: {
          categorical: [expect.objectContaining({ emojiId: 'coracao', char: '❤️', winCount: 2 })],
          scale: [
            expect.objectContaining({
              eventId: scaleEvent.id,
              eventTitle: 'Escala',
              emojiId: 'coracao',
              average: 8,
              scaleMax: 10,
            }),
          ],
        },
      },
    ]);
    await t.json(t.call(c.users.owner, 'DELETE', `/${scaleEvent.id}`, c.communityId));
    const after = await t.json<{ data: { scale: unknown[] } }[]>(
      h.req(c.users.membro, 'GET', `/v1/profile/${w.id}/sections`, { community: c.communityId }),
    );
    expect(after[0]!.data.scale).toEqual([]);
    const none = await t.json<unknown[]>(
      h.req(c.users.membro, 'GET', `/v1/profile/${x.id}/sections`, { community: c.communityId }),
    );
    expect(none).toEqual([]);
  });
});

describe('join intent eventos.participar (D-023, P-014 B)', () => {
  async function inviteAndRequest(c: RoleFixture) {
    const { code } = await t.json<{ code: string }>(
      h.req(c.users.owner, 'POST', `/v1/communities/${c.communityId}/invites`, {
        community: c.communityId,
        body: { intent: 'eventos.participar' },
      }),
      201,
    );
    const u = await createTestUser(h.app, h.google, { origin: HARNESS_ORIGIN, name: 'Convidada' });
    await t.json(h.req(u, 'POST', `/v1/invites/${code}/join`));
    return u;
  }
  const approve = (c: RoleFixture, userId: string) =>
    t.json(
      h.req(c.users.owner, 'POST', `/v1/communities/${c.communityId}/requests/${userId}/approve`, {
        community: c.communityId,
      }),
    );

  it('approving the request also signs the person up for the live event', async () => {
    const c = await h.fixture();
    const ev = await t.draft(c);
    await t.json(t.call(c.users.owner, 'POST', `/${ev.id}/publicar`, c.communityId));
    const u = await inviteAndRequest(c);
    await approve(c, u.id);
    const detail = await t.json<{ participating: boolean }>(t.call(u, 'GET', `/${ev.id}`, c.communityId));
    expect(detail.participating).toBe(true);
  });

  it('with no live event, the person just joins', async () => {
    const c = await h.fixture();
    const u = await inviteAndRequest(c);
    await approve(c, u.id);
    const list = await t.json<{ events: unknown[] }>(t.call(u, 'GET', '', c.communityId));
    expect(list.events).toEqual([]);
  });
});
