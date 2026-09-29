/**
 * ==============================================================================
 * LIVE WEATHER & MONSOON PRECIPITATION RADAR SERVICE
 * ==============================================================================
 * Integrates live radar rainfall layers over Kerala using RainViewer public API.
 * Tracks monsoon fronts and cloudburst clusters across the Western Ghats.
 * ==============================================================================
 */

let cachedRadarMetadata = null;
let lastFetchTime = 0;

/**
 * Fetches the latest radar timestamps and tile path from RainViewer.
 */
export async function fetchLatestRadarInfo() {
  const now = Date.now();
  // Cache for 2 minutes to respect rate limits
  if (cachedRadarMetadata && (now - lastFetchTime) < 120000) {
    return cachedRadarMetadata;
  }

  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`RainViewer HTTP error ${res.status}`);
    const data = await res.json();

    const host = data.host || 'https://tilecache.rainviewer.com';
    const pastFrames = data.radar?.past || [];
    const nowcastFrames = data.radar?.nowcast || [];
    const allFrames = [...pastFrames, ...nowcastFrames];

    if (allFrames.length === 0) {
      throw new Error('No radar frames available');
    }

    // Latest past frame represents ground truth observations
    const latestFrame = pastFrames[pastFrames.length - 1] || allFrames[allFrames.length - 1];
    const tileUrl = `${host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

    const frameDate = new Date(latestFrame.time * 1000);
    const timeString = frameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    cachedRadarMetadata = {
      tileUrl,
      time: latestFrame.time,
      timeString,
      host,
      rawPath: latestFrame.path
    };
    lastFetchTime = now;
    return cachedRadarMetadata;
  } catch (err) {
    console.warn('[RADAR] Unable to fetch real-time radar metadata from RainViewer:', err.message);
    // Graceful fallback to static standard radar structure if offline or blocked
    return {
      tileUrl: 'https://tilecache.rainviewer.com/v2/radar/nowcast/256/{z}/{x}/{y}/2/1_1.png',
      time: Math.floor(Date.now() / 1000),
      timeString: 'Live Mode',
      fallback: true
    };
  }
}

/**
 * Creates and attaches a Leaflet tile layer for live weather radar.
 * @param {Object} L - Leaflet global instance
 * @returns {Promise<{ layer: Object, timeString: string }>}
 */
export async function createRadarTileLayer(L) {
  if (!L || typeof L.tileLayer !== 'function') {
    throw new Error('Leaflet instance is required');
  }

  const info = await fetchLatestRadarInfo();

  const layer = L.tileLayer(info.tileUrl, {
    tileSize: 256,
    opacity: 0.65,
    zIndex: 450,
    maxNativeZoom: 7,
    maxZoom: 18,
    minZoom: 1,
    attribution: 'RainViewer Radar'
  });

  return {
    layer,
    timeString: info.timeString,
    fallback: info.fallback || false
  };
}
