// Portado de queridometro@7c5c5bf:public/sw.js (só na web; o nativo usa expo-notifications).
const CACHE_NAME = 'erre-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network-first; o app requer conexão para funcionar.
// Nunca resolve para undefined — evita TypeError que faz o Chrome descartar o SW.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }),
  );
});

// Payload é sempre o PushPayload de packages/core/src/server/notifications.ts:
// { title, body, url }. JSON malformado/ausente não deve derrubar o worker.
self.addEventListener('push', (event) => {
  let payload = { title: 'Erre', body: 'Você tem uma notificação nova.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // mantém o payload padrão
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.ico',
      data: { url: payload.url },
    }),
  );
});

// Foca uma aba já aberta na URL certa em vez de sempre abrir uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
