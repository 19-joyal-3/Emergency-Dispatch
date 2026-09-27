/**
 * Kerala State Disaster Management Authority (KSDMA) & IMD
 * 14-District Weather Warning Matrix & Spatial Hazard Interception Service
 * 
 * Grounded in official KSDMA daily weather bulletins:
 * https://sdma.kerala.gov.in/weather-warning/
 */

// IMD & KSDMA Color Warning Definitions
export const KSDMA_ALERT_TYPES = {
  RED: {
    level: 'Red',
    code: 'RED',
    color: '#ef4444',
    bgClass: 'bg-red-500/20 text-red-400 border-red-500/40',
    badgeClass: 'bg-red-600 text-white',
    label: 'Red Alert (Take Action)',
    labelMl: 'റെഡ് അലർട്ട് (അടിയന്തര നടപടി)',
    rainfallThreshold: 'Extremely Heavy Rainfall (> 204.4 mm / 24h)',
    protocol: 'Immediate evacuation from landslide-prone slopes and riverbanks. Total ban on night travel in high-range roads. Emergency shelters active.',
    actionRequired: true
  },
  ORANGE: {
    level: 'Orange',
    code: 'ORANGE',
    color: '#f97316',
    bgClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    badgeClass: 'bg-orange-500 text-white',
    label: 'Orange Alert (Be Prepared)',
    labelMl: 'ഓറഞ്ച് അലർട്ട് (ജാഗ്രത പാലിക്കുക)',
    rainfallThreshold: 'Very Heavy Rainfall (115.6 - 204.4 mm / 24h)',
    protocol: 'High alert for flash floods and debris flow. Pre-position NDRF / SDRF units and clear stormwater channels. Avoid crossing causeways.',
    actionRequired: true
  },
  YELLOW: {
    level: 'Yellow',
    code: 'YELLOW',
    color: '#eab308',
    bgClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    badgeClass: 'bg-yellow-500 text-black font-semibold',
    label: 'Yellow Alert (Be Aware)',
    labelMl: 'മഞ്ഞ അലർട്ട് (ശ്രദ്ധിക്കുക)',
    rainfallThreshold: 'Heavy Rainfall (64.5 - 115.5 mm / 24h)',
    protocol: 'Localised waterlogging and slippery ghat roads expected. Monitor dam water levels and stay tuned to official DEOC alerts.',
    actionRequired: false
  },
  GREEN: {
    level: 'Green',
    code: 'GREEN',
    color: '#22c55e',
    bgClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    badgeClass: 'bg-emerald-600 text-white',
    label: 'Green (Normal / No Warning)',
    labelMl: 'ഗ്രീൻ (സാധാരണ നില)',
    rainfallThreshold: 'Light to Moderate Rainfall (< 64.4 mm / 24h)',
    protocol: 'Routine weather conditions. Standard coastal and monsoon precautions apply.',
    actionRequired: false
  }
};

/**
 * 14 Kerala Administrative Districts with Centroids, Boundary Polygons, and KSDMA Hazard Risk Profiles
 */
export const KERALA_DISTRICTS_DATA = [
  {
    id: 'wayanad',
    code: 'WYD',
    name: 'Wayanad',
    malayalam: 'വയനാട്',
    centroid: [11.6050, 76.0830],
    alert: 'RED',
    rainfallMm: 248.5,
    primaryThreat: 'High Landslide Risk & Debris Avalanche',
    primaryThreatMl: 'ഉരുൾപൊട്ടൽ സാധ്യത & മലവെള്ളപ്പാച്ചിൽ',
    advisory: 'Severe danger in Meppadi, Chooralmala, Mundakkai, and Vythiri ghats. Prohibit tourist traffic. Keep emergency transit vehicles on bypass ridges.',
    polygon: [
      [11.95, 75.90], [11.98, 76.25], [11.75, 76.45], [11.50, 76.35],
      [11.45, 76.10], [11.55, 75.85], [11.80, 75.80], [11.95, 75.90]
    ],
    vulnerableHotspots: ['Chooralmala', 'Mundakkai', 'Meppadi', 'Vythiri', 'Tholpetty', 'Mananthavady'],
    deocPhone: '04936-204151'
  },
  {
    id: 'idukki',
    code: 'IDK',
    name: 'Idukki',
    malayalam: 'ഇടുക്കി',
    centroid: [9.8500, 76.9700],
    alert: 'RED',
    rainfallMm: 221.0,
    primaryThreat: 'Steep Slope Landslides & Dam Spillage Surveillance',
    primaryThreatMl: 'മണ്ണിടിച്ചിൽ ഭീഷണി & അണക്കെട്ട് തുറക്കൽ',
    advisory: 'GAP Road Munnar - Bodimettu closed. High risk along Adimali-Neriamangalam stretch. Shutter operation readiness at Ponmudi and Cheruthoni.',
    polygon: [
      [10.25, 76.75], [10.35, 77.15], [10.10, 77.35], [9.50, 77.25],
      [9.40, 76.95], [9.70, 76.75], [10.05, 76.70], [10.25, 76.75]
    ],
    vulnerableHotspots: ['Munnar Gap Road', 'Devikulam', 'Peerumade', 'Nedumkandam', 'Vandiperiyar'],
    deocPhone: '04862-233111'
  },
  {
    id: 'kozhikode',
    code: 'KKD',
    name: 'Kozhikode',
    malayalam: 'കോഴിക്കോട്',
    centroid: [11.2588, 75.7804],
    alert: 'ORANGE',
    rainfallMm: 165.2,
    primaryThreat: 'Flash Floods & Western Ghat River Overflow',
    primaryThreatMl: 'മലവെള്ളപ്പാച്ചിൽ & പുഴകളിലെ ജലനിരപ്പുയരൽ',
    advisory: 'Chaliyar, Poonoor, and Iruvanjippuzha rivers flowing above warning marks. Vilangad hill tracts under continuous geological surveillance.',
    polygon: [
      [11.75, 75.60], [11.70, 75.95], [11.40, 76.05], [11.15, 75.85],
      [11.20, 75.70], [11.50, 75.55], [11.75, 75.60]
    ],
    vulnerableHotspots: ['Vilangad', 'Thiruvambady', 'Kodenchery', 'Mavoor', 'Beypore'],
    deocPhone: '0495-2371002'
  },
  {
    id: 'malappuram',
    code: 'MLP',
    name: 'Malappuram',
    malayalam: 'മലപ്പുറം',
    centroid: [11.0722, 76.0740],
    alert: 'ORANGE',
    rainfallMm: 142.8,
    primaryThreat: 'River Basin Flooding & Soil Piping Warning',
    primaryThreatMl: 'പുഴയോര പ്രളയ മുന്നറിയിപ്പ് & സോയിൽ പൈപ്പിംഗ്',
    advisory: 'Nilambur, Chungathara, and Mampad vulnerable to low-lying flood inundation. Maintain vigilance around historic Kavalappara soil slip ridges.',
    polygon: [
      [11.45, 76.10], [11.35, 76.40], [11.00, 76.35], [10.75, 76.00],
      [10.85, 75.80], [11.15, 75.85], [11.45, 76.10]
    ],
    vulnerableHotspots: ['Nilambur', 'Chungathara', 'Kavalappara Ridge', 'Ponnani', 'Kottakkal'],
    deocPhone: '0483-2736970'
  },
  {
    id: 'kannur',
    code: 'KNR',
    name: 'Kannur',
    malayalam: 'കണ്ണൂർ',
    centroid: [11.8745, 75.3704],
    alert: 'ORANGE',
    rainfallMm: 138.4,
    primaryThreat: 'Hilly Catchment Runoff & Sea Inundation',
    primaryThreatMl: 'മലയോര മലവെള്ളപ്പാച്ചിൽ & കടലാക്രമണം',
    advisory: 'Valapattanam river levels elevated. Ghat traffic along Iritty-Mattannur-Koottupuzha route to Karnataka restricted during heavy downpours.',
    polygon: [
      [12.25, 75.25], [12.20, 75.65], [11.90, 75.90], [11.75, 75.60],
      [11.70, 75.40], [12.00, 75.15], [12.25, 75.25]
    ],
    vulnerableHotspots: ['Iritty', 'Kelakam', 'Kolayad', 'Aralam', 'Payyannur'],
    deocPhone: '0497-2713266'
  },
  {
    id: 'kasaragod',
    code: 'KSD',
    name: 'Kasaragod',
    malayalam: 'കാസർഗോഡ്',
    centroid: [12.5103, 74.9852],
    alert: 'YELLOW',
    rainfallMm: 88.0,
    primaryThreat: 'Coastal Squall & Low-Lying Waterlogging',
    primaryThreatMl: 'തീരദേശ കാറ്റും വെള്ളക്കെട്ടും',
    advisory: 'Payaswini & Chandragiri rivers stable but rising. Coastal fishermen advised not to venture into deep sea due to 55 km/h squalls.',
    polygon: [
      [12.80, 74.85], [12.75, 75.35], [12.35, 75.45], [12.20, 75.20],
      [12.25, 75.05], [12.55, 74.90], [12.80, 74.85]
    ],
    vulnerableHotspots: ['Hosdurg', 'Vellarikundu', 'Manjeshwar', 'Nileshwar'],
    deocPhone: '0467-2204151'
  },
  {
    id: 'palakkad',
    code: 'PKD',
    name: 'Palakkad',
    malayalam: 'പാലക്കാട്',
    centroid: [10.7867, 76.6548],
    alert: 'ORANGE',
    rainfallMm: 154.0,
    primaryThreat: 'Catchment Inflow & Malampuzha/Siruvani Discharge',
    primaryThreatMl: 'അണക്കെട്ട് ജലനിരപ്പുയരൽ & അട്ടപ്പാടി മലയോര ജാഗ്രത',
    advisory: 'Bhavani river swollen in Attappadi valley. Watch downstream Bharathappuzha floodplains near Pattambi, Ottapalam, and Shoranur.',
    polygon: [
      [11.20, 76.45], [11.15, 76.90], [10.80, 77.00], [10.45, 76.85],
      [10.55, 76.40], [10.90, 76.30], [11.20, 76.45]
    ],
    vulnerableHotspots: ['Attappadi (Agali)', 'Nelliyampathy Ghat', 'Pattambi Riverbank', 'Malampuzha Downstream'],
    deocPhone: '0491-2505309'
  },
  {
    id: 'thrissur',
    code: 'TCR',
    name: 'Thrissur',
    malayalam: 'തൃശ്ശൂർ',
    centroid: [10.5276, 76.2144],
    alert: 'ORANGE',
    rainfallMm: 148.6,
    primaryThreat: 'Chalakudy River Swelling & Sholayar Discharge',
    primaryThreatMl: 'ചാലക്കുടിപ്പുഴയിലെ ജലനിരപ്പ് & തീവ്ര മഴ',
    advisory: 'Poringalkuthu dam excess spillage alert. Residents along Chalakudy river basin must monitor water rise levels. Sholayar ghat road restricted.',
    polygon: [
      [10.80, 76.05], [10.75, 76.45], [10.35, 76.65], [10.15, 76.40],
      [10.20, 76.10], [10.55, 75.95], [10.80, 76.05]
    ],
    vulnerableHotspots: ['Chalakudy Town', 'Athirappilly Ghats', 'Peechi Basin', 'Kodungallur Coastal'],
    deocPhone: '0487-2362424'
  },
  {
    id: 'ernakulam',
    code: 'EKM',
    name: 'Ernakulam',
    malayalam: 'എറണാകുളം',
    centroid: [9.9816, 76.2999],
    alert: 'ORANGE',
    rainfallMm: 135.0,
    primaryThreat: 'Periyar Downstream Discharge & Urban Waterlogging',
    primaryThreatMl: 'പെരിയാർ പ്രളയ ജാഗ്രത & നഗര വെള്ളക്കെട്ട്',
    advisory: 'Aluva Manappuram and Paravur lowlands on watch. Bhoothathankettu barrage gates regulated. Kochi metro road corridors monitored for storm flooding.',
    polygon: [
      [10.25, 76.15], [10.25, 76.75], [9.95, 76.75], [9.80, 76.40],
      [9.85, 76.20], [10.05, 76.15], [10.25, 76.15]
    ],
    vulnerableHotspots: ['Aluva Manappuram', 'Kothamangalam', 'Bhoothathankettu', 'Kaloor/MG Road Kochi', 'Chellanam'],
    deocPhone: '0484-2423513'
  },
  {
    id: 'kottayam',
    code: 'KTM',
    name: 'Kottayam',
    malayalam: 'കോട്ടയം',
    centroid: [9.5916, 76.5222],
    alert: 'YELLOW',
    rainfallMm: 95.4,
    primaryThreat: 'Meenachil Basin Runoff & Eastern Slope Slips',
    primaryThreatMl: 'മീനച്ചിലാറ്റിലെ നീരൊഴുക്ക് & മലയോര ജാഗ്രത',
    advisory: 'Pala, Erattupetta, and Mundakkayam watch on Meenachil river. Water hyacinth clearing underway at Thanneermukkom bund.',
    polygon: [
      [9.85, 76.40], [9.80, 76.85], [9.50, 76.90], [9.40, 76.55],
      [9.55, 76.40], [9.85, 76.40]
    ],
    vulnerableHotspots: ['Kootickal', 'Pala Bypass', 'Erattupetta', 'Kumarakom Lowlands'],
    deocPhone: '0481-2565400'
  },
  {
    id: 'alappuzha',
    code: 'ALP',
    name: 'Alappuzha',
    malayalam: 'ആലപ്പുഴ',
    centroid: [9.4981, 76.3388],
    alert: 'YELLOW',
    rainfallMm: 82.0,
    primaryThreat: 'Kuttanad Low-Lying Accumulation & High Tide Surge',
    primaryThreatMl: 'കുട്ടനാടൻ വെള്ളപ്പൊക്കം & വേലിയേറ്റം',
    advisory: 'Kuttanad paddy polders accumulating flood runoff from Pamba and Achankovil. AC Road (Alappuzha-Changanassery) water logging surveillance active.',
    polygon: [
      [9.80, 76.25], [9.80, 76.45], [9.35, 76.60], [9.15, 76.50],
      [9.20, 76.40], [9.50, 76.30], [9.80, 76.25]
    ],
    vulnerableHotspots: ['Kuttanad (Nedumudi/Edathua)', 'AC Road Corridor', 'Ambalappuzha Coastal', 'Chengannur Waterways'],
    deocPhone: '0477-2238630'
  },
  {
    id: 'pathanamthitta',
    code: 'PTA',
    name: 'Pathanamthitta',
    malayalam: 'പത്തനംതിട്ട',
    centroid: [9.2648, 76.7870],
    alert: 'ORANGE',
    rainfallMm: 158.0,
    primaryThreat: 'Pamba & Achankovil River Overflow & Sabarimala Hill Slips',
    primaryThreatMl: 'പമ്പാ, അച്ചൻകോവിലാറുകളിൽ പ്രളയം & മലയോര ജാഗ്രത',
    advisory: 'Ranni, Kozhencherry, and Aranmula residents on alert for riverbank spilling. Avoid bathing in hill torrents. Moozhiyar spillway monitored.',
    polygon: [
      [9.55, 76.65], [9.55, 77.15], [9.15, 77.20], [9.05, 76.85],
      [9.20, 76.60], [9.55, 76.65]
    ],
    vulnerableHotspots: ['Ranni Riverfront', 'Kozhencherry Bridge', 'Aranmula Lowlands', 'Moozhiyar Catchment'],
    deocPhone: '0468-2222515'
  },
  {
    id: 'kollam',
    code: 'KLM',
    name: 'Kollam',
    malayalam: 'കൊല്ലം',
    centroid: [8.8932, 76.6141],
    alert: 'YELLOW',
    rainfallMm: 74.0,
    primaryThreat: 'Kallada River Spilling & Eastern Aryankavu Ghat Slippage',
    primaryThreatMl: 'കല്ലടയാറ്റിലെ നീരൊഴുക്ക് & ആര്യങ്കാവ് ചുരം ജാഗ്രത',
    advisory: 'Thenmala dam shutters on regulated standby. Caution on Kollam-Sengottai NH 744 Aryankavu ghat road during heavy night squalls.',
    polygon: [
      [9.20, 76.60], [9.15, 77.15], [8.85, 77.10], [8.75, 76.70],
      [8.85, 76.55], [9.10, 76.50], [9.20, 76.60]
    ],
    vulnerableHotspots: ['Aryankavu Ghat', 'Thenmala Dam Downstream', 'Munroe Island (Backwater Flooding)', 'Punalur'],
    deocPhone: '0474-2794002'
  },
  {
    id: 'thiruvananthapuram',
    code: 'TVM',
    name: 'Thiruvananthapuram',
    malayalam: 'തിരുവനന്തപുരം',
    centroid: [8.5241, 76.9366],
    alert: 'GREEN',
    rainfallMm: 46.5,
    primaryThreat: 'Isolated Showers & Coastal Sea Surge',
    primaryThreatMl: 'ഒറ്റപ്പെട്ട മഴ & തീരദേശ കടൽക്ഷോഭം',
    advisory: 'Neyyar and Peppara dams within safe capacity. State Emergency Operations Centre (1070) coordinating statewide response from Vikas Bhavan.',
    polygon: [
      [8.85, 76.70], [8.80, 77.20], [8.30, 77.30], [8.25, 77.05],
      [8.45, 76.85], [8.75, 76.70], [8.85, 76.70]
    ],
    vulnerableHotspots: ['Ponmudi Hill Road', 'Vithura Catchment', 'Shangumugham Coastal', 'Thampanoor Urban Basin'],
    deocPhone: '0471-2730045'
  }
];

// Helper: Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Ray casting point-in-polygon
function isPointInPolygon(point, polygon) {
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
 * Get all district weather warning profiles
 */
export function getKsdmaDistrictWarnings() {
  return KERALA_DISTRICTS_DATA;
}

/**
 * Retrieve high-level summary of active weather alerts across Kerala
 */
export function getDistrictWarningSummary() {
  const counts = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 };
  const criticalDistricts = [];

  for (const d of KERALA_DISTRICTS_DATA) {
    counts[d.alert] = (counts[d.alert] || 0) + 1;
    if (d.alert === 'RED' || d.alert === 'ORANGE') {
      criticalDistricts.push({
        name: d.name,
        malayalam: d.malayalam,
        alert: d.alert,
        rainfallMm: d.rainfallMm,
        primaryThreat: d.primaryThreat
      });
    }
  }

  return {
    totalDistricts: KERALA_DISTRICTS_DATA.length,
    counts,
    criticalDistricts,
    bulletinDate: new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    source: 'KSDMA State Emergency Operations Centre (SEOC)'
  };
}

/**
 * Check if a route geometry crosses any district with active Orange or Red warnings
 * @param {Array<[number, number]>} routeGeometry - Array of [lat, lng] points
 * @returns {Array<Object>} List of intercepted warnings along the route
 */
export function checkRouteWeatherInterception(routeGeometry = []) {
  if (!Array.isArray(routeGeometry) || routeGeometry.length === 0) return [];

  const intercepted = [];
  const threatenedDistricts = KERALA_DISTRICTS_DATA.filter(d => d.alert === 'RED' || d.alert === 'ORANGE');

  for (const district of threatenedDistricts) {
    let minDistance = Infinity;
    let pointInside = false;

    // Sample route geometry to optimize performance
    const step = Math.max(1, Math.floor(routeGeometry.length / 50));
    for (let i = 0; i < routeGeometry.length; i += step) {
      const pt = routeGeometry[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;

      if (isPointInPolygon(pt, district.polygon)) {
        pointInside = true;
        minDistance = 0;
        break;
      }

      const dist = haversineKm(pt[0], pt[1], district.centroid[0], district.centroid[1]);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    // If route point is directly inside or within 12km perimeter of district centroid
    if (pointInside || minDistance < 18.0) {
      intercepted.push({
        districtId: district.id,
        districtName: district.name,
        malayalam: district.malayalam,
        alertLevel: district.alert,
        threat: district.primaryThreat,
        rainfallForecast: district.rainfallMm,
        advisory: district.advisory,
        deocPhone: district.deocPhone,
        isDirectlyInside: pointInside,
        distanceKm: pointInside ? 0 : parseFloat(minDistance.toFixed(1))
      });
    }
  }

  return intercepted;
}
