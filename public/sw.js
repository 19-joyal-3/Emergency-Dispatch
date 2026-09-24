const CACHE_NAME = 'emergency-dispatch-v9';
const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.webmanifest',
  '/kerala_satellite.pmtiles'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Pre-cache app shell and local pmtiles vector package
      await cache.addAll(APP_SHELL).catch((err) => console.warn('App shell caching notice:', err));

      // 2. Discover and pre-cache all compiled production JS and CSS bundles from index.html
      try {
        const resp = await fetch('/index.html');
        if (resp.ok) {
          const html = await resp.text();
          const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
          if (assetUrls.length > 0) {
            await cache.addAll(assetUrls);
            console.log('[SW] Pre-cached all production bundle assets:', assetUrls);
          }
        }
      } catch (err) {
        console.warn('[SW] Asset discovery notice:', err);
      }
    })
  );
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
  const isMapTile = /tile\.openstreetmap\.org|arcgisonline\.com/.test(requestUrl.href);
  const isPmtilesRangeRequest = event.request.headers.has('range') && (
    requestUrl.pathname.endsWith('.pmtiles') || requestUrl.searchParams.has('pmtiles')
  );
  if (requestUrl.origin !== self.location.origin && !isMapTile && !isPmtilesRangeRequest) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Background revalidation
      const networkRequest = fetch(event.request).then((networkResponse) => {
        if ((networkResponse.ok || isMapTile) && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()).catch(() => undefined));
        }
        return networkResponse;
      });

      // 1. Static asset or map tile cache hit (Cache-First)
      if (cachedResponse && event.request.mode !== 'navigate') {
        event.waitUntil(networkRequest.catch(() => undefined));
        return cachedResponse;
      }

      // 2. Page Navigation: Try network with fast timeout, fallback to cached index.html
      if (event.request.mode === 'navigate') {
        return networkRequest.catch(() => caches.match('/index.html'));
      }

      // 3. Fallback: try network or cached response
      return networkRequest.catch(() => cachedResponse || Response.error());
    })
  );
});