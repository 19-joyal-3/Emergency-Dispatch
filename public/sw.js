/**
 * Resylix (Vanguard Geo) — Hardened Offline-First Tactical Service Worker
 * Designed for zero-connectivity field resilience, PMTiles vector caches,
 * Stale-While-Revalidate asset streaming, and instant offline PWA launch.
 */

const CACHE_NAME = 'resylix-dispatch-v13';
const TILE_CACHE_NAME = 'resylix-maptiles-v1';
const MAX_TILE_CACHE_ITEMS = 600;

const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-icon-512x512.png',
  '/icons.svg',
  '/manifest.webmanifest',
  '/kerala_satellite.pmtiles'
];

/**
 * Trim tile cache to prevent device storage bloat
 */
async function trimTileCache(maxItems) {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map(req => cache.delete(req)));
    }
  } catch (_e) {
    // Non-blocking trim notice
  }
}

// ================= INSTALL EVENT =================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Pre-cache app shell and offline pmtiles vector package
      await cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] App shell pre-caching notice:', err);
      });

      // 2. Discover and pre-cache all compiled production JS and CSS bundles from index.html
      try {
        const resp = await fetch('/index.html', { cache: 'no-cache' });
        if (resp.ok) {
          const html = await resp.text();
          const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
          if (assetUrls.length > 0) {
            await cache.addAll(assetUrls);
            console.log('[SW] Pre-cached production chunks:', assetUrls.length, 'assets');
          }
        }
      } catch (err) {
        console.warn('[SW] Production chunk discovery notice:', err);
      }
    })
  );
  self.skipWaiting();
});

// ================= ACTIVATE EVENT =================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// ================= FETCH EVENT =================
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // 1. NAVIGATION REQUESTS (HTML Pages)
  // Network-First with 1.5s timeout, falling back directly to cached /index.html for instant offline launch
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Navigation timeout')), 1500)
          );
          const networkResponse = await Promise.race([
            fetch(event.request),
            timeoutPromise
          ]);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          }
        } catch (_err) {
          // Offline, airplane mode, or network drop
        }
        const cachedHtml = await caches.match('/index.html') || await caches.match('/');
        return cachedHtml || Response.error();
      })()
    );
    return;
  }

  // 2. MAP TILE REQUESTS (OpenStreetMap, Carto, ArcGIS, Stamen)
  const isMapTile = /tile\.openstreetmap\.org|arcgisonline\.com|basemaps\.cartocdn\.com/.test(requestUrl.href);
  if (isMapTile) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILE_CACHE_NAME);
        const cachedTile = await cache.match(event.request);

        // If tile is cached, return it immediately and revalidate in background
        if (cachedTile) {
          fetch(event.request)
            .then(async (networkRes) => {
              if (networkRes.ok && networkRes.status === 200) {
                await cache.put(event.request, networkRes.clone());
                trimTileCache(MAX_TILE_CACHE_ITEMS);
              }
            })
            .catch(() => undefined);
          return cachedTile;
        }

        // Otherwise fetch over network and cache
        try {
          const networkRes = await fetch(event.request);
          if (networkRes.ok && networkRes.status === 200) {
            await cache.put(event.request, networkRes.clone());
            trimTileCache(MAX_TILE_CACHE_ITEMS);
          }
          return networkRes;
        } catch (_e) {
          return Response.error();
        }
      })()
    );
    return;
  }

  // 3. PMTILES RANGE REQUESTS
  const isPmtiles = requestUrl.pathname.endsWith('.pmtiles') || requestUrl.searchParams.has('pmtiles');
  if (isPmtiles) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch (_e) {
          const cache = await caches.open(CACHE_NAME);
          const match = await cache.match('/kerala_satellite.pmtiles');
          return match || Response.error();
        }
      })()
    );
    return;
  }

  // 4. STATIC PRODUCTION CHUNKS & MEDIA (Same Origin /assets/*, .js, .css, images)
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then(async (networkResponse) => {
            if (networkResponse.ok && networkResponse.status === 200) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(event.request, networkResponse.clone()).catch(() => undefined);
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || Response.error());

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ================= MESSAGE BUS =================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({
      version: CACHE_NAME,
      tileCache: TILE_CACHE_NAME
    });
  }

  if (event.data.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE_NAME).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
});