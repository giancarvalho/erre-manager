// Push on this device: Web Push through the service worker (web) or Expo Push (Android/iOS).
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api } from './api';
import { readPref, writePref } from './storage';

const isWeb = Platform.OS === 'web';
const TOKEN_KEY = 'erre:push-token';

export type PushResult = { ok: true } | { ok: false; reason: string };

type PushConfig = { enabled: boolean; webPushPublicKey: string | null };

function webSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Registers the service worker on the web (network-first, push, notificationclick). */
export function registerServiceWorker(): void {
  if (!isWeb || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

/** Why push can't be turned on here, or null. */
export async function pushUnavailableReason(): Promise<string | null> {
  const config = await api<PushConfig>('/v1/push/config');
  if (!config.enabled) return 'As notificações estão desligadas no momento.';
  if (isWeb) {
    if (!webSupported())
      return 'Este navegador não aceita notificações. No iPhone, instale o app na tela inicial primeiro.';
    if (!config.webPushPublicKey) return 'As notificações pela web ainda não foram configuradas.';
    return null;
  }
  if (!projectId()) return 'Este aparelho ainda não pode receber notificações (falta configurar o projeto).';
  return null;
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export async function isPushOn(): Promise<boolean> {
  if (isWeb) {
    if (!webSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(await reg?.pushManager.getSubscription());
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' && !!readPref(TOKEN_KEY);
}

export async function turnPushOn(): Promise<PushResult> {
  const reason = await pushUnavailableReason();
  if (reason) return { ok: false, reason };
  try {
    if (isWeb) {
      const config = await api<PushConfig>('/v1/push/config');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return { ok: false, reason: 'Você não permitiu notificações neste navegador.' };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.webPushPublicKey!) as BufferSource,
      });
      const json = sub.toJSON();
      await api('/v1/push/subscriptions', {
        method: 'POST',
        body: { kind: 'webpush', endpoint: json.endpoint, keys: json.keys },
      });
      return { ok: true };
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted')
      return { ok: false, reason: 'Você não permitiu notificações. Dá pra mudar nos ajustes do aparelho.' };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId()! })).data;
    await api('/v1/push/subscriptions', { method: 'POST', body: { kind: 'expo', token } });
    writePref(TOKEN_KEY, token);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Não deu pra ativar as notificações. Tente de novo.' };
  }
}

export async function turnPushOff(): Promise<PushResult> {
  try {
    if (isWeb) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api('/v1/push/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      return { ok: true };
    }
    const token = readPref(TOKEN_KEY);
    if (token) await api('/v1/push/subscriptions', { method: 'DELETE', body: { endpoint: token } });
    writePref(TOKEN_KEY, null);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Não deu pra desativar. Tente de novo.' };
  }
}

/** Native: tapping a notification opens its route (web: the service worker's notificationclick does it). */
export function useNotificationRouting(): void {
  useEffect(() => {
    if (isWeb) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
