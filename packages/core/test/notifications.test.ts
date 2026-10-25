import { eq } from '@erre/db';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import {
  createNotifier,
  saveSubscription,
  setPreference,
  type ExpoTransport,
  type NotificationType,
  type WebPushTransport,
} from '../src/server/notifications';
import { pushSubscriptions } from '../src/server/schema';
import { createTestUser, type TestUser } from '../src/server/testing';
import { ORIGIN, setupCore } from './helpers';

const urls = inject('db');
let core: ReturnType<typeof setupCore>;
let ana: TestUser;
let bia: TestUser;
let caio: TestUser;

const types: NotificationType[] = [
  { id: 'demo.resultado', label: 'Resultado', module: 'demo', defaultEnabled: true },
  { id: 'demo.extra', label: 'Extra', module: 'demo', defaultEnabled: false },
];

function fakes(goneEndpoints = new Set<string>(), goneTokens = new Set<string>(), goneByReceipt = new Set<string>()) {
  const webSent: string[] = [];
  const expoSent: string[] = [];
  const webPush: WebPushTransport = {
    async send(sub) {
      webSent.push(sub.endpoint);
      return goneEndpoints.has(sub.endpoint) ? 'gone' : 'sent';
    },
  };
  const expo: ExpoTransport = {
    async send(messages) {
      return messages.map((m) => {
        expoSent.push(m.to);
        if (goneTokens.has(m.to)) return { token: m.to, ok: false, deviceGone: true };
        return { token: m.to, ok: true, receiptId: `r-${m.to}` };
      });
    },
    async goneReceipts(ids) {
      return ids.filter((id) => goneByReceipt.has(id.slice(2)));
    },
  };
  return { webPush, expo, webSent, expoSent };
}

const logs: string[] = [];
const log = {
  info: (obj: object, msg: string) => logs.push(`${msg} ${JSON.stringify(obj)}`),
  error: (obj: object, msg: string) => logs.push(`${msg} ${JSON.stringify(obj)}`),
};

const web = (u: TestUser, n: number) => ({
  kind: 'webpush' as const,
  endpoint: `https://push.example.com/${u.id}/${n}`,
  keys: { p256dh: 'BPk', auth: 'aut' },
});
const token = (u: TestUser) => `ExponentPushToken[${u.id.slice(0, 8)}]`;
const subsOf = (u: TestUser) => core.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u.id));

beforeAll(async () => {
  core = setupCore(urls.app);
  ana = await createTestUser(core.app, core.google, { origin: ORIGIN, name: 'Ana' });
  bia = await createTestUser(core.app, core.google, { origin: ORIGIN, name: 'Bia' });
  caio = await createTestUser(core.app, core.google, { origin: ORIGIN, name: 'Caio' });
  for (const u of [ana, bia, caio]) {
    await saveSubscription(core.db, u.id, web(u, 1));
    await saveSubscription(core.db, u.id, { kind: 'expo', token: token(u) });
  }
});
afterAll(() => core.close());

describe('notifier', () => {
  it('respects preferences and manifest defaults', async () => {
    const f = fakes();
    const n = createNotifier({ db: core.db, types, enabled: true, webPush: f.webPush, expo: f.expo, log });
    await setPreference(core.db, bia.id, 'demo.resultado', false);
    await setPreference(core.db, caio.id, 'demo.extra', true);
    await n.send({ userIds: [ana.id, bia.id, caio.id], type: 'demo.resultado', title: 'Saiu', body: 'Resultado' });
    expect(f.webSent.sort()).toEqual([web(ana, 1).endpoint, web(caio, 1).endpoint].sort());
    expect(f.expoSent.sort()).toEqual([token(ana), token(caio)].sort());

    f.webSent.length = 0;
    await n.send({ userIds: [ana.id, bia.id, caio.id], type: 'demo.extra', title: 'x', body: 'y' });
    expect(f.webSent).toEqual([web(caio, 1).endpoint]);
  });

  it('kill switch and unknown types send nothing', async () => {
    const f = fakes();
    const off = createNotifier({ db: core.db, types, enabled: false, webPush: f.webPush, expo: f.expo, log });
    expect(await off.send({ userIds: [ana.id], type: 'demo.resultado', title: 'x', body: 'y' })).toEqual({
      sent: 0,
      removed: 0,
    });
    const on = createNotifier({ db: core.db, types, enabled: true, webPush: f.webPush, expo: f.expo, log });
    await on.send({ userIds: [ana.id], type: 'demo.nao_existe', title: 'x', body: 'y' });
    expect(f.webSent).toEqual([]);
    expect(logs.some((l) => l.includes('unknown notification type'))).toBe(true);
  });

  it('removes Web Push subscriptions the push service discarded (404/410)', async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await saveSubscription(core.db, u.id, web(u, 1));
    await saveSubscription(core.db, u.id, web(u, 2));
    const f = fakes(new Set([web(u, 1).endpoint]));
    const n = createNotifier({ db: core.db, types, enabled: true, webPush: f.webPush, log });
    expect(await n.send({ userIds: [u.id], type: 'demo.resultado', title: 'x', body: 'y' })).toEqual({
      sent: 1,
      removed: 1,
    });
    expect((await subsOf(u)).map((s) => s.endpoint)).toEqual([web(u, 2).endpoint]);
  });

  it('removes Expo tokens reported as DeviceNotRegistered, in the ticket or later in the receipt', async () => {
    const a = await createTestUser(core.app, core.google, { origin: ORIGIN });
    const b = await createTestUser(core.app, core.google, { origin: ORIGIN });
    await saveSubscription(core.db, a.id, { kind: 'expo', token: token(a) });
    await saveSubscription(core.db, b.id, { kind: 'expo', token: token(b) });
    const f = fakes(new Set(), new Set([token(a)]), new Set([token(b)]));
    const n = createNotifier({ db: core.db, types, enabled: true, expo: f.expo, log, receiptDelayMs: 5 });
    await n.send({ userIds: [a.id, b.id], type: 'demo.resultado', title: 'x', body: 'y' });
    expect(await subsOf(a)).toEqual([]);
    expect(await subsOf(b)).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 30));
    await n.idle();
    expect(await subsOf(b)).toEqual([]);
  });

  it('logs counts only: no ids, endpoints, tokens or text', async () => {
    const f = fakes();
    const n = createNotifier({ db: core.db, types, enabled: true, webPush: f.webPush, expo: f.expo, log });
    logs.length = 0;
    n.dispatch([{ userIds: [ana.id], type: 'demo.resultado', title: 'Título secreto', body: 'Corpo secreto' }]);
    await n.idle();
    const all = logs.join('\n');
    for (const leak of [ana.id, ana.email, web(ana, 1).endpoint, token(ana), 'secreto'])
      expect(all).not.toContain(leak);
    expect(all).toContain('"sent":2');
  });
});

describe('push and preference routes', () => {
  const call = (u: TestUser, method: string, path: string, body?: unknown) =>
    core.app.request(path, {
      method,
      headers: {
        cookie: u.cookie,
        origin: ORIGIN,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  it('validates subscriptions and lets a device move to whoever registered last', async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    const v = await createTestUser(core.app, core.google, { origin: ORIGIN });
    expect(
      (await call(u, 'POST', '/v1/push/subscriptions', { ...web(u, 9), endpoint: 'http://inseguro.example/x' })).status,
    ).toBe(400);
    expect((await call(u, 'POST', '/v1/push/subscriptions', { kind: 'expo', token: 'qualquer' })).status).toBe(400);
    expect((await call(u, 'POST', '/v1/push/subscriptions', web(u, 9))).status).toBe(201);
    expect((await call(v, 'POST', '/v1/push/subscriptions', web(u, 9))).status).toBe(201);
    expect(await subsOf(u)).toEqual([]);
    expect((await subsOf(v)).map((s) => s.endpoint)).toEqual([web(u, 9).endpoint]);
    // Only your own device can be removed.
    await call(u, 'DELETE', '/v1/push/subscriptions', { endpoint: web(u, 9).endpoint });
    expect(await subsOf(v)).toHaveLength(1);
    await call(v, 'DELETE', '/v1/push/subscriptions', { endpoint: web(u, 9).endpoint });
    expect(await subsOf(v)).toEqual([]);
  });

  it('push config hides the key when push is off', async () => {
    expect(await (await core.app.request('/v1/push/config')).json()).toEqual({
      enabled: false,
      webPushPublicKey: null,
    });
  });

  it('preferences list only known types; unknown types are refused', async () => {
    const u = await createTestUser(core.app, core.google, { origin: ORIGIN });
    expect(await (await call(u, 'GET', '/v1/notification-preferences')).json()).toEqual([]);
    expect(
      (await call(u, 'PUT', '/v1/notification-preferences', { type: 'demo.resultado', enabled: false })).status,
    ).toBe(400);
  });
});
