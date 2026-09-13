// KSDMA Multi-Hazard Vulnerability Zones (Western Ghats Landslides & River Flood Basins)

export const KERALA_HAZARD_ZONES = [
  {
    id: 'hz_wayanad',
    name: 'Wayanad Meppadi-Chooralmala Landslide Belt',
    type: 'landslide',
    riskLevel: 'Severe',
    color: '#ef4444',
    fillColor: '#dc2626',
    fillOpacity: 0.28,
    description: 'Steep hill slopes prone to saturated debris flows during torrential monsoons.',
    center: [11.5500, 76.1300],
    polygon: [
      [11.6200, 76.0800],
      [11.6400, 76.1600],
      [11.5300, 76.2200],
      [11.4700, 76.1400],
      [11.5200, 76.0600]
    ]
  },
  {
    id: 'hz_idukki',
    name: 'Idukki Munnar-Devikulam Ghat Slopes',
    type: 'landslide',
    riskLevel: 'High',
    color: '#f97316',
    fillColor: '#ea580c',
    fillOpacity: 0.25,
    description: 'High-altitude ghat escarpments prone to rockfalls and mudslides along NH 85.',
    center: [10.0889, 77.0595],
    polygon: [
      [10.1500, 77.0200],
      [10.1400, 77.1200],
      [10.0200, 77.1000],
      [10.0100, 77.0000]
    ]
  },
  {
    id: 'hz_nelliyampathy',
    name: 'Palakkad Nelliyampathy Ghat Section',
    type: 'landslide',
    riskLevel: 'Moderate',
    color: '#f59e0b',
    fillColor: '#d97706',
    fillOpacity: 0.22,
    description: 'Single-access hill route vulnerable to fallen boulders and soil collapse.',
    center: [10.5342, 76.6936],
    polygon: [
      [10.5800, 76.6500],
      [10.5700, 76.7400],
      [10.4800, 76.7200],
      [10.4900, 76.6400]
    ]
  },
  {
    id: 'hz_kuttanad',
    name: 'Kuttanad Below-Sea-Level Flood Basin',
    type: 'flood',
    riskLevel: 'Severe',
    color: '#38bdf8',
    fillColor: '#0284c7',
    fillOpacity: 0.30,
    description: 'Below-sea-level paddy wetlands prone to prolonged waterlogging and road submersion.',
    center: [9.4500, 76.4500],
    polygon: [
      [9.5500, 76.3800],
      [9.5600, 76.5300],
      [9.3500, 76.5400],
      [9.3300, 76.3900]
    ]
  },
  {
    id: 'hz_chalakudy',
    name: 'Chalakudy River Inundation Plain',
    type: 'flood',
    riskLevel: 'High',
    color: '#06b6d4',
    fillColor: '#0891b2',
    fillOpacity: 0.25,
    description: 'Low-elevation riparian zone downstream of Sholayar and Poringalkuthu dams.',
    center: [10.3000, 76.3300],
    polygon: [
      [10.3500, 76.2800],
      [10.3700, 76.3900],
      [10.2500, 76.4100],
      [10.2300, 76.2900]
    ]
  }
];

// Ray-casting point-in-polygon algorithm
export function pointInPolygon(point, polygon) {
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

// Distance from point to hazard center in km
function approxKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * 111;
  const dLon = (lon2 - lon1) * 111 * Math.cos(lat1 * Math.PI / 180);
  return Math.hypot(dLat, dLon);
}

/**
 * Check if a route geometry intersects or runs close (within 4km) to any active hazard zones
 */
export function checkRouteHazardIntersection(geometry = []) {
  if (!Array.isArray(geometry) || geometry.length === 0) return [];
  const activeAlerts = [];

  for (const zone of KERALA_HAZARD_ZONES) {
    let intersects = false;
    let minDistance = 999;

    for (const pt of geometry) {
      if (pointInPolygon(pt, zone.polygon)) {
        intersects = true;
        minDistance = 0;
        break;
      }
      const dist = approxKm(pt[0], pt[1], zone.center[0], zone.center[1]);
      if (dist < minDistance) minDistance = dist;
    }

    if (intersects || minDistance <= 4.0) {
      activeAlerts.push({
        zone,
        intersects,
        minDistanceKm: parseFloat(minDistance.toFixed(1))
      });
    }
  }

  return activeAlerts;
}
