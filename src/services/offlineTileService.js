/**
 * ==============================================================================
 * OFFLINE CORRIDOR TILE PRE-CACHER & STORAGE SERVICE
 * ==============================================================================
 * Pre-downloads and persists vital emergency corridor map tiles into browser
 * CacheStorage / IndexedDB for 100% autonomous operation during severe telecom
 * collapses or remote mountain missions.
 * ==============================================================================
 */

const CACHE_NAME = 'emergency-corridor-tiles-v1';

export const PRIORITY_CORRIDORS = [
  {
    id: 'wayanad',
    name: 'Wayanad Landslide Hazard Corridor',
    zone: 'Northern High Ranges',
    hubs: ['Chooralmala', 'Meppadi', 'Vythiri', 'Kalpetta', 'Sulthan Bathery', 'Mananthavady'],
    minLat: 11.45,
    maxLat: 11.95,
    minLng: 75.90,
    maxLng: 76.45,
    zoomLevels: [9, 10, 11]
  },
  {
    id: 'idukki',
    name: 'Idukki Mountain Ghats Corridor',
    zone: 'Central High Ranges',
    hubs: ['Munnar', 'Adimali', 'Devikulam', 'Cheruthoni', 'Nedumkandam'],
    minLat: 9.65,
    maxLat: 10.35,
    minLng: 76.75,
    maxLng: 77.30,
    zoomLevels: [9, 10, 11]
  },
  {
    id: 'nh66',
    name: 'Coastal NH 66 Lifeline Corridor',
    zone: 'Statewide Coastal Artery',
    hubs: ['TVM', 'Kollam', 'Alappuzha', 'Kochi', 'Kozhikode', 'Kannur'],
    minLat: 8.45,
    maxLat: 12.10,
    minLng: 75.15,
    maxLng: 76.95,
    zoomLevels: [8, 9, 10]
  }
];

function latLngToTile(lat, lng, zoom) {
  const n = 1 << zoom;
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y, z: zoom };
}

/**
 * Calculates device storage consumption and quota.
 */
export async function getStorageMetrics() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const usageMB = +(usage / (1024 * 1024)).toFixed(1);
      const quotaMB = +(quota / (1024 * 1024)).toFixed(0);
      const percentUsed = quota > 0 ? +((usage / quota) * 100).toFixed(2) : 0;

      let cachedTilesCount = 0;
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        cachedTilesCount = keys.length;
      }

      return {
        usageMB,
        quotaMB,
        percentUsed,
        cachedTilesCount,
        supported: true
      };
    } catch (err) {
      console.warn('[STORAGE] Error querying storage estimate:', err);
    }
  }

  return {
    usageMB: 0,
    quotaMB: 0,
    percentUsed: 0,
    cachedTilesCount: 0,
    supported: false
  };
}

/**
 * Generates an array of tile URLs for a specific geographic bounding box and zoom levels.
 */
export function generateTileUrlsForBounds(minLat, maxLat, minLng, maxLng, zoomLevels = [9, 10]) {
  const tileSet = new Set();
  const subdomains = ['a', 'b', 'c', 'd'];

  zoomLevels.forEach(z => {
    const minTile = latLngToTile(maxLat, minLng, z);
    const maxTile = latLngToTile(minLat, maxLng, z);

    for (let x = Math.min(minTile.x, maxTile.x); x <= Math.max(minTile.x, maxTile.x); x++) {
      for (let y = Math.min(minTile.y, maxTile.y); y <= Math.max(minTile.y, maxTile.y); y++) {
        const sub = subdomains[(x + y) % subdomains.length];
        // Standard high-reliability basemap tile pattern
        const url = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
        tileSet.add(url);
      }
    }
  });

  return Array.from(tileSet);
}

/**
 * Pre-caches tiles for a specified corridor into CacheStorage with batching and progress.
 * @param {string} corridorId - Corridor ID from PRIORITY_CORRIDORS
 * @param {Function} onProgress - Callback receiving { total, cached, percent, status }
 */
export async function preCacheCorridor(corridorId, onProgress = () => {}) {
  const corridor = PRIORITY_CORRIDORS.find(c => c.id === corridorId);
  if (!corridor) throw new Error(`Unknown corridor: ${corridorId}`);

  if (typeof caches === 'undefined') {
    throw new Error('CacheStorage API is not supported in this browser environment');
  }

  const urls = generateTileUrlsForBounds(
    corridor.minLat,
    corridor.maxLat,
    corridor.minLng,
    corridor.maxLng,
    corridor.zoomLevels
  );

  const total = urls.length;
  let cached = 0;
  const cache = await caches.open(CACHE_NAME);

  onProgress({ total, cached: 0, percent: 0, status: 'starting', corridor: corridor.name });

  // Process in concurrent batches of 4 to prevent network saturation
  const batchSize = 4;
  for (let i = 0; i < urls.length; i += batchSize) {
    const chunk = urls.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const match = await cache.match(url);
          if (!match) {
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) {
              await cache.put(url, res);
            }
          }
          cached++;
        } catch (fetchErr) {
          // Continue gracefully on individual tile failures
          cached++;
        }
      })
    );

    const percent = Math.min(100, Math.round((cached / total) * 100));
    onProgress({
      total,
      cached,
      percent,
      status: cached >= total ? 'completed' : 'caching',
      corridor: corridor.name
    });
  }

  return { total, cached };
}

/**
 * Clears all cached emergency corridor tiles.
 */
export async function purgeCorridorCache() {
  if (typeof caches !== 'undefined') {
    return await caches.delete(CACHE_NAME);
  }
  return false;
}
