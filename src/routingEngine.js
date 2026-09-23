import { solveDijkstra, haversineDistance, findClosestNode } from './routing.js';
import { isValhallaConfigured, requestValhallaRoute } from './valhallaApi.js';
import defaultMapData from './mapData.json' with { type: 'json' };

/**
 * Checks if a route geometry intersects any active road blockages (within 450m).
 */
export function isGeometryBlocked(geometry = [], blockages = [], mapNodes = {}) {
  const activeBlocks = (blockages || []).filter(b => b.active);
  if (activeBlocks.length === 0 || !geometry || geometry.length === 0) return false;

  for (const b of activeBlocks) {
    let bLat = b.lat;
    let bLng = b.lng;
    const from = b.fromNode || b.from;
    const to = b.toNode || b.to;
    if ((!bLat || !bLng) && from && to && mapNodes?.[from] && mapNodes?.[to]) {
      bLat = (mapNodes[from].lat + mapNodes[to].lat) / 2;
      bLng = (mapNodes[from].lng + mapNodes[to].lng) / 2;
    }
    if (typeof bLat === 'number' && typeof bLng === 'number') {
      for (const pt of geometry) {
        if (haversineDistance(pt[0], pt[1], bLat, bLng) < 0.45) return true;
      }
    }
  }
  return false;
}

/**
 * High-fidelity Real-Road Routing via Open Source Routing Machine (OSRM)
 * Follows actual street curves, highways, and mountain passes across Kerala.
 */
export async function routeWithOSRM(start, end, transport = 'car', blockages = [], signal, mapData = null) {
  if (signal?.aborted) return null;
  if (!start || !end || !Number.isFinite(start.lat) || !Number.isFinite(start.lng) || !Number.isFinite(end.lat) || !Number.isFinite(end.lng)) {
    return null;
  }

  const profile = transport === 'walk' ? 'walking' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  const res = await fetch(url, { signal: signal || AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`OSRM HTTP error ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM routing unavailable: ${data.code}`);
  }

  const startClosest = mapData?.nodes ? findClosestNode(start.lat, start.lng, mapData.nodes) : null;
  const endClosest = mapData?.nodes ? findClosestNode(end.lat, end.lng, mapData.nodes) : null;
  const routeNodes = [startClosest?.id || 'origin', endClosest?.id || 'destination'];

  const parsedRoutes = data.routes.map((r, idx) => {
    const geometry = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const distanceKm = +(r.distance / 1000).toFixed(2);
    let durationMins = Math.round(r.duration / 60);
    if (transport === 'ambulance') durationMins = Math.max(1, Math.round(durationMins * 0.82));
    if (transport === 'bus') durationMins = Math.round(durationMins * 1.25);

    const steps = (r.legs?.[0]?.steps || []).map(s => {
      const m = s.maneuver || {};
      let inst = m.instruction;
      if (!inst) {
        const type = m.type || 'proceed';
        const mod = m.modifier ? ` ${m.modifier}` : '';
        const onto = s.name ? ` onto ${s.name}` : '';
        inst = `${type.charAt(0).toUpperCase() + type.slice(1)}${mod}${onto}`;
      }
      return {
        instruction: inst,
        name: s.name || '',
        distanceKm: +(s.distance / 1000).toFixed(2),
        durationMin: +(s.duration / 60).toFixed(1)
      };
    }).filter(s => s.distanceKm > 0 || s.name);

    const blocked = isGeometryBlocked(geometry, blockages, mapData?.nodes);

    return {
      source: 'osrm',
      sourceLabel: '🌐 Real Road Network (OSRM)',
      geometry,
      distance: distanceKm,
      travelTimeMinutes: durationMins,
      nodes: routeNodes,
      edges: [],
      steps,
      isBlocked: blocked,
      isDetour: idx > 0 || blocked
    };
  });

  // Return the first unblocked route option if available, otherwise return primary
  const clearRoute = parsedRoutes.find(r => !r.isBlocked);
  if (clearRoute) return clearRoute;
  return parsedRoutes[0];
}

/**
 * Real-Time Traffic-Aware Routing via TomTom Orbis Routing API
 */
export async function routeWithTomTom(start, end, apiKey, transport = 'car', blockages = [], signal, mapData = null) {
  if (signal?.aborted) return null;
  if (!apiKey || !apiKey.trim()) return null;
  if (!start || !end || !Number.isFinite(start.lat) || !Number.isFinite(start.lng) || !Number.isFinite(end.lat) || !Number.isFinite(end.lng)) {
    return null;
  }

  const travelMode = transport === 'walk' ? 'pedestrian' : (transport === 'bus' ? 'bus' : 'car');
  const cleanKey = encodeURIComponent(apiKey.trim());
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lng}:${end.lat},${end.lng}/json?key=${cleanKey}&traffic=true&travelMode=${travelMode}`;

  const res = await fetch(url, { signal: signal || AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`TomTom Routing error: ${res.status}`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error('No TomTom route returned');

  const geometry = [];
  for (const leg of route.legs || []) {
    for (const pt of leg.points || []) {
      geometry.push([pt.latitude, pt.longitude]);
    }
  }

  const distKm = +(route.summary.lengthInMeters / 1000).toFixed(2);
  const timeMins = Math.round(route.summary.travelTimeInSeconds / 60);
  const delayMins = Math.round((route.summary.trafficDelayInSeconds || 0) / 60);

  const steps = (route.guidance?.instructions || []).map(inst => ({
    instruction: inst.message || inst.maneuver || 'Proceed',
    name: inst.street || '',
    distanceKm: +(inst.routeOffsetInMeters / 1000).toFixed(2),
    durationMin: +(inst.travelTimeInSeconds / 60).toFixed(1)
  }));

  const startClosest = mapData?.nodes ? findClosestNode(start.lat, start.lng, mapData.nodes) : null;
  const endClosest = mapData?.nodes ? findClosestNode(end.lat, end.lng, mapData.nodes) : null;
  const routeNodes = [startClosest?.id || 'origin', endClosest?.id || 'destination'];

  const blocked = isGeometryBlocked(geometry, blockages, mapData?.nodes);

  return {
    source: 'tomtom_orbis',
    sourceLabel: '● TomTom Live Traffic Routing',
    distance: distKm,
    travelTimeMinutes: timeMins,
    trafficDelayMinutes: delayMins,
    geometry,
    nodes: routeNodes,
    edges: [],
    steps,
    isBlocked: blocked,
    isDetour: blocked
  };
}

/**
 * Resilient Offline Fallback using Local Road Graph & Dijkstra
 * Prevents zero-distance glitches for close hamlets and maintains connectivity with no signal.
 */
export function routeWithOfflineGraph({ start, end, mapData, blockages = [], transport = 'car' }) {
  const activeMapData = mapData || defaultMapData;
  if (!start || !end || !activeMapData?.nodes) return null;

  const startClosest = findClosestNode(start.lat, start.lng, activeMapData.nodes);
  const endClosest = findClosestNode(end.lat, end.lng, activeMapData.nodes);

  if (!startClosest?.id || !endClosest?.id) return null;

  const directDist = haversineDistance(start.lat, start.lng, end.lat, end.lng);

  // Close localities or hamlets snapped to the same cluster (< 8km)
  if (startClosest.id === endClosest.id || directDist < 8) {
    const roadDist = Math.max(0.2, +(directDist * 1.3).toFixed(2));
    const speed = transport === 'walk' ? 5 : (transport === 'bus' ? 35 : 55);
    const timeMins = Math.max(1, Math.round((roadDist / speed) * 60));

    const geom = [];
    const stepsCount = 6;
    for (let i = 0; i <= stepsCount; i++) {
      const t = i / stepsCount;
      geom.push([
        start.lat + (end.lat - start.lat) * t,
        start.lng + (end.lng - start.lng) * t
      ]);
    }

    return {
      source: 'tactical_offline',
      sourceLabel: '⚡ Tactical Offline Graph',
      nodes: [startClosest.id, endClosest.id],
      edges: [],
      distance: roadDist,
      travelTimeMinutes: timeMins,
      geometry: geom,
      steps: [
        { instruction: `Depart from ${start.name || 'Start'}`, distanceKm: 0, durationMin: 0 },
        { instruction: `Proceed along local corridor toward ${end.name || 'Destination'}`, distanceKm: roadDist, durationMin: timeMins },
        { instruction: `Arrive at ${end.name || 'Destination'}`, distanceKm: 0, durationMin: 0 }
      ]
    };
  }

  // Inter-district / Inter-city routing via local Dijkstra
  const dijkstraRes = solveDijkstra(startClosest.id, endClosest.id, activeMapData.nodes, activeMapData.edges, blockages, transport);
  if (!dijkstraRes) return null;

  const fullGeom = [
    [start.lat, start.lng],
    ...(dijkstraRes.geometry || []),
    [end.lat, end.lng]
  ];

  const startNodeObj = activeMapData.nodes[startClosest.id];
  const endNodeObj = activeMapData.nodes[endClosest.id];
  const leadInDist = haversineDistance(start.lat, start.lng, startNodeObj.lat, startNodeObj.lng);
  const leadOutDist = haversineDistance(end.lat, end.lng, endNodeObj.lat, endNodeObj.lng);
  const totalDist = +(dijkstraRes.distance + leadInDist + leadOutDist).toFixed(2);
  const speed = transport === 'walk' ? 5 : (transport === 'bus' ? 45 : 65);
  const totalTime = Math.max(1, Math.round((totalDist / speed) * 60));

  return {
    ...dijkstraRes,
    source: 'tactical_offline',
    sourceLabel: '⚡ Tactical Offline Graph',
    distance: totalDist,
    travelTimeMinutes: totalTime,
    geometry: fullGeom,
    steps: [
      { instruction: `Depart from ${start.name || 'Start'} toward ${startNodeObj.name}`, distanceKm: +leadInDist.toFixed(2), durationMin: 2 },
      ...dijkstraRes.edges.map(e => ({ instruction: `Follow ${e.name}`, distanceKm: e.distance, durationMin: Math.round((e.distance / speed) * 60) })),
      { instruction: `Arrive at ${end.name || 'Destination'}`, distanceKm: +leadOutDist.toFixed(2), durationMin: 2 }
    ]
  };
}

/**
 * Master Unified Routing Coordinator
 * Dispatches to TomTom -> OSRM -> Valhalla -> Offline Dijkstra based on network and credentials.
 */
export async function calculateBestRoute({
  start,
  end,
  mapData,
  transport = 'car',
  blockages = [],
  tomtomApiKey = '',
  signal
}) {
  const activeMapData = mapData || defaultMapData;
  if (signal?.aborted) return null;
  if (!start || !end || typeof start.lat !== 'number' || typeof end.lat !== 'number') {
    return null;
  }

  let candidateOsrm = null;

  // 1. Try Online Routing if internet connectivity is detected
  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  if (isOnline) {
    // 1A. Attempt TomTom Orbis with Live Traffic if API key is configured
    if (tomtomApiKey && tomtomApiKey.trim()) {
      try {
        const ttRoute = await routeWithTomTom(start, end, tomtomApiKey, transport, blockages, signal, mapData);
        if (signal?.aborted) return null;
        if (ttRoute && !ttRoute.isBlocked) {
          return ttRoute;
        }
      } catch (err) {
        if (signal?.aborted || err.name === 'AbortError') return null;
        console.warn('[ROUTING] TomTom route unavailable, falling back to OSRM:', err.message);
      }
    }

    if (signal?.aborted) return null;

    // 1B. Primary Real-Road Engine: OSRM (OpenStreetMap Kerala Road Network)
    try {
      candidateOsrm = await routeWithOSRM(start, end, transport, blockages, signal, mapData);
      if (signal?.aborted) return null;
      if (candidateOsrm && !candidateOsrm.isBlocked) {
        return candidateOsrm;
      }
      if (candidateOsrm && candidateOsrm.isBlocked) {
        console.warn('[ROUTING] Primary OSRM route intersects active blockage; attempting offline avoidance');
      }
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') return null;
      console.warn('[ROUTING] OSRM route unavailable, falling back to local graph:', err.message);
    }

    if (signal?.aborted) return null;

    // 1C. Valhalla (if custom self-hosted server is configured)
    if (isValhallaConfigured) {
      try {
        const avoidLocations = blockages.flatMap(b => (b.active && b.lat && b.lng ? [{ lat: b.lat, lng: b.lng }] : []));
        const valhallaRes = await requestValhallaRoute({
          start,
          end,
          transport,
          avoidLocations,
          signal
        });
        if (signal?.aborted) return null;
        if (valhallaRes) {
          return {
            ...valhallaRes,
            sourceLabel: 'Valhalla Real-Road'
          };
        }
      } catch (err) {
        if (signal?.aborted || err.name === 'AbortError') return null;
        console.warn('[ROUTING] Valhalla route unavailable:', err.message);
      }
    }
  }

  if (signal?.aborted) return null;

  // 2. Offline Fallback: Local Graph & Dijkstra Engine
  const offlineRoute = routeWithOfflineGraph({ start, end, mapData: activeMapData, blockages, transport });
  if (offlineRoute && !offlineRoute.isBlocked) {
    return offlineRoute;
  }

  // 3. Resilient fallback: return candidate route with blockage metadata rather than failing
  if (candidateOsrm) {
    return candidateOsrm;
  }
  return offlineRoute;
}
