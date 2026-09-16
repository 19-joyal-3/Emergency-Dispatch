import { solveDijkstra, haversineDistance, findClosestNode } from './routing.js';
import { isValhallaConfigured, requestValhallaRoute } from './valhallaApi.js';

/**
 * Checks if a route geometry intersects any active road blockages (within 450m).
 */
export function isGeometryBlocked(geometry = [], blockages = []) {
  const activeBlocks = blockages.filter(b => b.active);
  if (activeBlocks.length === 0 || !geometry || geometry.length === 0) return false;

  for (const pt of geometry) {
    for (const b of activeBlocks) {
      if (b.lat && b.lng) {
        const d = haversineDistance(pt[0], pt[1], b.lat, b.lng);
        if (d < 0.45) return true;
      }
    }
  }
  return false;
}

/**
 * High-fidelity Real-Road Routing via Open Source Routing Machine (OSRM)
 * Follows actual street curves, highways, and mountain passes across Kerala.
 */
export async function routeWithOSRM(start, end, transport = 'car', blockages = [], signal) {
  const profile = transport === 'walk' ? 'walking' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  const res = await fetch(url, { signal: signal || AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`OSRM HTTP error ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM routing unavailable: ${data.code}`);
  }

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

    const blocked = isGeometryBlocked(geometry, blockages);

    return {
      source: 'osrm',
      sourceLabel: '🌐 Real Road Network (OSRM)',
      geometry,
      distance: distanceKm,
      travelTimeMinutes: durationMins,
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
export async function routeWithTomTom(start, end, apiKey, transport = 'car', blockages = [], signal) {
  if (!apiKey || !apiKey.trim()) return null;
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

  const blocked = isGeometryBlocked(geometry, blockages);

  return {
    source: 'tomtom_orbis',
    sourceLabel: '● TomTom Live Traffic Routing',
    distance: distKm,
    travelTimeMinutes: timeMins,
    trafficDelayMinutes: delayMins,
    geometry,
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
  if (!start || !end || !mapData?.nodes) return null;

  const startClosest = findClosestNode(start.lat, start.lng, mapData.nodes);
  const endClosest = findClosestNode(end.lat, end.lng, mapData.nodes);

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
      nodes: [startClosest.id],
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
  const dijkstraRes = solveDijkstra(startClosest.id, endClosest.id, mapData.nodes, mapData.edges, blockages, transport);
  if (!dijkstraRes) return null;

  const fullGeom = [
    [start.lat, start.lng],
    ...(dijkstraRes.geometry || []),
    [end.lat, end.lng]
  ];

  const startNodeObj = mapData.nodes[startClosest.id];
  const endNodeObj = mapData.nodes[endClosest.id];
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
  if (!start || !end || typeof start.lat !== 'number' || typeof end.lat !== 'number') {
    return null;
  }

  // 1. Try Online Routing if internet connectivity is detected
  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  if (isOnline) {
    // 1A. Attempt TomTom Orbis with Live Traffic if API key is configured
    if (tomtomApiKey && tomtomApiKey.trim()) {
      try {
        const ttRoute = await routeWithTomTom(start, end, tomtomApiKey, transport, blockages, signal);
        if (ttRoute && !ttRoute.isBlocked) {
          return ttRoute;
        }
      } catch (err) {
        console.warn('[ROUTING] TomTom route unavailable, falling back to OSRM:', err.message);
      }
    }

    // 1B. Primary Real-Road Engine: OSRM (OpenStreetMap Kerala Road Network)
    try {
      const osrmRoute = await routeWithOSRM(start, end, transport, blockages, signal);
      if (osrmRoute && !osrmRoute.isBlocked) {
        return osrmRoute;
      }
      if (osrmRoute && osrmRoute.isBlocked) {
        console.warn('[ROUTING] All OSRM routes intersect active blockages; using local avoidance Dijkstra');
      }
    } catch (err) {
      console.warn('[ROUTING] OSRM route unavailable, falling back to local graph:', err.message);
    }

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
        if (valhallaRes) {
          return {
            ...valhallaRes,
            sourceLabel: 'Valhalla Real-Road'
          };
        }
      } catch (err) {
        console.warn('[ROUTING] Valhalla route unavailable:', err.message);
      }
    }
  }

  // 2. Offline Fallback: Local Graph & Dijkstra Engine
  return routeWithOfflineGraph({ start, end, mapData, blockages, transport });
}
