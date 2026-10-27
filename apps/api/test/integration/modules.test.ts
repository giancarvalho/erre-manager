import moduleApi from '@erre/contrato-teste/api';
import { jobRuns } from '@erre/contrato-teste/db';
import {
  CORE_PERMISSION_IDS,
  CORE_PERMISSIONS,
  createAuth,
  createCommunity,
  createCoreApi,
  createModuleRuntime,
  type WebPushTransport,
} from '@erre/core/server';
import {
  addMember,
  createRoleFixture,
  createTestUser,
  installFakeGoogle,
  permissionMatrix,
  type RoleFixture,
} from '@erre/core/testing';
import { closeDb, createDb, withTenantTx } from '@erre/db';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import { createApp } from '../../src/app';
import { createLogger } from '../../src/logger';

const ORIGIN = 'http://localhost:8081';
const urls = inject('db');
const db = createDb(urls.app);
const jobsDb = createDb(urls.jobs, { max: 1 });
const google = installFakeGoogle('cid');
const auth = createAuth({
  db,
  baseURL: 'http://localhost:3000',
  secret: 'x'.repeat(40),
  google: { clientId: 'cid', clientSecret: 'cs' },
  trustedOrigins: [ORIGIN],
  rateLimit: { enabled: false },
});
const silent = createLogger({ level: 'silent' });

const webSent: { endpoint: string; url: string }[] = [];
const webPush: WebPushTransport = {
  async send(sub, payload) {
    webSent.push({ endpoint: sub.endpoint, url: payload.url });
    return 'sent';
  },
};

function build(enabled: string[], cronSecret?: string) {
  const runtime = createModuleRuntime({
    db,
    jobsDb,
    auth,
    modules: [moduleApi],
    enabled: new Set(enabled),
    cronSecret,
    log: silent,
    push: { enabled: true, webPush },
  });
  const core = createCoreApi({
    db,
    auth,
    trustedOrigins: [ORIGIN],
    hooks: runtime.hooks,
    permissions: runtime.permissions,
    notifications: { types: runtime.notificationTypes, pushEnabled: true, webPushPublicKey: 'chave-publica' },
  });
  return { runtime, app: createApp({ logger: silent, core, modules: runtime.app, webOrigins: [ORIGIN] }) };
}

const on = build(['contratoteste'], 's'.repeat(40));
const off = build([]);
let fx: RoleFixture;
let other: RoleFixture;

const req = (
  app: typeof on.app,
  cookie: string | null,
  method: string,
  path: string,
  communityId?: string,
  body?: unknown,
) =>
  app.request(path, {
    method,
    headers: {
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(communityId ? { 'x-community-id': communityId } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

async function adminRows<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: urls.admin });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  fx = await createRoleFixture(on.app, google, db, { origin: ORIGIN });
  other = await createRoleFixture(on.app, google, db, { origin: ORIGIN });
});
afterAll(async () => {
  google.restore();
  await closeDb(db);
  await closeDb(jobsDb);
});

describe('module flag', () => {
  it('GET /v1/modules lists only enabled manifests', async () => {
    const list = (await (await on.app.request('/v1/modules')).json()) as { id: string }[];
    expect(list.map((m) => m.id)).toEqual(['contratoteste']);
    expect(await (await off.app.request('/v1/modules')).json()).toEqual([]);
  });

  it('an enabled module answers; a disabled one is 404 MODULE_DISABLED, anonymous routes included', async () => {
    const owner = fx.users.owner;
    const res = await req(on.app, owner.cookie, 'GET', '/v1/contratoteste/whoami', fx.communityId);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      user: { id: owner.id, displayName: 'Dona' },
      community: { id: fx.communityId },
    });
    for (const path of ['/v1/contratoteste/whoami', `/v1/contratoteste/anon/c/${fx.communityId}/echo`]) {
      const r = await req(off.app, owner.cookie, 'GET', path, fx.communityId);
      expect(r.status, path).toBe(404);
      expect(await r.json()).toMatchObject({ code: 'MODULE_DISABLED' });
    }
  });

  it('jobs of a disabled module are not scheduled nor runnable', async () => {
    expect(on.runtime.scheduledJobs).toEqual(['contratoteste.contar']);
    expect(off.runtime.scheduledJobs).toEqual([]);
    await expect(off.runtime.runJob('contratoteste.contar')).rejects.toMatchObject({ code: 'JOB_NOT_FOUND' });
  });
});

describe('module context', () => {
  it('needs a session and an approved membership', async () => {
    expect((await req(on.app, null, 'GET', '/v1/contratoteste/whoami', fx.communityId)).status).toBe(401);
    expect((await req(on.app, fx.users.owner.cookie, 'GET', '/v1/contratoteste/whoami')).status).toBe(403);
    expect(
      (await req(on.app, fx.users.outsider.cookie, 'GET', '/v1/contratoteste/whoami', fx.communityId)).status,
    ).toBe(403);
    expect((await req(on.app, fx.users.pending.cookie, 'GET', '/v1/contratoteste/whoami', fx.communityId)).status).toBe(
      403,
    );
  });

  it('module permissions come from the manifest (matrix)', async () => {
    const { problems } = await permissionMatrix(fx, ['owner', 'admin'], (_u, headers) =>
      on.app.request('/v1/contratoteste/items', {
        method: 'POST',
        headers: { ...headers, origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'x' }),
      }),
    );
    expect(problems).toEqual([]);
    const ver = await permissionMatrix(fx, ['owner', 'admin', 'moderador', 'membro'], (_u, headers) =>
      on.app.request('/v1/contratoteste/items', { headers }),
    );
    expect(ver.problems).toEqual([]);
  });

  it('module data stays in its community', async () => {
    await req(on.app, other.users.owner.cookie, 'POST', '/v1/contratoteste/items', other.communityId, {
      label: 'de outra',
    });
    const mine = (await (
      await req(on.app, fx.users.membro.cookie, 'GET', '/v1/contratoteste/items', fx.communityId)
    ).json()) as {
      label: string;
    }[];
    expect(mine.map((i) => i.label)).not.toContain('de outra');
  });
});

describe('anonymous routes', () => {
  it('never see the user, cookies, Authorization or IP, even with a valid session', async () => {
    const res = await on.app.request(`/v1/contratoteste/anon/c/${fx.communityId}/echo`, {
      headers: {
        cookie: fx.users.owner.cookie,
        authorization: 'Bearer abc',
        'x-forwarded-for': '10.1.2.3',
        'x-real-ip': '10.1.2.3',
        'user-agent': 'Celular da Ana',
        accept: 'application/json',
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { community: string; contextKeys: string[]; headers: string[] };
    expect(body.community).toBe(fx.communityId);
    expect(body.contextKeys).toEqual(['community', 'tx']);
    expect(body.headers).toEqual(['accept']);
  });

  it('unknown or malformed community → 404', async () => {
    expect((await on.app.request('/v1/contratoteste/anon/c/nao-e-uuid/echo')).status).toBe(404);
    expect((await on.app.request('/v1/contratoteste/anon/c/00000000-0000-4000-8000-000000000000/echo')).status).toBe(
      404,
    );
    expect((await on.app.request('/v1/contratoteste/anon/sem-comunidade')).status).toBe(404);
  });
});

describe('jobs', () => {
  it('run once per community and each run sees only its community', async () => {
    const a = await createRoleFixture(on.app, google, db, { origin: ORIGIN });
    for (const label of ['1', '2'])
      await req(on.app, a.users.owner.cookie, 'POST', '/v1/contratoteste/items', a.communityId, { label });
    const result = await on.runtime.runJob('contratoteste.contar');
    expect(result).toMatchObject({ skipped: false, failed: 0 });
    const [total] = await adminRows<{ n: number }>('SELECT count(*)::int AS n FROM communities');
    expect(result.communities).toBe(total?.n);
    const runs = await withTenantTx(db, { communityId: a.communityId }, (tx) => tx.select().from(jobRuns));
    expect(runs.map((r) => r.itemsSeen)).toEqual([2]);
  });

  it('skips when another instance holds the lock', async () => {
    const holder = new pg.Client({ connectionString: urls.admin });
    await holder.connect();
    try {
      await holder.query("SELECT pg_advisory_lock(hashtext('job:contratoteste.contar'))");
      expect(await on.runtime.runJob('contratoteste.contar')).toMatchObject({ skipped: true });
    } finally {
      await holder.end();
    }
  });

  it('internal route needs the cron secret; without a configured secret it does not exist', async () => {
    const run = (app: typeof on.app, token?: string) =>
      app.request('/v1/internal/jobs/contratoteste.contar/run', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
    expect((await run(on.app)).status).toBe(401);
    expect((await run(on.app, 'errado')).status).toBe(401);
    expect((await run(on.app, 's'.repeat(40))).status).toBe(200);
    expect((await run(off.app, 's'.repeat(40))).status).toBe(404);
  });
});

describe('permissions sync', () => {
  it('new communities get module permissions; existing ones get them at boot', async () => {
    const details = (await (
      await req(on.app, fx.users.owner.cookie, 'GET', `/v1/communities/${fx.communityId}`, fx.communityId)
    ).json()) as {
      permissions: string[];
    };
    expect(details.permissions).toEqual(
      expect.arrayContaining(['contratoteste.ver', 'contratoteste.editar', ...CORE_PERMISSION_IDS]),
    );

    // A community created before the module existed: core permissions only.
    const creator = await createTestUser(on.app, google, { origin: ORIGIN });
    const old = await createCommunity(db, creator.id, `antiga-${Date.now().toString(36)}`, CORE_PERMISSIONS);
    const before = await adminRows<{ permission: string }>(
      'SELECT permission FROM core_role_permissions WHERE community_id = $1',
      [old.id],
    );
    expect(before.some((r) => r.permission.startsWith('contratoteste.'))).toBe(false);
    await on.runtime.syncPermissions();
    await on.runtime.syncPermissions(); // idempotent
    const after = await adminRows<{ role: string }>(
      "SELECT role FROM core_role_permissions WHERE community_id = $1 AND permission = 'contratoteste.editar' ORDER BY role",
      [old.id],
    );
    expect(after.map((r) => r.role)).toEqual(['admin', 'owner']);
  });
});

describe('profile sections', () => {
  it('aggregates the enabled modules for an approved member', async () => {
    await req(on.app, other.users.admin.cookie, 'POST', '/v1/contratoteste/items', other.communityId, { label: 'meu' });
    const res = await req(
      on.app,
      other.users.membro.cookie,
      'GET',
      `/v1/profile/${other.users.admin.id}/sections`,
      other.communityId,
    );
    expect(await res.json()).toEqual([
      { id: 'contratoteste.resumo', module: 'contratoteste', data: { itemsCreated: 1 } },
    ]);
    const none = await req(
      on.app,
      fx.users.membro.cookie,
      'GET',
      `/v1/profile/${fx.users.moderador.id}/sections`,
      fx.communityId,
    );
    expect(await none.json()).toEqual([]);
    expect(
      (await req(on.app, fx.users.membro.cookie, 'GET', `/v1/profile/${fx.users.outsider.id}/sections`, fx.communityId))
        .status,
    ).toBe(404);
    expect(
      await (
        await req(off.app, fx.users.membro.cookie, 'GET', `/v1/profile/${fx.users.admin.id}/sections`, fx.communityId)
      ).json(),
    ).toEqual([]);
  });
});

describe('join intent of a module (one request only)', () => {
  it('approval runs the module hook; leaving runs its cleanup', async () => {
    const created = await req(
      on.app,
      fx.users.owner.cookie,
      'POST',
      `/v1/communities/${fx.communityId}/invites`,
      fx.communityId,
      {
        intent: 'contratoteste.participar',
      },
    );
    expect(created.status).toBe(201);
    const { code } = (await created.json()) as { code: string };
    const preview = (await (await on.app.request(`/v1/invites/${code}`)).json()) as { intent: { label: string } };
    expect(preview.intent.label).toBe('Entrar e participar do teste');

    const u = await createTestUser(on.app, google, { origin: ORIGIN, name: 'Participante' });
    await req(on.app, u.cookie, 'POST', `/v1/invites/${code}/join`);
    await req(
      on.app,
      fx.users.owner.cookie,
      'POST',
      `/v1/communities/${fx.communityId}/requests/${u.id}/approve`,
      fx.communityId,
    );
    const parts = (await (
      await req(on.app, u.cookie, 'GET', '/v1/contratoteste/participants', fx.communityId)
    ).json()) as { userId: string }[];
    expect(parts.map((p) => p.userId)).toContain(u.id);

    await req(on.app, u.cookie, 'POST', `/v1/communities/${fx.communityId}/leave`, fx.communityId);
    await addMember(db, fx.communityId, u.id, 'membro');
    const after = (await (
      await req(on.app, u.cookie, 'GET', '/v1/contratoteste/participants', fx.communityId)
    ).json()) as { userId: string }[];
    expect(after.map((p) => p.userId)).not.toContain(u.id);
  });

  it('a disabled module has no intents', async () => {
    const res = await req(
      off.app,
      fx.users.owner.cookie,
      'POST',
      `/v1/communities/${fx.communityId}/invites`,
      fx.communityId,
      {
        intent: 'contratoteste.participar',
      },
    );
    expect(res.status).toBe(400);
  });
});

describe('notify from a module', () => {
  it('sends after the transaction commits, to members whose preference allows it', async () => {
    const subscribe = (u: { cookie: string }, n: string) =>
      req(on.app, u.cookie, 'POST', '/v1/push/subscriptions', undefined, {
        kind: 'webpush',
        endpoint: `https://push.example.com/${n}`,
        keys: { p256dh: 'BPk', auth: 'aut' },
      });
    expect((await subscribe(fx.users.membro, `membro-${fx.communityId}`)).status).toBe(201);
    expect((await subscribe(fx.users.admin, `admin-${fx.communityId}`)).status).toBe(201);
    expect((await subscribe(fx.users.outsider, `fora-${fx.communityId}`)).status).toBe(201);
    // The admin turned this type off.
    const prefs = await req(on.app, fx.users.admin.cookie, 'PUT', '/v1/notification-preferences', undefined, {
      type: 'contratoteste.aviso',
      enabled: false,
    });
    expect(prefs.status).toBe(200);

    webSent.length = 0;
    expect(
      (await req(on.app, fx.users.owner.cookie, 'POST', '/v1/contratoteste/avisar?falhar=1', fx.communityId)).status,
    ).toBe(422);
    await on.runtime.notifier.idle();
    expect(webSent).toEqual([]);

    expect((await req(on.app, fx.users.owner.cookie, 'POST', '/v1/contratoteste/avisar', fx.communityId)).status).toBe(
      200,
    );
    await on.runtime.notifier.idle();
    expect(webSent).toEqual([
      {
        endpoint: `https://push.example.com/membro-${fx.communityId}`,
        url: `/contratoteste?comunidade=${fx.communityId}`,
      },
    ]);
  });

  it('preferences list the types of enabled modules only', async () => {
    const list = (await (await req(on.app, fx.users.membro.cookie, 'GET', '/v1/notification-preferences')).json()) as {
      type: string;
    }[];
    expect(list.map((p) => p.type)).toEqual(['contratoteste.aviso']);
    expect(await (await req(off.app, fx.users.membro.cookie, 'GET', '/v1/notification-preferences')).json()).toEqual(
      [],
    );
  });
});
