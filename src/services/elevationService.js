/**
 * ==============================================================================
 * KERALA TOPOGRAPHIC ELEVATION SERVICE
 * ==============================================================================
 * Computes altitude and climb gradients along route geometry across Kerala's
 * three physiographic zones:
 *  1. Coastal Lowlands (Arabian Sea to midlands: 0m - 15m; Kuttanad: -2m)
 *  2. Midlands (River valleys & undulating laterite hills: 20m - 180m)
 *  3. Western Ghats Highlands (Wayanad, Idukki, Munnar, Nilgiris: 600m - 1,800m)
 * ==============================================================================
 */

function haversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Topographic baseline estimator for any coordinate inside Kerala.
 * Grounds altitude based on known regional hypsometric landforms.
 */
export function estimateKeralaAltitude(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 20;

  // 1. Kuttanad below-sea-level depression (Alappuzha)
  if (lat >= 9.35 && lat <= 9.62 && lng >= 76.35 && lng <= 76.55) {
    return Math.max(1, Math.round(2 + Math.sin(lat * 50) * 1.5));
  }

  // 2. Wayanad High-Range Plateau & Thamarassery / Vythiri Ghats
  if (lat >= 11.45 && lat <= 11.95 && lng >= 75.90 && lng <= 76.45) {
    // Proximity to Chembra / Ghats crest
    const ghatDist = Math.max(0, (lng - 75.92) / 0.35);
    const baseWayanad = 720 + ghatDist * 320;
    // Micro-ridges
    const ridgeNoise = Math.sin(lat * 120) * 45 + Math.cos(lng * 90) * 35;
    return Math.round(baseWayanad + ridgeNoise);
  }

  // 3. Idukki & Munnar High Ranges
  if (lat >= 9.65 && lat <= 10.35 && lng >= 76.75 && lng <= 77.30) {
    const munnarDist = Math.max(0, (lng - 76.70) / 0.40);
    const baseIdukki = 680 + munnarDist * 650;
    const ridgeNoise = Math.sin(lat * 100) * 80 + Math.cos(lng * 120) * 60;
    return Math.round(baseIdukki + ridgeNoise);
  }

  // 4. Palakkad Gap (lowland pass between Nilgiris and Anamalai)
  if (lat >= 10.65 && lat <= 10.95 && lng >= 76.40 && lng <= 76.85) {
    return Math.round(75 + (lng - 76.40) * 90 + Math.sin(lat * 40) * 12);
  }

  // 5. Agasthyamala / Ponmudi Foothills (Trivandrum East)
  if (lat >= 8.50 && lat <= 8.95 && lng >= 77.00 && lng <= 77.35) {
    const hillDist = Math.max(0, (lng - 76.98) / 0.30);
    return Math.round(120 + hillDist * 750 + Math.sin(lat * 80) * 40);
  }

  // 6. Western Coastline vs Midlands Gradient
  // Coast is generally west of lng ~76.2 in north, ~76.6 in south
  const coastLng = 75.0 + (lat - 8.3) * 0.14;
  const inlandDistKm = Math.max(0, haversineDistKm(lat, coastLng, lat, lng));

  if (inlandDistKm < 12) {
    // Coastal plain
    return Math.round(3 + (inlandDistKm / 12) * 18);
  } else if (inlandDistKm < 45) {
    // Undulating midlands
    const midlandAlt = 20 + ((inlandDistKm - 12) / 33) * 160;
    const localHill = Math.sin(lat * 80 + lng * 60) * 18;
    return Math.round(midlandAlt + localHill);
  } else {
    // Foothills to Ghats
    const foothillAlt = 180 + ((inlandDistKm - 45) / 35) * 550;
    return Math.round(foothillAlt);
  }
}

/**
 * Calculates a complete elevation profile with climb metrics for a route geometry.
 * @param {Array<[number, number]>} geometry - Array of [lat, lng] points
 * @param {number} maxSamples - Maximum sample resolution (default: 60)
 * @returns {Object} Elevation profile metadata and samples
 */
export function calculateRouteElevation(geometry = [], maxSamples = 60) {
  if (!Array.isArray(geometry) || geometry.length < 2) {
    return {
      samples: [],
      minElevation: 0,
      maxElevation: 0,
      totalClimb: 0,
      totalDescent: 0,
      maxGradient: 0,
      totalDistanceKm: 0
    };
  }

  // Calculate cumulative distances
  let cumulativeDist = 0;
  const distAlong = [0];
  for (let i = 1; i < geometry.length; i++) {
    const d = haversineDistKm(geometry[i - 1][0], geometry[i - 1][1], geometry[i][0], geometry[i][1]);
    cumulativeDist += d;
    distAlong.push(cumulativeDist);
  }

  const totalDistanceKm = cumulativeDist;
  const sampleCount = Math.min(maxSamples, Math.max(12, Math.floor(geometry.length / 2)));
  const step = totalDistanceKm / (sampleCount - 1 || 1);

  const samples = [];
  let geomIdx = 0;

  for (let s = 0; s < sampleCount; s++) {
    const targetDist = s * step;
    while (geomIdx < distAlong.length - 1 && distAlong[geomIdx + 1] < targetDist) {
      geomIdx++;
    }

    const p1 = geometry[geomIdx];
    const p2 = geometry[Math.min(geomIdx + 1, geometry.length - 1)];
    const d1 = distAlong[geomIdx];
    const d2 = distAlong[Math.min(geomIdx + 1, distAlong.length - 1)];
    const segmentLen = d2 - d1;
    const ratio = segmentLen > 0.001 ? Math.min(1, Math.max(0, (targetDist - d1) / segmentLen)) : 0;

    const lat = p1[0] + (p2[0] - p1[0]) * ratio;
    const lng = p1[1] + (p2[1] - p1[1]) * ratio;
    const elevationM = estimateKeralaAltitude(lat, lng);

    samples.push({
      distanceKm: +targetDist.toFixed(2),
      elevationM,
      lat,
      lng
    });
  }

  // Smooth elevation array with rolling average (3-point window)
  for (let i = 1; i < samples.length - 1; i++) {
    samples[i].elevationM = Math.round(
      (samples[i - 1].elevationM + samples[i].elevationM * 2 + samples[i + 1].elevationM) / 4
    );
  }

  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let totalClimb = 0;
  let totalDescent = 0;
  let maxGradient = 0;

  for (let i = 0; i < samples.length; i++) {
    const alt = samples[i].elevationM;
    if (alt < minElevation) minElevation = alt;
    if (alt > maxElevation) maxElevation = alt;

    if (i > 0) {
      const diff = alt - samples[i - 1].elevationM;
      const distM = (samples[i].distanceKm - samples[i - 1].distanceKm) * 1000;
      if (diff > 0) totalClimb += diff;
      else totalDescent += Math.abs(diff);

      if (distM > 10) {
        const grad = Math.abs(diff) / distM * 100;
        if (grad > maxGradient) maxGradient = +grad.toFixed(1);
      }
    }
  }

  return {
    samples,
    minElevation: minElevation === Infinity ? 0 : minElevation,
    maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
    totalClimb: Math.round(totalClimb),
    totalDescent: Math.round(totalDescent),
    maxGradient,
    totalDistanceKm: +totalDistanceKm.toFixed(2)
  };
}
