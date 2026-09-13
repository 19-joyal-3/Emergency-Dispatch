/**
 * Dynamic Geofenced Hazard Early Warning & Proximity Interceptor Engine
 * 
 * 100% Offline, Zero Server Lag, Autonomous Spatial Calculations
 * Evaluates moving civilians, buses, and field responders against active disaster perimeters.
 */

import { haversineDistance } from './routing.js';

/**
 * Standard Ray-Casting algorithm to test if [lat, lng] is inside a polygon
 * @param {[number, number]} point - [lat, lng]
 * @param {Array<[number, number]>} polygon - Array of [lat, lng] coordinates
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Query all active entities (citizens, transit buses, emergency responders)
 * currently located inside a circular geofence perimeter.
 */
export function findEntitiesInGeofence({
  centerLat,
  centerLng,
  radiusKm = 2.5,
  customers = [],
  responders = [],
  buses = []
}) {
  const safeRadius = Math.max(0.2, Number(radiusKm));

  const matchedCustomers = (customers || [])
    .map(c => {
      if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return null;
      const dist = haversineDistance(centerLat, centerLng, c.lat, c.lng);
      return dist <= safeRadius ? { ...c, distanceKm: dist } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const matchedResponders = (responders || [])
    .map(r => {
      if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return null;
      const dist = haversineDistance(centerLat, centerLng, r.lat, r.lng);
      return dist <= safeRadius ? { ...r, distanceKm: dist } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const matchedBuses = (buses || [])
    .map(b => {
      if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return null;
      const dist = haversineDistance(centerLat, centerLng, b.lat, b.lng);
      return dist <= safeRadius ? { ...b, distanceKm: dist } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    customers: matchedCustomers,
    responders: matchedResponders,
    buses: matchedBuses,
    totalCount: matchedCustomers.length + matchedResponders.length + matchedBuses.length,
    radiusKm: safeRadius
  };
}

/**
 * Proactively check if a user's current position is within warning proximity of any active hazard.
 * Used for client-side early warning intercept alerts.
 */
export function checkUserHazardProximity({
  userLat,
  userLng,
  incidents = [],
  hazardZones = [],
  thresholdKm = 2.5
}) {
  if (typeof userLat !== 'number' || typeof userLng !== 'number') {
    return { isThreatDetected: false };
  }

  let closestHazard = null;
  let minDistance = Infinity;

  // 1. Check active reported emergency incidents
  for (const inc of incidents) {
    if (inc.status === 'resolved') continue;
    if (typeof inc.lat !== 'number' || typeof inc.lng !== 'number') continue;

    const dist = haversineDistance(userLat, userLng, inc.lat, inc.lng);
    if (dist <= thresholdKm && dist < minDistance) {
      minDistance = dist;
      closestHazard = {
        hazardId: inc.id,
        hazardType: inc.type || 'emergency',
        title: `Active ${inc.type?.toUpperCase() || 'EMERGENCY'} Incident Ahead`,
        description: inc.description || 'Active emergency reported along corridor.',
        distanceKm: dist,
        priority: inc.priority || 'critical',
        coordinates: [inc.lat, inc.lng],
        isInsidePolygon: false
      };
    }
  }

  // 2. Check official KSDMA Hazard Risk Polygons
  for (const zone of hazardZones) {
    const isInside = isPointInPolygon([userLat, userLng], zone.polygon);
    let dist = isInside ? 0 : Infinity;

    if (!isInside && zone.center) {
      dist = haversineDistance(userLat, userLng, zone.center[0], zone.center[1]);
    }

    if ((isInside || dist <= thresholdKm) && dist < minDistance) {
      minDistance = dist;
      closestHazard = {
        hazardId: zone.id,
        hazardType: zone.type || 'hazard_zone',
        title: `KSDMA Danger Zone: ${zone.name}`,
        description: isInside
          ? `WARNING: You are inside the designated ${zone.name} (${zone.riskLevel} Risk). Immediate evacuation advised.`
          : `Approaching ${zone.name} (${zone.riskLevel} Risk in ${dist.toFixed(1)} km).`,
        distanceKm: dist,
        priority: zone.riskLevel === 'Severe' ? 'critical' : 'high',
        coordinates: zone.center || zone.polygon[0],
        isInsidePolygon: isInside
      };
    }
  }

  if (closestHazard) {
    return {
      isThreatDetected: true,
      hazard: closestHazard,
      distanceKm: minDistance
    };
  }

  return { isThreatDetected: false };
}

/**
 * Format a targeted Geofenced Evacuation Alert payload
 */
export function formatGeofenceAlertMessage({
  incident,
  radiusKm,
  customMessage = '',
  dispatcherName = 'SEOC Emergency Commander'
}) {
  const incType = incident?.type?.toUpperCase() || 'HAZARD';
  const coordsStr = (typeof incident?.lat === 'number' && typeof incident?.lng === 'number')
    ? `[${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}]`
    : 'Local Ground';

  return {
    id: `GEO-${Date.now().toString(36).toUpperCase()}`,
    type: 'GEOFENCE_EVACUATION_WARNING',
    title: `🚨 TACTICAL EVACUATION WARNING (${radiusKm} KM RADIUS)`,
    incidentType: incType,
    priority: 'CRITICAL',
    message: customMessage || `Immediate evacuation or detour advised. Active ${incType} emergency at ${coordsStr}. Avoid corridor and seek nearest shelter.`,
    centerLat: incident?.lat,
    centerLng: incident?.lng,
    radiusKm,
    dispatcherName,
    timestamp: Date.now()
  };
}
