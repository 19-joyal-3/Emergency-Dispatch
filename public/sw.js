const CACHE_NAME = 'emergency-dispatch-v4';
const APP_SHELL = ['/', '/index.html', '/favicon.svg', '/icons.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isMapTile = /tile\.openstreetmap\.org/.test(requestUrl.href);
  if (requestUrl.origin !== self.location.origin && !isMapTile) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkRequest = fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok || isMapTile) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      });

      if (cachedResponse && event.request.mode !== 'navigate') {
        event.waitUntil(networkRequest.catch(() => undefined));
        return cachedResponse;
      }

      if (event.request.mode === 'navigate') {
        return networkRequest.catch(() => caches.match('/index.html'));
      }
      return networkRequest.catch(() => Response.error());
    })
  );
});