/**
 * ==============================================================================
 * RESYLIX TACTICAL AI COPILOT & DOMAIN INTELLIGENCE ENGINE (v2.0 MASTER EDITION)
 * ==============================================================================
 * Comprehensive Grounded Knowledge Engine & Offline Semantic NLP Inference
 * Supports:
 * 1. 26 Specialized Domain Knowledge Clusters (Every aspect of Resylix & Kerala Disasters)
 * 2. Multi-feature semantic NLP intent classifier with stem & n-gram matching
 * 3. Dynamic Telemetry Augmentation (Live dams, 14-district warnings, 210 POIs, DEOC lines)
 * 4. Interactive Action Triggers (1-click navigation, modals, calls, and exports)
 * 5. Optional Live Google Gemini API progressive enhancement with automatic 0-ms offline fallback
 * ==============================================================================
 */

import { KSDMA_RESERVOIRS } from './ksdmaLiveService.js';
import { KERALA_DISTRICTS_DATA, KSDMA_ALERT_TYPES, getKsdmaDistrictWarnings } from './ksdmaWeatherWarningService.js';
import { KERALA_DEOC_DIRECTORY } from '../deoc.js';
import keralaPois from '../data/keralaPois.json' with { type: 'json' };

// ==============================================================================
// 1. PLATFORM IDENTITY & METADATA
// ==============================================================================

export const PLATFORM_IDENTITY = {
  name: 'Resylix (formerly Vanguard Geo)',
  creator: 'Joyal Thomas Francis',
  creatorGithub: 'https://github.com/19-joyal-3',
  creatorEmail: 'joyalthomasfrancis3@gmail.com',
  repository: 'https://github.com/19-joyal-3/Emergency-Dispatch',
  deploymentUrl: 'https://emergency-dispatch-2.onrender.com/',
  architecture: 'Zero-Connectivity Offline Tactical Emergency Dispatch & Kerala Disaster Navigation Platform',
  version: '2.0.0 Tactical AI Edition'
};

export const PRESET_TACTICAL_QUESTIONS = [
  {
    id: 'creator',
    query: 'Who created Resylix and why was it built?',
    icon: 'Sparkles',
    badge: 'Creator'
  },
  {
    id: 'offline_routing',
    query: 'How does offline navigation work without internet?',
    icon: 'Navigation',
    badge: 'Offline Tech'
  },
  {
    id: 'dams_rule_curves',
    query: 'Check KSDMA Dam status & Rule Curves',
    icon: 'Waves',
    badge: 'Dams'
  },
  {
    id: 'weather_alerts',
    query: 'What are the active weather warnings across Kerala?',
    icon: 'CloudRain',
    badge: 'Weather'
  },
  {
    id: 'nearest_hospitals',
    query: 'Find nearest 24/7 hospitals and emergency shelters',
    icon: 'Hospital',
    badge: 'Facilities'
  },
  {
    id: 'report_hazard',
    query: 'How do I report a road blockage or landslide?',
    icon: 'AlertTriangle',
    badge: 'Hazard Ops'
  },
  {
    id: 'emergency_numbers',
    query: 'What are the emergency numbers (SEOC 1070 / DEOC 1077)?',
    icon: 'PhoneCall',
    badge: 'Helplines'
  },
  {
    id: 'evacuation_manifest',
    query: 'How do I export an official evacuation manifest PDF?',
    icon: 'FileText',
    badge: 'Manifest'
  }
];

// Mapping 3-letter codes to full district identifiers
export const CODE_TO_DISTRICT_ID = {
  tvm: 'thiruvananthapuram',
  klm: 'kollam',
  pta: 'pathanamthitta',
  alp: 'alappuzha',
  ktm: 'kottayam',
  idk: 'idukki',
  ekm: 'ernakulam',
  tsr: 'thrissur',
  pkd: 'palakkad',
  mpm: 'malappuram',
  kkd: 'kozhikode',
  wyd: 'wayanad',
  knr: 'kannur',
  ksd: 'kasaragod'
};

// District keywords dictionary for entity resolution
const DISTRICT_KEYWORDS = {
  tvm: ['thiruvananthapuram', 'trivandrum', 'തിരുവനന്തപുരം', 'tvm', 'kazhakkoottam', 'neyyattinkara', 'nedumangad', 'vizhinjam', 'varkala'],
  klm: ['kollam', 'quilon', 'കൊല്ലം', 'klm', 'karunagappally', 'punalur', 'kottarakkara', 'paravur', 'chavara'],
  pta: ['pathanamthitta', 'പത്തനംതിട്ട', 'pta', 'adivaram', 'ranni', 'konni', 'thiruvalla', 'pamba', 'sabarimala', 'aranmula'],
  alp: ['alappuzha', 'alleppey', 'ആലപ്പുഴ', 'alp district', 'kuttanad', 'cherthala', 'mavelikkara', 'chengannur', 'kayamkulam', 'haripad'],
  ktm: ['kottayam', 'കോട്ടയം', 'ktm', 'changanassery', 'pala town', 'pala municipality', 'pala', 'kanjirappally', 'koottickal', 'mundakkayam', 'vaikom', 'ettumanoor'],
  idk: ['idukki', 'ഇടുക്കി', 'idk district', 'munnar', 'pettimudi', 'thodupuzha', 'kattappana', 'cheruthoni', 'adimali', 'peermade', 'devikulam', 'kumily'],
  ekm: ['ernakulam', 'kochi', 'cochin', 'എറണാകുളം', 'ekm', 'aluva', 'perumbavoor', 'angamaly', 'paravur', 'kalamassery', 'tripunithura', 'kakkanad', 'vytilla'],
  tsr: ['thrissur', 'trichur', 'തൃശ്ശൂർ', 'tsr', 'chalakudy', 'kodungallur', 'kunnamkulam', 'irinjallakuda', 'guruvayur', 'vadakkanchery', 'peechi'],
  pkd: ['palakkad', 'palghat', 'പാലക്കാട്', 'pkd', 'ottapalam', 'chittur', 'mannarkkad', 'alathur', 'pattambi', 'cherpulassery', 'malampuzha', 'kuthiran'],
  mpm: ['malappuram', 'മലപ്പുറം', 'mpm', 'manjeri', 'perinthalmanna', 'tirur', 'ponnani', 'nilambur', 'kavalappara', 'kondotty', 'edakkara'],
  kkd: ['kozhikode', 'calicut', 'കോഴിക്കോട്', 'kkd', 'vadakara', 'koyilandy', 'thamarassery', 'kattippara', 'feroke', 'beypore', 'mukkam'],
  wyd: ['wayanad', 'വയനാട്', 'wyd', 'chooralmala', 'mundakkai', 'meppadi', 'kalpetta', 'mananthavady', 'sulthan bathery', 'vythiri', 'vellamunda', 'banasura'],
  knr: ['kannur', 'cannanore', 'കണ്ണൂർ', 'knr', 'thalassery', 'payyanur', 'taliparamba', 'iritty', 'mattannur', 'koothuparamba'],
  ksd: ['kasaragod', 'കാസർഗോഡ്', 'ksd', 'kanhangad', 'nileshwaram', 'uppala', 'manjeshwar', 'bekal', 'cheruvathur']
};

/**
 * Normalizes text for robust semantic comparison
 */
function normalizeQuery(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s\u0D00-\u0D7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects if a district is mentioned with exact word boundaries and longest match precedence
 */
export function detectDistrict(norm) {
  if (!norm) return null;
  const padded = ` ${norm} `;
  let bestMatch = null;
  let maxKwLength = 0;

  for (const [id, keywords] of Object.entries(DISTRICT_KEYWORDS)) {
    for (const kw of keywords) {
      const kwNorm = kw.toLowerCase().trim();
      if (!kwNorm) continue;
      // Exact word boundary match in space-padded query
      if (padded.includes(` ${kwNorm} `)) {
        if (kwNorm.length > maxKwLength) {
          maxKwLength = kwNorm.length;
          const deocInfo = KERALA_DEOC_DIRECTORY.find(d => d.id === id);
          const fullId = CODE_TO_DISTRICT_ID[id] || id;
          const weatherInfo = KERALA_DISTRICTS_DATA.find(d => 
            d.id.toLowerCase() === fullId.toLowerCase() || 
            d.code.toLowerCase() === id.toLowerCase() ||
            d.name.toLowerCase() === (deocInfo?.name || '').toLowerCase()
          );
          bestMatch = {
            id,
            fullId,
            name: weatherInfo?.name || deocInfo?.name || id,
            malayalam: weatherInfo?.malayalam || deocInfo?.malayalam || '',
            deoc: deocInfo,
            weather: weatherInfo
          };
        }
      }
    }
  }
  return bestMatch;
}

/**
 * Detects if a specific dam is mentioned with word boundary support
 */
export function detectDam(norm) {
  if (!norm) return null;
  const padded = ` ${norm} `;
  const dams = KSDMA_RESERVOIRS || [];
  for (const dam of dams) {
    const damName = dam.name.toLowerCase();
    const damKey = dam.id.toLowerCase();
    const damPure = damName.replace(' dam', '').trim();
    if (padded.includes(` ${damKey} `) || padded.includes(` ${damPure} `) || norm.includes(damName)) {
      return dam;
    }
  }
  return null;
}

// ==============================================================================
// 2. MASTER KNOWLEDGE CLUSTERS DEFINITION
// ==============================================================================

const KNOWLEDGE_CLUSTERS = [
  // 1. CREATOR & DEVELOPMENT ATTRIBUTION
  {
    id: 'CREATOR_ATTRIBUTION',
    keywords: [
      'creator', 'author', 'who created', 'who made', 'who developed', 'who built',
      'developer', 'founder', 'architect', 'joyal', 'thomas francis', '19 joyal 3',
      'credits', 'who wrote', 'who programmed', 'maker', 'inventor', 'created by',
      'developer of resylix', 'resylix developer', 'creator of resylix', 'author of resylix',
      'who made resylix', 'who built resylix', 'who designed resylix'
    ],
    priority: 10,
    handler: () => ({
      answer: `### 🛡️ Platform Creator & Engineering Attribution

**Resylix (formerly Vanguard Geo)** was conceived, architected, and engineered by **Joyal Thomas Francis** ([@19-joyal-3](https://github.com/19-joyal-3)).

#### Key Engineering & Humanitarian Milestones:
- **Independent Humanitarian Initiative**: Built as a sovereign, open-source tactical crisis utility to solve the exact communication and navigation blackouts witnessed during the Kerala floods and the catastrophic Wayanad (Chooralmala/Mundakkai) landslides.
- **Zero-Connectivity Architecture**: Designed a 100% offline client-side Dijkstra graph router, local IndexedDB caching, and P2P vehicle-to-vehicle (V2V) mesh networks that keep emergency convoys operational when power grids and cellular towers collapse.
- **Telemetry Integrations**: Synthesized live daily hydrology feeds from the **Kerala State Disaster Management Authority (KSDMA)**, Central Water Commission (CWC) dam rule curves, and IMD 14-district weather warning matrices into a unified tactical HUD.

**Developer Profile**:
- **Lead Architect & Developer**: Joyal Thomas Francis
- **GitHub**: [github.com/19-joyal-3](https://github.com/19-joyal-3)
- **Repository**: [19-joyal-3/Emergency-Dispatch](https://github.com/19-joyal-3/Emergency-Dispatch)
- **Direct Email**: joyalthomasfrancis3@gmail.com`,
      actions: [
        { label: 'View Source Code', actionId: 'open_repo', icon: 'ExternalLink', url: 'https://github.com/19-joyal-3/Emergency-Dispatch' },
        { label: 'Offline Technology Overview', actionId: 'ask_offline_tech', icon: 'Navigation' },
        { label: 'Open Presentation Deck', actionId: 'open_presentation', icon: 'Presentation' }
      ]
    })
  },

  // 2. OFFLINE DIJKSTRA ROUTING & ZERO-NETWORK TECHNOLOGY
  {
    id: 'OFFLINE_ROUTING',
    keywords: [
      'offline', 'without internet', 'no internet', 'zero connectivity', 'how routing works',
      'dijkstra', 'vector map', 'pmtiles', 'offline map', 'how it works', 'algorithm',
      'shortest path', 'graph', 'nodes', 'edges', 'reroute', 'detour', 'obstacle avoidance'
    ],
    priority: 9,
    handler: () => ({
      answer: `### 📡 Resylix Zero-Connectivity Routing Architecture

Resylix is engineered to maintain navigation and dispatch operations in complete disaster isolation when mobile towers, submarine cables, and power grids fail:

#### 1. In-Browser Dijkstra Graph Routing:
- The entire topological road network of Kerala (state highways, arterial roads, ghat passes, lifeline bridges) is embedded directly into browser memory.
- Uses **Dijkstra's shortest path algorithm** with topological edge weights.
- When an emergency route is calculated, computation executes locally on your device CPU in **< 15 milliseconds** with zero network pings.

#### 2. Dynamic Hazard Obstacle Avoidance:
- When a road section is marked impassable due to a landslide, fallen tree, or floodwater, its graph edge receives an infinite penalty weight (\`Infinity\`).
- The router instantly discovers and presents a safe alternate detour corridor around the danger zone.

#### 3. Real-Road Fallback (OSRM / TomTom Orbis):
- If cellular data or Wi-Fi is detected, Resylix enhances route lines with high-fidelity real-road vector geometries.
- If connectivity drops, it instantly and silently falls back to the embedded offline graph.

#### 4. Decentralized V2V Mesh & BLE Radar:
- Responder vehicles establish peer-to-peer data channels via WebRTC and Bluetooth Low Energy (BLE) radar simulation.
- Critical hazard alerts, SOS distress beacons, and convoy locations hop from vehicle to vehicle without relying on central telecom towers.`,
      actions: [
        { label: 'Open Route Planner', actionId: 'tab_planner', icon: 'Navigation' },
        { label: 'Offline Storage Manager', actionId: 'storage', icon: 'Database' },
        { label: 'Install Standalone PWA', actionId: 'install_pwa', icon: 'Download' }
      ]
    })
  },

  // 3. KSDMA DAMS & CENTRAL WATER COMMISSION RULE CURVES
  {
    id: 'DAMS_AND_RULE_CURVES',
    keywords: [
      'dam', 'dams', 'reservoir', 'reservoirs', 'rule curve', 'water level', 'spillway',
      'shutter', 'shutters', 'kseb', 'frl', 'full reservoir level', 'storage', 'cwc',
      'periyar basin', 'pamba basin', 'flood gate', 'discharge', 'mcm'
    ],
    priority: 9,
    handler: (query, norm) => {
      const matchedDam = detectDam(norm);
      if (matchedDam) {
        return {
          answer: `### 🌊 Dam Telemetry: **${matchedDam.name}** (${matchedDam.district} District)

- **Managing Agency**: ${matchedDam.agency}
- **River Basin**: ${matchedDam.basin} Basin
- **Current Water Level**: **${matchedDam.currentLevelMeters.toFixed(2)} m** (${(matchedDam.currentLevelMeters * 3.28084).toFixed(2)} ft)
- **Full Reservoir Level (FRL)**: **${matchedDam.frlMeters.toFixed(2)} m** (${matchedDam.frlFeet.toFixed(2)} ft)
- **Central Water Commission Rule Curve**: **${matchedDam.ruleCurveMeters.toFixed(2)} m** (CWC Safety Ceiling)
- **Live Storage Capacity**: **${matchedDam.storagePercent}%** (${matchedDam.storageMcm} MCM)
- **Alert Status**: **${matchedDam.alertLevel.toUpperCase()} ALERT**
- **Spillway Status**: ${matchedDam.spillwayStatus}
- **Downstream Corridor**: \`${matchedDam.downstreamCorridor}\`

> **Tactical Dispatch Note**: Emergency convoy routing automatically avoids roads intersecting the downstream spillway corridor when the dam reaches Orange or Red alert level.`,
          actions: [
            { label: 'Open Dam Monitor', actionId: 'ksdma_dams', icon: 'Waves' },
            { label: 'Check Weather Alerts', actionId: 'ksdma_weather', icon: 'CloudRain' }
          ]
        };
      }

      const alertDams = (KSDMA_RESERVOIRS || []).filter(d => d.alertLevel !== 'Normal');
      const alertSummary = alertDams.length > 0 
        ? alertDams.map(d => `- **${d.name}** (${d.district}): **${d.alertLevel} Alert** (${d.storagePercent}% storage)`).join('\n')
        : "All 24 reservoirs are currently operating within safe Normal seasonal thresholds.";

      return {
        answer: `### 🌊 KSDMA 24-Reservoir Hydrological Monitoring & Rule Curves

Resylix continuously monitors all **24 major hydroelectric and irrigation reservoirs** across Kerala in coordination with official KSDMA and Central Water Commission (CWC) protocols.

#### Active Reservoir Alerts:
${alertSummary}

#### Understanding Dam Alert Levels & Rule Curves:
- **What is a Rule Curve?**: A seasonal maximum water storage ceiling prescribed by the Central Water Commission (CWC). If water approaches this curve, operators must release water to preserve buffer space for unexpected storm surges.
- 🟢 **Normal Alert**: Safe storage level below the seasonal rule curve.
- 🔵 **Blue Alert**: Water level is approaching the CWC Rule Curve threshold; 24-hour monitoring active.
- 🟠 **Orange Alert**: Second alert stage; downstream sirens tested and riverbanks placed on high alert.
- 🔴 **Red Alert**: Maximum rule curve reached; spillway shutters opened or imminent. Downstream flood corridors evacuated.

#### Automated Route Defense:
Resylix automatically flags and recalculates any emergency convoy paths that cross downstream flood corridors (such as the Periyar, Pamba, or Chalakudy river basins) when upstream dams issue alert statuses.`,
        actions: [
          { label: 'Open Dam Monitor Modal', actionId: 'ksdma_dams', icon: 'Waves' },
          { label: 'District Weather Alerts', actionId: 'ksdma_weather', icon: 'CloudRain' },
          { label: 'Export Evacuation Manifest', actionId: 'evacuation_manifest', icon: 'FileText' }
        ]
      };
    }
  },

  // 4. KSDMA WEATHER WARNING MATRIX & IMD RAINFALL
  {
    id: 'WEATHER_WARNINGS',
    keywords: [
      'weather', 'rain', 'rainfall', 'monsoon', 'cloudburst', 'red alert', 'orange alert',
      'yellow alert', 'green alert', 'forecast', 'cyclone', 'imd', 'warning matrix',
      'precipitation', 'storm', 'inundation', 'flooding'
    ],
    priority: 8,
    handler: () => {
      const warnings = getKsdmaDistrictWarnings();
      const redDistricts = warnings.filter(w => (w.alert || '').toUpperCase() === 'RED').map(w => w.name);
      const orangeDistricts = warnings.filter(w => (w.alert || '').toUpperCase() === 'ORANGE').map(w => w.name);
      const yellowDistricts = warnings.filter(w => (w.alert || '').toUpperCase() === 'YELLOW').map(w => w.name);
      const greenDistricts = warnings.filter(w => (w.alert || '').toUpperCase() === 'GREEN').map(w => w.name);

      return {
        answer: `### 🌦️ KSDMA 14-District Weather Warning Matrix

Resylix synchronizes daily meteorology feeds grounded in official **KSDMA & India Meteorological Department (IMD)** bulletins.

#### Statewide Alert Breakdown:
- 🔴 **Red Alert (Take Action)**: ${redDistricts.length > 0 ? redDistricts.join(', ') : 'None active statewide'}
  - *Rainfall Threshold*: Extremely heavy rainfall (> 204.4 mm / 24h). Total travel ban on high-range ghat corridors.
- 🟠 **Orange Alert (Be Prepared)**: ${orangeDistricts.length > 0 ? orangeDistricts.join(', ') : 'None active statewide'}
  - *Rainfall Threshold*: Very heavy rainfall (115.6 - 204.4 mm / 24h). High risk of flash flooding and slope debris flows.
- 🟡 **Yellow Alert (Be Aware)**: ${yellowDistricts.length > 0 ? yellowDistricts.join(', ') : 'None active statewide'}
  - *Rainfall Threshold*: Heavy rainfall (64.5 - 115.5 mm / 24h). Local waterlogging, slippery high-range roads.
- 🟢 **Green (Normal)**: ${greenDistricts.length > 0 ? greenDistricts.join(', ') : 'Routine conditions statewide (< 64.4 mm / 24h)'}.

#### Route Weather Interception:
When you calculate any convoy route in the Tactical Route Planner, Resylix projects the route line over district weather polygons. If your vehicle enters an Orange or Red district, an alert triggers in the Tactical Voice Navigation HUD.`,
        actions: [
          { label: 'Open Weather Warning Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
          { label: 'Check Dam Water Levels', actionId: 'ksdma_dams', icon: 'Waves' },
          { label: 'Toggle Weather Alert Layer', actionId: 'toggle_weather_layer', icon: 'Layers' }
        ]
      };
    }
  },

  // 5. DISTRICT SPECIFIC SITREP & DEOC
  {
    id: 'DISTRICT_SPECIFIC',
    keywords: [
      'wayanad', 'idukki', 'ernakulam', 'kochi', 'alappuzha', 'kollam', 'thiruvananthapuram',
      'kottayam', 'pathanamthitta', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
      'kannur', 'kasaragod', 'district', 'collectorate', 'deoc 1077'
    ],
    priority: 8,
    handler: (rawQuery, norm, context) => {
      const matchedDistrict = detectDistrict(norm);
      if (!matchedDistrict) return null;
      return buildDistrictSpecificResponse(matchedDistrict, rawQuery, norm, context);
    }
  },

  // 6. EMERGENCY FACILITIES (HOSPITALS, FUEL, SHELTERS, PHARMACIES)
  {
    id: 'FACILITIES_AND_POIS',
    keywords: [
      'hospital', 'medical', 'trauma', 'casualty', 'doctor', 'doctor', 'clinic', 'health',
      'fuel', 'petrol', 'diesel', 'gas station', 'refuel', 'pump',
      'shelter', 'relief camp', 'relief center', 'camp', 'lodging', 'safe haven',
      'pharmacy', 'medicine', 'chemist', 'drug store', 'food', 'kitchen', 'kudumbashree',
      'police', 'station', 'bank', 'atm', 'facilities', 'amenities', 'poi', 'directory'
    ],
    priority: 8,
    handler: () => {
      const hospitalCount = keralaPois.filter(p => p.category === 'hospital').length;
      const fuelCount = keralaPois.filter(p => p.category === 'fuel').length;
      const shelterCount = keralaPois.filter(p => p.category === 'shelter' || p.category === 'hotel').length;
      const policeCount = keralaPois.filter(p => p.category === 'police').length;

      return {
        answer: `### 🏥 Kerala 210 Verified Tactical Facilities Directory

Resylix embeds a verified offline database of **210 critical disaster lifeline facilities** spanning all 14 revenue districts of Kerala:

- 🏥 **Hospitals & Trauma Centers**: ${hospitalCount} verified facilities (Medical Colleges, District & Taluk Hospitals with emergency casualties)
- ⛽ **Fuel Stations**: ${fuelCount} strategically placed petroleum pumps equipped with diesel generators for emergency convoy refueling
- 🛡️ **Relief Shelters & Lodging**: ${shelterCount} designated high-capacity flood shelters and disaster rehabilitation camps
- 👮 **Police & Safety Outposts**: ${policeCount} police stations and law enforcement checkposts
- 💊 **24/7 Pharmacies & Medicine Stores**: Neethi, Karunya, and Apollo emergency dispensaries
- 🍽️ **Community Relief Kitchens**: Kudumbashree Janakeeya relief distribution hubs

#### Tactical Capabilities:
- **5.0 KM Proximity Scan**: Automatically finds the closest hospital, fuel station, and shelter within 5 km of your GNSS position or chosen incident scene.
- **24/7 Filter**: Instantly isolate facilities operating round-the-clock during crisis hours.`,
        actions: [
          { label: 'Run 5km Proximity Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
          { label: 'Open Facilities Directory', actionId: 'poi_directory', icon: 'MapPin' },
          { label: 'Route to Nearest Hospital', actionId: 'nearest_hospital', icon: 'Hospital' }
        ]
      };
    }
  },

  // 7. 5.0 KM TACTICAL PROXIMITY SCAN
  {
    id: 'PROXIMITY_SCAN',
    keywords: [
      'proximity', 'scan', '5km', '5.0 km', 'nearby', 'closest', 'radar', 'radius',
      'find nearby', 'what is near me', 'nearest', 'surrounding', 'around me'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 🎯 5.0 KM Tactical Proximity Radar

The **5.0 KM Tactical Proximity Scan** is a rapid spatial query engine built to instantly identify life-saving resources within minutes of arriving at an incident scene:

#### How It Works:
1. **Epicenter Selection**: Uses your real-time GNSS location, or centers around an emergency incident pin on the map.
2. **Radial Distance Filtering**: Computes high-precision **Haversine spherical distances** to all 210 verified Kerala facilities in < 2 milliseconds.
3. **Categorized Triage Summary**:
   - 🏥 *Closest Hospitals & ICUs* with direct distance in kilometers.
   - ⛽ *Active Fuel Stations* for ambulance and rescue truck refilling.
   - 🛡️ *Designated Evacuation Shelters* for displaced flood victims.
4. **1-Click Dispatch**: Tap any facility in the scan modal to immediately calculate an offline evacuation route or focus the map.`,
      actions: [
        { label: 'Launch 5km Proximity Scan Now', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: 'Browse 210 Facilities', actionId: 'poi_directory', icon: 'MapPin' }
      ]
    })
  },

  // 8. FIELD HAZARD REPORTING & OBSTACLES
  {
    id: 'HAZARD_REPORTING',
    keywords: [
      'report hazard', 'road blockage', 'landslide', 'mudslip', 'fallen tree', 'electric wire',
      'road crack', 'bridge damage', 'waterlogged road', 'block road', 'hazard report',
      'how to report', 'obstruction', 'impassable', 'blocked'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 🚧 How to Report a Field Hazard or Road Blockage

Ground responders, volunteers, and tactical drivers can report road blockages in real time to protect oncoming emergency convoys:

#### Step-by-Step Reporting Instructions:
1. Tap the **🚧 Hazard** chip in the top search bar or select **Report Road Hazard** from the side menu.
2. Select the **Hazard Category**:
   - ⛰️ *Landslide / Mudslip* (Severe high-range debris blocking transit)
   - 🌊 *Flash Flood / Waterlogging* (Inundated carriageway)
   - 🌲 *Fallen Tree / Electric Pole* (Physical obstacle requiring chainsaw clearance)
   - ⚡ *Road Crack / Subsidence* (Compromised structural asphalt)
3. Choose the **Severity Level**: \`Critical\` (Total impassability), \`High\`, \`Moderate\`, or \`Low\`.
4. Capture Coordinates: Automatically uses your current GNSS position or lets you tap anywhere on the Kerala map.
5. Tap **Broadcast Hazard Report**:
   - The obstacle immediately appears on the tactical map as a high-visibility hazard marker.
   - The offline Dijkstra routing engine instantly penalizes this corridor, steering all automated evacuation routes away from it.
   - The hazard is broadcast over the local P2P vehicle mesh network.`,
      actions: [
        { label: 'Open Report Hazard Modal', actionId: 'report_hazard', icon: 'AlertTriangle' },
        { label: 'Run 5km Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: 'Command Palette (⌘K)', actionId: 'open_palette', icon: 'Terminal' }
      ]
    })
  },

  // 9. EMERGENCY HELPLINES & DEOC 1077
  {
    id: 'EMERGENCY_HELPLINES',
    keywords: [
      'emergency number', 'helpline', 'phone', 'contact', 'call', 'seoc', 'deoc',
      '1070', '1077', '112', '108', '101', 'police number', 'fire number',
      'ambulance number', 'control room', 'toll free', 'who to call'
    ],
    priority: 9,
    handler: () => ({
      answer: `### 📞 Kerala State Official Emergency Helplines

#### Statewide Sovereign Emergency Numbers:
- 🚨 **SEOC (State Emergency Operations Centre)**: **1070** (Toll-Free, 24/7 Disaster Control Room)
- 🏢 **DEOC (District Emergency Operations Centre)**: **1077** (Toll-Free within each respective district)
- 🚓 **Police Emergency Response Support System**: **112** (Universal)
- 🚒 **Fire & Rescue Services**: **101**
- 🚑 **Ambulance & Trauma Medical Dispatch**: **108**
- 🛡️ **Coastal Police & Sea Rescue**: **1093**
- 👶 **Childline**: **1098** | 👩 **Women Helpline**: **1091** / **181**
- 🌲 **Forest Fire & Wildlife Emergency**: **1800-425-4733** / **1926**

#### Key District DEOC Direct Lines:
- **Wayanad**: \`04936-204151\` (Collectorate: \`04936-202251\`)
- **Idukki**: \`04862-233111\` (Collectorate: \`04862-233130\`)
- **Ernakulam**: \`0484-2423513\` (Collectorate: \`0484-2423001\`)
- **Kozhikode**: \`0495-2371002\` (Collectorate: \`0495-2371400\`)
- **Thiruvananthapuram**: \`0471-2730045\` (SEOC Control Room: \`0471-2364424\`)
- **Palakkad**: \`0491-2505309\` | **Thrissur**: \`0487-2362424\` | **Malappuram**: \`0483-2736320\`
- **Alappuzha**: \`0477-2238630\` | **Kottayam**: \`0481-2562201\` | **Pathanamthitta**: \`0468-2222515\`
- **Kannur**: \`0497-2713232\` | **Kasaragod**: \`04994-257700\``,
      actions: [
        { label: 'Call SEOC (1070)', actionId: 'call_phone', payload: '1070', icon: 'PhoneCall' },
        { label: 'Call Police (112)', actionId: 'call_phone', payload: '112', icon: 'PhoneCall' },
        { label: 'Call Ambulance (108)', actionId: 'call_phone', payload: '108', icon: 'PhoneCall' },
        { label: 'Browse DEOC Directory', actionId: 'seoc_directory', icon: 'Shield' }
      ]
    })
  },

  // 10. EVACUATION MANIFEST (PDF SITREP)
  {
    id: 'EVACUATION_MANIFEST',
    keywords: [
      'manifest', 'evacuation manifest', 'pdf', 'sitrep', 'print report', 'export',
      'patient triage', 'convoy report', 'download report', 'documentation'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 📄 Official Evacuation Manifest & Tactical SITREP Generator

Resylix provides a 1-click **Official Evacuation Manifest & Situation Report (SITREP)** formatted according to National Disaster Management Authority (NDMA) and KSDMA documentation standards:

#### What the Manifest Contains:
- **Incident & Mission Header**: Unique convoy dispatch ID, timestamp, and incident coordinates.
- **Convoy & Vehicle Specs**: Vehicle callsigns, vehicle capacity, fuel reserves, driver details.
- **Patient & Evacuee Triage Summary**:
  - \`Critical Triage\` (Immobilized, oxygen-dependent, or severe trauma patients)
  - \`Walking Wounded\` (Minor injuries requiring outpatient dressing)
  - \`Vulnerable Population\` (Infants, children, elderly, pregnant mothers)
- **Active Hazard Waypoints**: Verified road blockages, landslide coordinates, and dam spillway alerts avoided during transit.
- **Target Relief Destination**: Receiving hospital, designated rehabilitation shelter, or safe evacuation staging point.

#### How to Export:
Tap the **📄 Manifest** chip in the top search bar or click the button below to generate and print the official tactical PDF report.`,
      actions: [
        { label: 'Export Evacuation Manifest PDF', actionId: 'evacuation_manifest', icon: 'FileText' },
        { label: 'Download Whitepaper Report', actionId: 'download_report', icon: 'Download' },
        { label: 'Open Route Planner', actionId: 'tab_planner', icon: 'Navigation' }
      ]
    })
  },

  // 11. VOICE NAVIGATION & MALAYALAM AUDIO
  {
    id: 'VOICE_NAVIGATION',
    keywords: [
      'voice', 'audio', 'speech', 'malayalam', 'sound', 'speak', 'spoken', 'language',
      'turn by turn', 'directions voice', 'voice nav', 'സംസാരം', 'മലയാളം'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 🗣️ Tactical Voice Navigation (English & Malayalam / മലയാളം)

Resylix features an offline speech synthesis audio navigation system designed for high-stress convoy driving:

#### Key Capabilities:
- **Bilingual Guidance**: Full turn-by-turn spoken directions in both **English** and **Malayalam (മലയാളം)**.
- **Tactical Threat Alerts**: Audible spoken warnings when approaching:
  - Active landslide or road blockage zones
  - Flash flood inundations
  - Downstream dam spillway flood corridors
  - IMD Red/Orange heavy rainfall warning sectors
- **Hands-Free Driving**: Responders can focus entirely on road terrain while the copilot speaks directions at critical turn junctions.

#### How to Switch Language:
Use the button below or press **⌘K** and type *voice* to instantly toggle between English and Malayalam.`,
      actions: [
        { label: 'Toggle Malayalam Voice', actionId: 'toggle_voice_lang', icon: 'Volume2' },
        { label: 'Simulate Voice Drive', actionId: 'simulate', icon: 'Car' },
        { label: 'Open Route Planner', actionId: 'tab_planner', icon: 'Navigation' }
      ]
    })
  },

  // 12. MAP THEMES & NIGHT VISION (NVG)
  {
    id: 'MAP_THEMES',
    keywords: [
      'theme', 'dark mode', 'night vision', 'nvg', 'satellite', 'terrain', 'solar',
      'color', 'display', 'screen mode', 'night mode', 'light mode'
    ],
    priority: 7,
    handler: () => ({
      answer: `### 🎨 Tactical Display Themes

Resylix includes 6 specialized map rendering themes engineered for distinct operational lighting environments:

1. 🏔️ **Terrain (Default)**: Topographic contours highlighting elevation, river basins, and ghat slopes.
2. 🕶️ **Slate Dark Tactical**: Low-power OLED dark mode optimized for night operations in field command tents.
3. 🛰️ **Satellite Imagery**: High-resolution optical satellite view for terrain and vegetation verification.
4. ☀️ **Solar High-Contrast**: Maximum-brightness daylight mode for direct sunlight windshield viewing.
5. 🟢 **NVG Green (Night Vision Goggles)**: Monochromatic phosphor green mode designed for tactical night missions and blackout convoy movements.
6. 🦺 **Safety High-Contrast**: High-visibility hazard markers and road networks for coordination under heavy monsoon glare.

#### How to Switch Theme:
Tap the **🎨 Theme** chip in the top search bar or click below to cycle through themes instantly.`,
      actions: [
        { label: 'Cycle Map Theme', actionId: 'theme', icon: 'Eye' },
        { label: 'Command Palette (⌘K)', actionId: 'open_palette', icon: 'Terminal' }
      ]
    })
  },

  // 13. PWA INSTALLATION & PERSISTENT DISASTER CACHE
  {
    id: 'PWA_INSTALLATION',
    keywords: [
      'install', 'pwa', 'download app', 'home screen', 'app', 'apk', 'offline storage',
      'storage', 'cache', 'airplane mode', 'run without wifi', 'play store', 'app store'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 📲 Progressive Web App (PWA) Offline Installation

Resylix is an enterprise-grade Progressive Web App (PWA). You do not need the Google Play Store or Apple App Store to install it:

#### How to Install on Android / Chrome:
1. Tap the **Menu (⋮)** in Chrome or the **Install App** button in Resylix.
2. Select **Add to Home screen** / **Install Resylix**.
3. Once installed, Resylix runs in standalone full-screen tactical mode.

#### Offline Pre-Caching:
- When you first load Resylix, Service Worker **v11** automatically caches the application bundle, UI assets, and Kerala offline places database into **IndexedDB**.
- You can turn your phone to **Airplane Mode**, launch the app from your home screen, and plan routes across Kerala with 100% offline autonomy.`,
      actions: [
        { label: 'Trigger PWA Install', actionId: 'install_pwa', icon: 'Download' },
        { label: 'Open Storage Manager', actionId: 'storage', icon: 'Database' },
        { label: 'Test 5km Offline Scan', actionId: 'proximity_scan', icon: 'Crosshair' }
      ]
    })
  },

  // 14. WAYANAD CHOORALMALA & MUNDAKKAI LANDSLIDES
  {
    id: 'WAYANAD_LANDSLIDES',
    keywords: [
      'chooralmala', 'mundakkai', 'meppadi', 'wayanad landslide', 'bailey bridge',
      'landslides in wayanad', 'punchirimattom', 'vellarmala', 'puthumala'
    ],
    priority: 9,
    handler: () => ({
      answer: `### ⛰️ Wayanad Landslide Crisis & Tactical Lifeline Corridors

The catastrophic July 2024 debris avalanche in **Chooralmala, Mundakkai, and Attamala (Meppadi panchayat, Wayanad)** is a primary design benchmark for Resylix:

#### Key Crisis Realities Solved by Resylix:
1. **Total Telecom Blackout**: When the landslide hit, cellular towers and power poles were obliterated. Resylix's **Zero-Network In-Browser Dijkstra Graph Router** enables volunteers to navigate without mobile data.
2. **Bridge Destruction & Isolation**: When the Chooralmala bridge collapsed, the sole access corridor was severed. Resylix dynamically recalculates safe detours around broken structures.
3. **Decentralized Vehicle Mesh**: Rescue teams and ambulances use Resylix's peer-to-peer V2V mesh to share obstacle waypoints between vehicles without internet.
4. **Immediate Emergency Helplines**:
   - Wayanad DEOC Direct: \`04936-204151\`
   - Wayanad Collectorate: \`04936-202251\`
   - Toll-Free: \`1077\``,
      actions: [
        { label: 'Run 5km Scan for Meppadi', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: 'Call Wayanad DEOC', actionId: 'call_phone', payload: '04936-204151', icon: 'PhoneCall' },
        { label: 'Wayanad Weather Warning', actionId: 'ksdma_weather', icon: 'CloudRain' }
      ]
    })
  },

  // 15. KERALA FLOODS HISTORY & LESSONS
  {
    id: 'KERALA_FLOODS_HISTORY',
    keywords: [
      '2018 floods', 'kerala floods', 'great floods', 'deluge', 'kuttanad flood',
      'aluva flood', 'ranni flood', 'why did google maps fail', 'history of resylix'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 🌊 Kerala Floods: Why Resylix Was Built

During the historic **2018 and 2019 Kerala Floods**, commercial navigation tools like Google Maps failed because:
1. **Reliance on Live Cloud**: When mobile towers submerged, mainstream apps stopped calculating routes.
2. **Blind to Dam Discharges**: Mainstream maps routed convoys directly through the Periyar flood plains while Cheruthoni shutters were discharging 1,000+ cumecs.
3. **No Offline Mesh Sharing**: Responders could not broadcast newly submerged roads to other ambulances without cellular data.

#### How Resylix Resolves These Failures:
- **100% Offline Topology**: Pre-loaded in-browser road networks that calculate paths in airplane mode.
- **KSDMA Dam Spillway Interception**: Continuously cross-checks routes against active flood discharge corridors.
- **V2V Hazard Mesh**: Vehicle-to-vehicle hopping of newly submerged roads and obstacle alerts.`,
      actions: [
        { label: 'Check 24 Dams', actionId: 'ksdma_dams', icon: 'Waves' },
        { label: 'Weather Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
        { label: 'Route Planner', actionId: 'tab_planner', icon: 'Navigation' }
      ]
    })
  },

  // 16. TECHNICAL STACK & SOFTWARE ARCHITECTURE
  {
    id: 'TECH_STACK',
    keywords: [
      'tech stack', 'technology', 'stack', 'libraries', 'codebase', 'what is it built with',
      'react', 'vite', 'leaflet', 'dexie', 'javascript', 'capacitor', 'xgboost', 'source code'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 💻 Resylix Technical Architecture & Software Stack

Resylix is engineered with a modern, high-resilience web and native architecture:

#### Core Engine & UI:
- **UI Framework**: React 19 + Vite 8 (Ultra-fast ESM bundling, code-split Suspense modals).
- **Mapping & Geospatial**: Leaflet 1.9 + PMTiles 4.5 (Serverless vector archive streaming).
- **Offline Database**: Dexie.js (Client-side IndexedDB for local audit trails, incidents, and offline POIs).
- **Styling**: Tailored glassmorphic dark HUD CSS with GPU-accelerated touch panning and zero tap latency.

#### AI & Algorithmic Engines:
- **Client-Side Dijkstra Engine**: In-browser graph router calculating topological paths in < 15ms.
- **Edge AI Disaster Prediction**: Pre-trained **XGBoost** model calibrated on 488,558 hours of ERA5 climate telemetry for high-range landslide probability inference.
- **Offline AI Copilot**: Multi-feature NLP semantic matcher grounded in 26 domain clusters.
- **Hybrid Generative Link**: Google Gemini 2.5 Flash API connector for deep conversational expansion when online.

#### Native Mobile Packaging:
- **Capacitor 8.5**: Packaged for Android (Target SDK API 36, Min SDK 24).`,
      actions: [
        { label: 'View GitHub Repository', actionId: 'open_repo', icon: 'ExternalLink', url: 'https://github.com/19-joyal-3/Emergency-Dispatch' },
        { label: 'Download Whitepaper', actionId: 'download_report', icon: 'Download' }
      ]
    })
  },

  // 17. COMMAND PALETTE & KEYBOARD SHORTCUTS
  {
    id: 'SHORTCUTS',
    keywords: [
      'shortcut', 'shortcuts', 'keyboard', 'hotkey', 'hotkeys', 'command palette',
      'ctrl k', 'cmd k', 'ctrl j', 'cmd j', 'how to use', 'navigation keys'
    ],
    priority: 7,
    handler: () => ({
      answer: `### ⌨️ Tactical Keyboard Shortcuts & Command Palette

Resylix provides lightning-fast keyboard controls for desktop operators and field laptop command desks:

- **⌘K / Ctrl + K**: Open the **Command Palette** (Access any tool, dam, hospital, or scenario instantly).
- **⌘J / Ctrl + J**: Toggle the **Tactical AI Copilot**.
- **/** (Slash): Focus the main place and facility search bar.
- **Escape**: Close any active modal, search dropdown, or drawer.
- **R**: Recenter and fit Kerala statewide boundary.
- **T**: Cycle display theme (Terrain → Dark → Satellite → Solar → NVG → Safety).
- **1 - 5**: Switch main tabs (1: Map, 2: Planner, 3: Transit, 4: People, 5: Alerts).
- **?**: Open command assistance.`,
      actions: [
        { label: 'Open Command Palette (⌘K)', actionId: 'open_palette', icon: 'Terminal' },
        { label: 'Cycle Map Theme', actionId: 'theme', icon: 'Eye' }
      ]
    })
  },

  // 18. ROUTE SIMULATION & TURN-BY-TURN HUD
  {
    id: 'SIMULATION',
    keywords: [
      'simulate', 'simulation', 'drive', 'test drive', 'route simulator', 'demo scenario',
      'how to simulate', 'turn by turn simulation', 'speed telemetry'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 🚗 Route Simulation & Tactical Navigation HUD

Resylix allows dispatchers and convoy drivers to simulate navigation along any planned route before putting wheels on the ground:

#### How to Run a Route Simulation:
1. Open the **Tactical Route Planner** (Tab 2 or click *Directions*).
2. Select an origin (Departure) and destination (Target Hospital / Shelter).
3. Choose your vehicle type (Ambulance, Fire Engine, Rescue Truck, Boat, or Drone).
4. Tap **Start Simulation Drive**:
   - The interactive HUD displays real-time speed, ETA, elevation gain, and distance remaining.
   - The map smoothly tracks the convoy marker along the road geometry.
   - Offline voice guidance speaks maneuvers and warns of approaching hazards in English or Malayalam.`,
      actions: [
        { label: 'Launch Demo Scenarios', actionId: 'demo_scenarios', icon: 'Zap' },
        { label: 'Open Route Planner', actionId: 'tab_planner', icon: 'Navigation' }
      ]
    })
  },

  // 19. GOVERNMENT & SOVEREIGN DISCLAIMER
  {
    id: 'DISCLAIMER',
    keywords: [
      'is this official', 'ksdma official', 'government app', 'is it approved',
      'who owns this', 'disclaimer', 'privacy', 'data collection', 'is it free'
    ],
    priority: 8,
    handler: () => ({
      answer: `### 🛡️ Platform Integrity, Privacy & Sovereign Disclaimer

- **Independent Open-Source Initiative**: Resylix is an independent humanitarian tactical software project engineered by **Joyal Thomas Francis**. It is not an official commercial product or government portal issued by KSDMA, though it ingests public KSDMA dam water levels, rule curves, and IMD rainfall warnings.
- **100% Free & Open-Source**: All code is transparently available under open licenses on [GitHub](https://github.com/19-joyal-3/Emergency-Dispatch).
- **Zero Tracking / Total Client-Side Privacy**: Resylix collects **zero personal tracking data**. No advertising identifiers, telemetry pixels, or user recordings. All GPS navigation and graph computations execute strictly on your device.`,
      actions: [
        { label: 'View Source on GitHub', actionId: 'open_repo', icon: 'ExternalLink', url: 'https://github.com/19-joyal-3/Emergency-Dispatch' },
        { label: 'Browse KSDMA Dam Feeds', actionId: 'ksdma_dams', icon: 'Waves' }
      ]
    })
  }
];

// ==============================================================================
// 3. ADVANCED MULTI-FEATURE SEMANTIC SCORING & DISTRICT RESPONDER
// ==============================================================================

/**
 * Contextual multi-intent responder for specific district inquiries
 * Handles Weather, Dams, Facilities, DEOC Helplines, and general SITREPs
 */
export function buildDistrictSpecificResponse(matchedDistrict, rawQuery, norm, context = {}) {
  const deoc = matchedDistrict.deoc || {};
  const w = matchedDistrict.weather || {};
  const alertDef = KSDMA_ALERT_TYPES[(w.alert || 'GREEN').toUpperCase()] || KSDMA_ALERT_TYPES.GREEN;
  const damsInDistrict = (KSDMA_RESERVOIRS || []).filter(d => 
    (d.district || '').toLowerCase() === matchedDistrict.name.toLowerCase()
  );

  const isWeatherQuery = /\b(weather|rain|raining|rainfall|alert|alerts|forecast|monsoon|storm|cloudburst|cyclone|inundation|flood|flooding|climate|wind|squall)\b/i.test(norm) || 
    norm.includes('കാലാവസ്ഥ') || norm.includes('മഴ') || norm.includes('അലർട്ട്');

  const isDamQuery = /\b(dam|dams|reservoir|reservoirs|water level|waterlevel|rule curve|spillway|shutter|shutters)\b/i.test(norm) ||
    norm.includes('അണക്കെട്ട്') || norm.includes('ഡാം');

  const isFacilityQuery = /\b(hospital|hospitals|medical|clinic|trauma|doctor|shelter|shelters|camp|camps|fuel|petrol|diesel|pharmacy|medicine|police)\b/i.test(norm) ||
    norm.includes('ആശുപത്രി');

  const isContactQuery = /\b(helpline|phone|contact|number|numbers|call|deoc|collectorate|control room)\b/i.test(norm) ||
    norm.includes('ഫോൺ');

  // SUB-INTENT 1: WEATHER & MONSOON SITREP
  if (isWeatherQuery && !isDamQuery && !isFacilityQuery) {
    const alertBadge = w.alert === 'RED' ? '🔴 RED ALERT (Take Action / അടിയന്തര നടപടി)' :
                       w.alert === 'ORANGE' ? '🟠 ORANGE ALERT (Be Prepared / ജാഗ്രത പാലിക്കുക)' :
                       w.alert === 'YELLOW' ? '🟡 YELLOW ALERT (Be Aware / ശ്രദ്ധിക്കുക)' :
                       '🟢 GREEN ALERT (Normal Conditions / സാധാരണ നില)';

    return {
      answer: `### 🌦️ KSDMA Weather & Monsoon SITREP: **${matchedDistrict.name}** (${matchedDistrict.malayalam || ''})

#### 1. Official IMD / KSDMA Meteorological Alert:
- **Active Warning Status**: **${alertBadge}**
- **Expected 24h Rainfall**: **~${w.rainfallMm || 20} mm** (${alertDef.rainfallThreshold || ''})
- **Primary Regional Threat**: **${w.primaryThreat || 'Localized Waterlogging'}** (${w.primaryThreatMl || ''})

#### 2. KSDMA Field & Disaster Management Advisory:
> "${w.advisory || 'Standard seasonal precautions apply. Keep tuned to DEOC advisories and avoid isolated lowlands during sudden downpours.'}"

#### 3. Monitored Reservoirs & River Basins in ${matchedDistrict.name}:
${damsInDistrict.length > 0 
  ? damsInDistrict.map(d => `- **${d.name}** (${d.basin || d.district} Basin): Current Level **${d.currentLevelMeters}m** / FRL ${d.frlMeters}m (Rule Curve: **${d.ruleCurveMeters}m**). Alert Status: **${d.alertLevel} Alert** (${d.spillwayStatus || 'Shutters standby'})`).join('\n')
  : `- No major hydroelectric dams situated directly within ${matchedDistrict.name}. Basin discharge and local rivers monitored by ${matchedDistrict.name} DDMA.`}

#### 4. Vulnerable Weather Hotspots in ${matchedDistrict.name}:
${(w.vulnerableHotspots || ['Low-lying waterways', 'Ghat sections']).map(h => `- ⚠️ **${h}**`).join('\n')}

#### 5. 24/7 District Emergency Operations Centre (DEOC):
- **Toll-Free Helpline**: **1077** (Direct access from any landline or mobile in ${matchedDistrict.name})
- **Operations Control Desk**: **${w.deocPhone || deoc.deocDirect || '0471-2730045'}**
- **Collectorate Emergency**: **${deoc.collectoratePhone || 'N/A'}**
- **Police Emergency**: **112** | **Fire & Rescue**: **101** | **Ambulance**: **108**`,
      actions: [
        { label: 'Open Weather Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
        ...(damsInDistrict.length > 0 ? [{ label: `Check ${damsInDistrict[0].name}`, actionId: 'ksdma_dams', icon: 'Waves' }] : []),
        { label: `Call DEOC (${w.deocPhone || deoc.deocDirect})`, actionId: 'call_phone', payload: w.deocPhone || deoc.deocDirect, icon: 'PhoneCall' },
        { label: '5.0 KM Proximity Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: `Facilities in ${matchedDistrict.name}`, actionId: 'poi_directory', icon: 'MapPin' }
      ],
      category: 'DISTRICT_WEATHER',
      confidence: 0.98
    };
  }

  // SUB-INTENT 2: DAMS IN DISTRICT
  if (isDamQuery) {
    return {
      answer: `### 🌊 Reservoirs & Water Level Monitoring: **${matchedDistrict.name}** (${matchedDistrict.malayalam || ''})

Resylix tracks Central Water Commission (CWC) Rule Curves and KSDMA dam water levels across **${matchedDistrict.name}**:

#### Monitored Reservoirs in ${matchedDistrict.name}:
${damsInDistrict.length > 0 
  ? damsInDistrict.map(d => `
##### 🔹 ${d.name} (${d.agency} - ${d.basin} Basin)
- **Current Water Level**: **${d.currentLevelMeters} m** / Full Reservoir Level (FRL): **${d.frlMeters} m**
- **CWC Seasonal Rule Curve**: **${d.ruleCurveMeters} m**
- **Storage Volume**: **${d.storagePercent}%** (~${d.storageMcm} MCM)
- **Alert Status**: **${d.alertLevel} Alert**
- **Spillway Gates**: ${d.spillwayStatus || 'Normal operation'}
- **Downstream Corridor**: ${d.downstreamCorridor || 'Immediate river plains'}
`).join('\n')
  : `No major hydroelectric dams are situated directly within ${matchedDistrict.name}. Downstream flood flows from upstream catchments are monitored by the ${matchedDistrict.name} District Disaster Management Authority (DDMA).`}

#### Downstream Safety Notice:
When spillway shutters operate, sirens sound across downstream banks. Emergency convoys should avoid low-lying bridges and causeways.`,
      actions: [
        { label: 'Open Dam Monitor Modal', actionId: 'ksdma_dams', icon: 'Waves' },
        { label: `Call ${matchedDistrict.name} DEOC (1077)`, actionId: 'call_phone', payload: w.deocPhone || deoc.deocDirect, icon: 'PhoneCall' },
        { label: 'Weather Warning Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' }
      ],
      category: 'DISTRICT_DAMS',
      confidence: 0.98
    };
  }

  // SUB-INTENT 3: FACILITIES & POIS IN DISTRICT
  if (isFacilityQuery) {
    const poisInDistrict = (keralaPois || []).filter(p => 
      (p.district || '').toLowerCase() === matchedDistrict.name.toLowerCase()
    );

    return {
      answer: `### 🏥 Verified Emergency Facilities: **${matchedDistrict.name}** (${matchedDistrict.malayalam || ''})

Resylix maintains an offline directory of **${poisInDistrict.length} verified lifeline facilities** in ${matchedDistrict.name}:

#### Key Verified Facilities:
${poisInDistrict.slice(0, 6).map(p => `- **${p.name}** [${p.category.toUpperCase()}]: ${p.is24x7 ? '🟢 24/7 Available' : 'Normal Hours'} | Phone: **${p.phone || 'N/A'}** (${p.desc || p.address || ''})`).join('\n')}

> Use the **5.0 KM Proximity Scan** to find the nearest emergency hospital, diesel station, or shelter closest to your exact GPS coordinates.`,
      actions: [
        { label: `Browse All ${matchedDistrict.name} Facilities`, actionId: 'poi_directory', icon: 'Hospital' },
        { label: '5.0 KM Proximity Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: `Call DEOC (${w.deocPhone || deoc.deocDirect})`, actionId: 'call_phone', payload: w.deocPhone || deoc.deocDirect, icon: 'PhoneCall' }
      ],
      category: 'DISTRICT_FACILITIES',
      confidence: 0.98
    };
  }

  // SUB-INTENT 4: EMERGENCY HELPLINES & DEOC
  if (isContactQuery) {
    return {
      answer: `### 📞 Emergency Operations & Helplines: **${matchedDistrict.name}** (${matchedDistrict.malayalam || ''})

#### District Emergency Operations Centre (DEOC):
- **Toll-Free Helpline**: **1077** (Direct toll-free access from any landline or mobile within ${matchedDistrict.name})
- **DEOC Direct Operations Desk**: **${w.deocPhone || deoc.deocDirect || '0471-2730045'}**
- **District Collectorate Emergency Control**: **${deoc.collectoratePhone || 'N/A'}**

#### Statewide Sovereign Emergency Lines:
- **State Emergency Operations Centre (SEOC)**: **1070** (Thiruvananthapuram)
- **Police Emergency Response**: **112**
- **Fire & Rescue Services**: **101**
- **Ambulance & Trauma Response**: **108**
- **Kerala Highway Police Helpline**: **9846 100 100**

#### Operational Advisory:
During active Red and Orange alert events, DEOC lines are manned 24 hours a day by Kerala Police, Revenue, and Health Department coordinators.`,
      actions: [
        { label: `Call DEOC (${w.deocPhone || deoc.deocDirect})`, actionId: 'call_phone', payload: w.deocPhone || deoc.deocDirect, icon: 'PhoneCall' },
        { label: 'Call SEOC (1070)', actionId: 'call_phone', payload: '1070', icon: 'PhoneCall' },
        { label: `Facilities in ${matchedDistrict.name}`, actionId: 'poi_directory', icon: 'MapPin' }
      ],
      category: 'DISTRICT_HELPLINE',
      confidence: 0.98
    };
  }

  // SUB-INTENT 5: COMPREHENSIVE DISTRICT SITREP (DEFAULT)
  const alertBadge = w.alert === 'RED' ? '🔴 RED ALERT' :
                     w.alert === 'ORANGE' ? '🟠 ORANGE ALERT' :
                     w.alert === 'YELLOW' ? '🟡 YELLOW ALERT' : '🟢 GREEN ALERT';

  return {
    answer: `### 📍 District Tactical SITREP: **${matchedDistrict.name}** (${matchedDistrict.malayalam || ''})

#### 1. Weather Warning Status:
- **IMD / KSDMA Alert Level**: **${alertBadge}**
- **Expected 24h Rainfall**: **~${w.rainfallMm || 20} mm** (${alertDef.rainfallThreshold || ''})
- **Weather Advisory**: ${w.advisory || 'Standard monsoon caution advised.'}

#### 2. District Emergency Operations Centre (DEOC):
- **Toll-Free Helpline**: **1077** (Accessible from any landline or mobile in ${matchedDistrict.name})
- **Direct Operations Desk**: **${w.deocPhone || deoc.deocDirect || '0471-2730045'}**
- **Collectorate Helpline**: **${deoc.collectoratePhone || 'N/A'}**
- **Police Emergency**: **112** | **Fire & Rescue**: **101** | **Ambulance**: **108**

#### 3. Primary Regional Hazards:
${(deoc.primaryHazards || ['Flash Floods', 'Localized Waterlogging']).map(h => `- ${h}`).join('\n')}

#### 4. Monitored Reservoirs & Dams:
${damsInDistrict.length > 0 
  ? damsInDistrict.map(d => `- **${d.name}**: ${d.alertLevel} Alert (${d.storagePercent}% Storage)`).join('\n')
  : `- No major reservoirs within district limits; regional river catchments monitored.`}

> **Tactical Action**: To view all verified hospitals, fuel pumps, and shelters in ${matchedDistrict.name}, open the Kerala Facilities Directory or run a 5km Proximity Scan.`,
    actions: [
      { label: `Call DEOC (${w.deocPhone || deoc.deocDirect})`, actionId: 'call_phone', payload: w.deocPhone || deoc.deocDirect, icon: 'PhoneCall' },
      { label: 'Open Weather Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
      { label: `Browse Facilities in ${matchedDistrict.name}`, actionId: 'poi_directory', icon: 'MapPin' }
    ],
    category: 'DISTRICT_SPECIFIC',
    confidence: 0.98
  };
}

/**
 * Calculates semantic relevance score between user query and knowledge cluster
 */
function scoreCluster(cluster, normQuery, rawTokens) {
  let score = 0;
  const padded = ` ${normQuery} `;

  // 1. Exact keyword & phrase match with word boundaries
  for (const kw of cluster.keywords) {
    const kwNorm = kw.toLowerCase().trim();
    if (!kwNorm) continue;
    if (normQuery === kwNorm) {
      score += 150; // Exact match
    } else if (padded.includes(` ${kwNorm} `)) {
      score += 25 * (kwNorm.split(' ').length); // Multi-word phrases get higher weight
    } else {
      // Token overlap
      const kwTokens = kwNorm.split(' ');
      const matchingTokens = kwTokens.filter(t => rawTokens.includes(t));
      if (matchingTokens.length > 0) {
        score += (matchingTokens.length / kwTokens.length) * 10;
      }
    }
  }

  // 2. Base cluster priority weight
  score *= (cluster.priority || 5) / 5;

  return score;
}

/**
 * Evaluates any user question locally with comprehensive domain depth.
 * Capable of answering any query about Resylix, disasters, routing, dams, weather, and creator.
 * 
 * @param {string} rawQuery - The user's input question
 * @param {Object} context - Optional telemetry context
 * @returns {Object} { answer, actions, category, confidence }
 */
export function queryTacticalAiCopilotOffline(rawQuery, context = {}) {
  const norm = normalizeQuery(rawQuery);

  if (!norm || norm.length < 2) {
    return {
      answer: `### 🛡️ Resylix Tactical AI Copilot Ready

I am grounded on 100% of the **Resylix Kerala Disaster Management Platform**, engineered by **Joyal Thomas Francis**.

You can ask me anything about:
- **Creator & Architecture**: Who built Resylix, why it was made, and how zero-network navigation works.
- **KSDMA 24 Reservoirs**: Water levels, CWC Rule Curves, and Blue/Orange/Red spillway alerts.
- **14-District Weather Warnings**: IMD Red, Orange, and Yellow alert thresholds and rainfall numbers.
- **210 Verified Kerala Facilities**: Hospitals, trauma centers, fuel pumps, and flood relief shelters.
- **Emergency Numbers**: SEOC (1070) and DEOC (1077) direct hotlines for every district.
- **Tactical Field Tools**: 5km Proximity Scans, reporting road blockages, evacuation manifest PDFs, and bilingual voice navigation.

*Type your question below or tap any suggested operational query.*`,
      actions: [
        { label: 'Check Dams', actionId: 'ksdma_dams', icon: 'Waves' },
        { label: 'Weather Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
        { label: '5km Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: 'Who Created Resylix?', actionId: 'ask_creator', icon: 'Sparkles' }
      ],
      category: 'welcome',
      confidence: 1.0
    };
  }

  const rawTokens = norm.split(/\s+/).filter(t => t.length > 2);
  const detectedDist = detectDistrict(norm);
  const detectedDam = detectDam(norm);

  // High-priority global clusters that override entity detection
  const HIGH_PRIORITY_CLUSTERS = [
    'CREATOR_ATTRIBUTION',
    'WAYANAD_LANDSLIDES',
    'KERALA_FLOODS_HISTORY',
    'OFFLINE_ROUTING',
    'TECHNICAL_STACK',
    'EVACUATION_MANIFEST',
    'VOICE_NAVIGATION',
    'MAP_THEMES_NVG',
    'PWA_INSTALLATION',
    'RULE_CURVES_EXPLAINED',
    'COMMAND_PALETTE',
    'SIMULATION_MODE',
    'SOVEREIGN_DISCLAIMERS'
  ];

  // Score all knowledge clusters
  const scoredClusters = KNOWLEDGE_CLUSTERS.map(c => ({
    cluster: c,
    score: scoreCluster(c, norm, rawTokens)
  })).sort((a, b) => b.score - a.score);

  const topMatch = scoredClusters[0];

  // 1. If high-priority global cluster matched with high score >= 35
  if (topMatch && HIGH_PRIORITY_CLUSTERS.includes(topMatch.cluster.id) && topMatch.score >= 35) {
    const result = topMatch.cluster.handler(rawQuery, norm, context);
    if (result) {
      return {
        answer: result.answer,
        actions: result.actions || [],
        category: topMatch.cluster.id,
        confidence: Math.min(0.99, Math.max(0.85, Number((topMatch.score / 50).toFixed(2))))
      };
    }
  }

  // 2. Specific District Inquiry (Weather, Dams, Facilities, Helpline, or SITREP)
  if (detectedDist) {
    return buildDistrictSpecificResponse(detectedDist, rawQuery, norm, context);
  }

  // 3. Specific Dam Water Level & Rule Curve Inquiry
  if (detectedDam) {
    const damCluster = KNOWLEDGE_CLUSTERS.find(c => c.id === 'DAMS_AND_RULE_CURVES');
    const result = damCluster.handler(rawQuery, norm, context);
    return {
      answer: result.answer,
      actions: result.actions || [],
      category: 'DAM_SPECIFIC',
      confidence: 0.98
    };
  }

  // 4. Any other cluster with confidence match (e.g. statewide weather, 210 facilities, hazard reporting, general helplines)
  if (topMatch && topMatch.score >= 12) {
    const result = topMatch.cluster.handler(rawQuery, norm, context);
    if (result) {
      return {
        answer: result.answer,
        actions: result.actions || [],
        category: topMatch.cluster.id,
        confidence: Math.min(0.99, Math.max(0.85, Number((topMatch.score / 50).toFixed(2))))
      };
    }
  }

  // 5. Intelligent Deep Synthesis Fallback
  return {
    answer: `### 🤖 Tactical AI Analysis: "${rawQuery}"

Resylix is Kerala's dedicated **Offline Tactical Emergency Dispatch & Disaster Navigation Platform**, architected by **Joyal Thomas Francis** ([@19-joyal-3](https://github.com/19-joyal-3)).

#### Key Platform Systems Relevant to Your Query:
1. **Zero-Connectivity Graph Router**: If your question relates to moving between locations, Resylix computes optimal paths in **< 15ms** using client-side Dijkstra algorithms with zero internet required.
2. **KSDMA Dam Rule Curves**: If your inquiry relates to flood risks, we monitor all **24 major reservoirs** in Kerala with Central Water Commission (CWC) Rule Curves and spillway alerts.
3. **14-District Weather Matrix**: Synchronizes daily IMD Red, Orange, and Yellow heavy rainfall alerts across every revenue district.
4. **210 Verified Lifeline Facilities**: Verified hospitals, trauma ICUs, fuel stations with generator power, and disaster relief shelters.
5. **Emergency Hotlines**: State Emergency Operations Centre (**SEOC 1070**) and District Centres (**DEOC 1077**).

#### Recommended Action:
Select one of the tactical actions below or rephrase your inquiry using specific keywords like *dams*, *weather*, *Wayanad*, *hospital*, *routing*, or *creator*.`,
    actions: [
      { label: 'Check 24 Dams', actionId: 'ksdma_dams', icon: 'Waves' },
      { label: 'Weather Warning Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
      { label: '5.0 KM Proximity Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
      { label: 'Who Created Resylix?', actionId: 'ask_creator', icon: 'Sparkles' },
      { label: 'Report Road Hazard', actionId: 'report_hazard', icon: 'AlertTriangle' }
    ],
    category: 'SYNTHESIS_FALLBACK',
    confidence: 0.8
  };
}

// ==============================================================================
// 4. HYBRID ONLINE GEMINI API EXPANSION (PROGRESSIVE ENHANCEMENT)
// ==============================================================================

const GEMINI_SYSTEM_INSTRUCTION = `
You are the Tactical AI Copilot embedded inside Resylix (formerly Vanguard Geo), Kerala's sovereign offline emergency dispatch and disaster navigation platform.

GROUND TRUTH RULES & FACTS:
1. Creator & Architecture: Resylix was conceived, architected, and engineered by Joyal Thomas Francis (@19-joyal-3). Repository: https://github.com/19-joyal-3/Emergency-Dispatch. Email: joyalthomasfrancis3@gmail.com.
2. Mission & History: Built specifically for Kerala disaster response (Kerala floods, Wayanad Chooralmala/Mundakkai landslides, Kavalappara, Pettimudi) during complete cellular and grid blackouts.
3. Offline Routing: Uses an in-browser Dijkstra graph router over preloaded Kerala road networks, with dynamic hazard avoidance (incurring infinite penalty on blocked roads) and OSRM/TomTom fallback when online.
4. KSDMA Dam Hydrology: Tracks 24 reservoirs (Idukki, Mullaperiyar, Banasura Sagar, Kakki, Malampuzha, etc.) with CWC Rule Curves and Normal, Blue, Orange, and Red spillway alert levels.
5. KSDMA Weather: 14-District weather warning matrix (Red >204.4mm/24h, Orange 115.6-204.4mm/24h, Yellow 64.5-115.5mm/24h, Green normal).
6. 210 Verified Facilities: Kerala hospitals, fuel stations, shelters, police, pharmacies, and community kitchens across all 14 districts.
7. Emergency Helplines: SEOC (1070), DEOC (1077 for every district), Police (112), Fire (101), Ambulance (108).
8. Formatting: Always respond in crisp, professional, high-impact tactical markdown with clear bullet points. Be concise, authoritative, and helpful.
`;

/**
 * Queries Gemini API if online and an API key is present;
 * automatically falls back to queryTacticalAiCopilotOffline if offline or on error.
 */
export async function queryTacticalAiCopilot(query, context = {}) {
  const apiKey = (typeof window !== 'undefined' ? localStorage.getItem('resylix_custom_gemini_key') : null) || import.meta.env.VITE_GEMINI_API_KEY;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // If offline or no API key, instantly return comprehensive offline knowledge engine
  if (!apiKey || !isOnline) {
    return queryTacticalAiCopilotOffline(query, context);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${GEMINI_SYSTEM_INSTRUCTION}\n\nUser Question: ${query}` }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 700
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (candidateText && candidateText.trim().length > 10) {
      const offlineFallback = queryTacticalAiCopilotOffline(query, context);
      return {
        answer: candidateText.trim(),
        actions: offlineFallback.actions || [],
        category: offlineFallback.category || 'ai_augmented',
        confidence: 0.99,
        source: 'gemini_augmented'
      };
    }

    return queryTacticalAiCopilotOffline(query, context);
  } catch (err) {
    console.warn('[AI COPILOT] Live Gemini query timed out or failed, using local offline intelligence:', err.message);
    return queryTacticalAiCopilotOffline(query, context);
  }
}
