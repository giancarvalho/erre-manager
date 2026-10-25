// notify() (ARQUITETURA §6, D-012): preferences per type, Web Push for the PWA and Expo Push for the apps.
// Logs carry counts only: no user ids, endpoints, tokens or message text.
import { and, eq, inArray, type Db } from '@erre/db';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import webpush from 'web-push';

import { notificationPreferences, pushSubscriptions } from './schema';

export type PushPayload = { title: string; body: string; url: string };

export type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** 'gone': the push service will never accept this subscription again (404/410): remove it. */
export type WebPushTransport = {
  send: (sub: WebPushSubscription, payload: PushPayload) => Promise<'sent' | 'gone' | 'failed'>;
};

export type ExpoTicket = { token: string; ok: boolean; receiptId?: string; deviceGone?: boolean };
export type ExpoTransport = {
  send: (messages: { to: string; title: string; body: string; data: { url: string } }[]) => Promise<ExpoTicket[]>;
  /** Receipt ids whose device is gone (DeviceNotRegistered). */
  goneReceipts: (receiptIds: string[]) => Promise<string[]>;
};

export function webPushTransport(vapid: { publicKey: string; privateKey: string; subject: string }): WebPushTransport {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return {
    async send(sub, payload) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        return 'sent';
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? 'gone' : 'failed';
      }
    },
  };
}

export function expoTransport(accessToken?: string): ExpoTransport {
  const expo = new Expo(accessToken ? { accessToken } : {});
  return {
    async send(messages) {
      const out: ExpoTicket[] = [];
      for (const chunk of expo.chunkPushNotifications(messages as ExpoPushMessage[])) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((t, i) => {
            const token = String(chunk[i]?.to ?? '');
            if (t.status === 'ok') out.push({ token, ok: true, receiptId: t.id });
            else out.push({ token, ok: false, deviceGone: t.details?.error === 'DeviceNotRegistered' });
          });
        } catch {
          for (const m of chunk) out.push({ token: String(m.to), ok: false });
        }
      }
      return out;
    },
    async goneReceipts(ids) {
      const gone: string[] = [];
      for (const chunk of expo.chunkPushNotificationReceiptIds(ids)) {
        try {
          const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
          for (const [id, r] of Object.entries(receipts)) {
            if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') gone.push(id);
          }
        } catch {
          // receipts are best effort; the next send tries again
        }
      }
      return gone;
    },
  };
}

export type NotificationType = { id: string; label: string; module: string; defaultEnabled: boolean };
export type NotifyInput = { userIds: string[]; type: string; title: string; body: string; route?: string };

type Log = { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };

export type NotifierDeps = {
  db: Db;
  types: readonly NotificationType[];
  /** Global kill switch (PUSH_ENABLED, P-007). */
  enabled: boolean;
  webPush?: WebPushTransport | undefined;
  expo?: ExpoTransport | undefined;
  log: Log;
  /** Expo receipts are ready about 15 minutes after sending. */
  receiptDelayMs?: number;
};

export function createNotifier({ db, types, enabled, webPush, expo, log, receiptDelayMs = 15 * 60_000 }: NotifierDeps) {
  const byId = new Map(types.map((t) => [t.id, t]));
  const inflight = new Set<Promise<unknown>>();

  /** People who want this type: their saved choice, or the manifest default. */
  async function recipients(type: NotificationType, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return [];
    const prefs = await db
      .select({ userId: notificationPreferences.userId, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.type, type.id), inArray(notificationPreferences.userId, unique)));
    const chosen = new Map(prefs.map((p) => [p.userId, p.enabled]));
    return unique.filter((u) => chosen.get(u) ?? type.defaultEnabled);
  }

  async function removeEndpoints(endpoints: string[]) {
    if (endpoints.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, endpoints));
  }

  async function send(input: NotifyInput): Promise<{ sent: number; removed: number }> {
    if (!enabled) return { sent: 0, removed: 0 };
    const type = byId.get(input.type);
    if (!type) {
      log.error({ type: input.type }, 'notify: unknown notification type');
      return { sent: 0, removed: 0 };
    }
    const users = await recipients(type, input.userIds);
    if (users.length === 0) return { sent: 0, removed: 0 };
    const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, users));
    const payload: PushPayload = { title: input.title, body: input.body, url: input.route ?? '/' };
    let sent = 0;
    const gone: string[] = [];

    if (webPush) {
      const results = await Promise.all(
        subs
          .filter((s) => s.kind === 'webpush' && s.keys)
          .map(async (s) => ({
            endpoint: s.endpoint,
            r: await webPush.send({ endpoint: s.endpoint, keys: s.keys! }, payload),
          })),
      );
      for (const { endpoint, r } of results) {
        if (r === 'sent') sent += 1;
        if (r === 'gone') gone.push(endpoint);
      }
    }

    if (expo) {
      const tokens = subs.filter((s) => s.kind === 'expo').map((s) => s.endpoint);
      if (tokens.length) {
        const tickets = await expo.send(
          tokens.map((to) => ({ to, title: payload.title, body: payload.body, data: { url: payload.url } })),
        );
        const receiptToToken = new Map<string, string>();
        for (const t of tickets) {
          if (t.ok) sent += 1;
          if (t.deviceGone) gone.push(t.token);
          if (t.receiptId) receiptToToken.set(t.receiptId, t.token);
        }
        if (receiptToToken.size) scheduleReceipts(receiptToToken);
      }
    }

    await removeEndpoints(gone);
    log.info({ type: type.id, recipients: users.length, sent, removed: gone.length }, 'notify');
    return { sent, removed: gone.length };
  }

  function scheduleReceipts(receiptToToken: Map<string, string>) {
    const timer = setTimeout(() => {
      track(
        (async () => {
          const goneIds = await expo!.goneReceipts([...receiptToToken.keys()]);
          await removeEndpoints(goneIds.map((id) => receiptToToken.get(id)!).filter(Boolean));
        })(),
      );
    }, receiptDelayMs);
    (timer as { unref?: () => void }).unref?.();
  }

  function track<T>(p: Promise<T>) {
    const guarded = p.catch((err: unknown) => log.error({ err: { name: (err as Error).name } }, 'notify failed'));
    inflight.add(guarded);
    void guarded.finally(() => inflight.delete(guarded));
    return guarded;
  }

  return {
    types,
    enabled,
    send,
    /** Sends in the background (after a commit); errors are logged, never thrown at the caller. */
    dispatch(inputs: NotifyInput[]) {
      for (const input of inputs) track(send(input));
    },
    /** Waits for background sends (tests, shutdown). */
    async idle() {
      while (inflight.size) await Promise.all([...inflight]);
    },
  };
}

export type Notifier = ReturnType<typeof createNotifier>;

/** Saves (or takes over) a device subscription for the person. A device belongs to who registered last. */
export async function saveSubscription(
  db: Db,
  userId: string,
  sub: { kind: 'webpush'; endpoint: string; keys: { p256dh: string; auth: string } } | { kind: 'expo'; token: string },
) {
  const endpoint = sub.kind === 'webpush' ? sub.endpoint : sub.token;
  const keys = sub.kind === 'webpush' ? sub.keys : null;
  await db
    .insert(pushSubscriptions)
    .values({ userId, kind: sub.kind, endpoint, keys })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, kind: sub.kind, keys, lastSeenAt: new Date() },
    });
}

export async function deleteSubscription(db: Db, userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function listPreferences(db: Db, userId: string, types: readonly NotificationType[]) {
  const rows = await db
    .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  const chosen = new Map(rows.map((r) => [r.type, r.enabled]));
  return types.map((t) => ({
    type: t.id,
    label: t.label,
    module: t.module,
    enabled: chosen.get(t.id) ?? t.defaultEnabled,
  }));
}

export async function setPreference(db: Db, userId: string, type: string, enabled: boolean) {
  await db
    .insert(notificationPreferences)
    .values({ userId, type, enabled })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.type],
      set: { enabled, updatedAt: new Date() },
    });
}
