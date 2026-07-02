import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'mapData.json');

// Fallback data in case Overpass query fails or is blocked
const fallbackKeralaGraph = {
  "nodes": {
    "tvm": { "id": "tvm", "lat": 8.5241, "lng": 76.9366, "name": "Thiruvananthapuram", "type": "city" },
    "kollam": { "id": "kollam", "lat": 8.8932, "lng": 76.6141, "name": "Kollam", "type": "city" },
    "alappuzha": { "id": "alappuzha", "lat": 9.4981, "lng": 76.3388, "name": "Alappuzha", "type": "city" },
    "pathanamthitta": { "id": "pathanamthitta", "lat": 9.2648, "lng": 76.7870, "name": "Pathanamthitta", "type": "city" },
    "kottayam": { "id": "kottayam", "lat": 9.5916, "lng": 76.5222, "name": "Kottayam", "type": "city" },
    "idukki": { "id": "idukki", "lat": 9.8500, "lng": 76.9700, "name": "Idukki/Painavu", "type": "city" },
    "kochi": { "id": "kochi", "lat": 9.9312, "lng": 76.2673, "name": "Kochi/Ernakulam", "type": "city" },
    "thrissur": { "id": "thrissur", "lat": 10.5276, "lng": 76.2144, "name": "Thrissur", "type": "city" },
    "palakkad": { "id": "palakkad", "lat": 10.7867, "lng": 76.6548, "name": "Palakkad", "type": "city" },
    "malappuram": { "id": "malappuram", "lat": 11.0722, "lng": 76.0740, "name": "Malappuram", "type": "city" },
    "kozhibode": { "id": "kozhibode", "lat": 11.2588, "lng": 75.7804, "name": "Kozhikode", "type": "city" },
    "wayanad": { "id": "wayanad", "lat": 11.6050, "lng": 76.0830, "name": "Kalpetta (Wayanad)", "type": "city" },
    "kannur": { "id": "kannur", "lat": 11.8745, "lng": 75.3704, "name": "Kannur", "type": "city" },
    "kasaragod": { "id": "kasaragod", "lat": 12.5103, "lng": 74.9852, "name": "Kasaragod", "type": "city" },
    "munnar": { "id": "munnar", "lat": 10.0889, "lng": 77.0595, "name": "Munnar", "type": "city" },
    "guruvayur": { "id": "guruvayur", "lat": 10.5960, "lng": 76.0370, "name": "Guruvayur", "type": "city" },
    "vadakkencherry": { "id": "vadakkencherry", "lat": 10.5954, "lng": 76.4714, "name": "Vadakkencherry", "type": "city" },
    "valliyode": { "id": "valliyode", "lat": 10.6351, "lng": 76.5186, "name": "Valliyode", "type": "city" },
    "alathur": { "id": "alathur", "lat": 10.6436, "lng": 76.5422, "name": "Alathur", "type": "city" }
  },
  "edges": [
    // NH 66 (Coastal Highway)
    { "from": "tvm", "to": "kollam", "name": "NH 66 (TVM - Kollam)", "distance": 63, "geometry": [[8.5241, 76.9366], [8.7, 76.8], [8.8932, 76.6141]] },
    { "from": "kollam", "to": "alappuzha", "name": "NH 66 (Kollam - Alappuzha)", "distance": 85, "geometry": [[8.8932, 76.6141], [9.1, 76.5], [9.4981, 76.3388]] },
    { "from": "alappuzha", "to": "kochi", "name": "NH 66 (Alappuzha - Kochi)", "distance": 54, "geometry": [[9.4981, 76.3388], [9.7, 76.3], [9.9312, 76.2673]] },
    { "from": "kochi", "to": "guruvayur", "name": "NH 66 / Coastal Road", "distance": 80, "geometry": [[9.9312, 76.2673], [10.2, 76.2], [10.5960, 76.0370]] },
    { "from": "guruvayur", "to": "kozhibode", "name": "NH 66 (Guruvayur - Kozhikode)", "distance": 95, "geometry": [[10.5960, 76.0370], [10.9, 75.9], [11.2588, 75.7804]] },
    { "from": "kozhibode", "to": "kannur", "name": "NH 66 (Kozhikode - Kannur)", "distance": 90, "geometry": [[11.2588, 75.7804], [11.5, 75.6], [11.8745, 75.3704]] },
    { "from": "kannur", "to": "kasaragod", "name": "NH 66 (Kannur - Kasaragod)", "distance": 95, "geometry": [[11.8745, 75.3704], [12.2, 75.1], [12.5103, 74.9852]] },

    // MC Road / SH 1 (Inland Highway)
    { "from": "tvm", "to": "pathanamthitta", "name": "MC Road (TVM - Pathanamthitta via Kottarakkara)", "distance": 105, "geometry": [[8.5241, 76.9366], [8.9, 76.8], [9.2648, 76.7870]] },
    { "from": "pathanamthitta", "to": "kottayam", "name": "SH 1 (Pathanamthitta - Kottayam)", "distance": 55, "geometry": [[9.2648, 76.7870], [9.45, 76.65], [9.5916, 76.5222]] },
    { "from": "kottayam", "to": "kochi", "name": "SH 15 / Kottayam-Kochi Road", "distance": 62, "geometry": [[9.5916, 76.5222], [9.8, 76.4], [9.9312, 76.2673]] },

    // NH 544 (Kochi - Salem Highway, Passing through Vadakkencherry and Alathur)
    { "from": "kochi", "to": "thrissur", "name": "NH 544 (Kochi - Thrissur)", "distance": 74, "geometry": [[9.9312, 76.2673], [10.2, 76.35], [10.5276, 76.2144]] },
    { "from": "thrissur", "to": "vadakkencherry", "name": "NH 544 (Thrissur - Vadakkencherry)", "distance": 34, "geometry": [[10.5276, 76.2144], [10.550, 76.300], [10.575, 76.400], [10.5954, 76.4714]] },
    { "from": "vadakkencherry", "to": "alathur", "name": "NH 544 (Vadakkencherry - Alathur Bypass)", "distance": 12, "geometry": [[10.5954, 76.4714], [10.615, 76.510], [10.6436, 76.5422]] },
    { "from": "alathur", "to": "palakkad", "name": "NH 544 (Alathur - Palakkad)", "distance": 22, "geometry": [[10.6436, 76.5422], [10.700, 76.600], [10.7867, 76.6548]] },

    // Local Connecting Roads for Vadakkencherry - Valliyode - Alathur route
    { 
      "from": "vadakkencherry", 
      "to": "valliyode", 
      "name": "Vadakkencherry-Valliyode Local Road", 
      "distance": 8.5, 
      "geometry": [
        [10.5954, 76.4714],
        [10.6020, 76.4810],
        [10.6110, 76.4920],
        [10.6230, 76.5050],
        [10.6351, 76.5186]
      ]
    },
    { 
      "from": "valliyode", 
      "to": "alathur", 
      "name": "Valliyode-Alathur Road", 
      "distance": 4.5, 
      "geometry": [
        [10.6351, 76.5186],
        [10.6400, 76.5310],
        [10.6436, 76.5422]
      ]
    },

    // Connecting Links
    { "from": "kollam", "to": "pathanamthitta", "name": "Kollam - Pathanamthitta Road", "distance": 58, "geometry": [[8.8932, 76.6141], [9.1, 76.7], [9.2648, 76.7870]] },
    { "from": "alappuzha", "to": "kottayam", "name": "AC Road (Alappuzha - Kottayam)", "distance": 47, "geometry": [[9.4981, 76.3388], [9.55, 76.4], [9.5916, 76.5222]] },
    { "from": "kochi", "to": "munnar", "name": "NH 85 (Kochi - Munnar)", "distance": 120, "geometry": [[9.9312, 76.2673], [10.0, 76.7], [10.0889, 77.0595]] },
    { "from": "munnar", "to": "idukki", "name": "Munnar - Idukki Road", "distance": 55, "geometry": [[10.0889, 77.0595], [9.95, 77.0], [9.8500, 76.9700]] },
    { "from": "kottayam", "to": "idukki", "name": "Kottayam - Idukki Road", "distance": 75, "geometry": [[9.5916, 76.5222], [9.7, 76.8], [9.8500, 76.9700]] },
    { "from": "thrissur", "to": "guruvayur", "name": "Thrissur - Guruvayur Road", "distance": 26, "geometry": [[10.5276, 76.2144], [10.55, 76.1], [10.5960, 76.0370]] },
    { "from": "thrissur", "to": "malappuram", "name": "SH 69 / Thrissur-Malappuram Road", "distance": 70, "geometry": [[10.5276, 76.2144], [10.8, 76.1], [11.0722, 76.0740]] },
    { "from": "malappuram", "to": "palakkad", "name": "Palakkad - Malappuram Highway", "distance": 80, "geometry": [[11.0722, 76.0740], [10.9, 76.4], [10.7867, 76.6548]] },
    { "from": "malappuram", "to": "kozhibode", "name": "Kozhikode - Malappuram Highway", "distance": 50, "geometry": [[11.0722, 76.0740], [11.15, 75.9], [11.2588, 75.7804]] },
    { "from": "kozhibode", "to": "wayanad", "name": "NH 766 (Kozhikode - Wayanad Ghat Road)", "distance": 72, "geometry": [[11.2588, 75.7804], [11.45, 75.95], [11.6050, 76.0830]] },
    { "from": "wayanad", "to": "kannur", "name": "Wayanad - Kannur Road", "distance": 95, "geometry": [[11.6050, 76.0830], [11.8, 75.7], [11.8745, 75.3704]] }
  ],
  // Public transport database for bus schedule queries along routes
  // Enriched to cover all districts and corridors in Kerala bidirectionally
  "busLines": [
    {
      "id": "bus_vdk_vly_pvt",
      "name": "Kairali Travels (Private ordinary)",
      "route": "Vadakkencherry - Valliyode - Alathur",
      "frequency": "Every 15 minutes",
      "fare": 15,
      "stops": ["Vadakkencherry", "Valliyode Junction", "Alathur Town"],
      "nodeSequence": ["vadakkencherry", "valliyode", "alathur"],
      "type": "Private Bus"
    },
    {
      "id": "bus_ksrtc_vdk_vly",
      "name": "KSRTC Venad Ordinary",
      "route": "Thrissur - Vadakkencherry - Valliyode - Alathur",
      "frequency": "6 trips daily",
      "fare": 20,
      "stops": ["Thrissur Bus Stand", "Vadakkencherry", "Valliyode Junction", "Alathur Town"],
      "nodeSequence": ["thrissur", "vadakkencherry", "valliyode", "alathur"],
      "type": "KSRTC Ordinary"
    },
    {
      "id": "bus_ksrtc_fp",
      "name": "KSRTC Fast Passenger (NH 544 Express)",
      "route": "Thrissur - Vadakkencherry - Alathur - Palakkad",
      "frequency": "Every 20 minutes",
      "fare": 50,
      "stops": ["Thrissur Stand", "Vadakkencherry", "Alathur", "Palakkad KSRTC Stand"],
      "nodeSequence": ["thrissur", "vadakkencherry", "alathur", "palakkad"],
      "type": "KSRTC Fast Passenger"
    },
    {
      "id": "bus_private_nh544",
      "name": "Jayasree Private (NH Express)",
      "route": "Kochi - Thrissur - Vadakkencherry - Alathur - Palakkad",
      "frequency": "Every 30 minutes",
      "fare": 65,
      "stops": ["Kochi Vytilla", "Thrissur", "Vadakkencherry", "Alathur", "Palakkad Town"],
      "nodeSequence": ["kochi", "thrissur", "vadakkencherry", "alathur", "palakkad"],
      "type": "Private Limited Stop"
    },
    {
      "id": "bus_ksrtc_swift_south",
      "name": "KSRTC SWIFT Super Fast",
      "route": "Thiruvananthapuram - Kollam - Alappuzha - Kochi",
      "frequency": "Every 30 minutes",
      "fare": 320,
      "stops": ["TVM Central", "Kollam Stand", "Alappuzha Stand", "Kochi Vytilla"],
      "nodeSequence": ["tvm", "kollam", "alappuzha", "kochi"],
      "type": "KSRTC SWIFT Super Fast"
    },
    {
      "id": "bus_ksrtc_swift_north",
      "name": "KSRTC SWIFT Deluxe",
      "route": "Thrissur - Guruvayur - Kozhikode - Kannur - Kasaragod",
      "frequency": "Every 1 hour",
      "fare": 450,
      "stops": ["Thrissur Stand", "Guruvayur Stand", "Kozhikode Stand", "Kannur Stand", "Kasaragod Stand"],
      "nodeSequence": ["thrissur", "guruvayur", "kozhibode", "kannur", "kasaragod"],
      "type": "KSRTC SWIFT Deluxe"
    },
    {
      "id": "bus_ksrtc_venad_mc",
      "name": "KSRTC Venad ordinary (MC Road)",
      "route": "Thiruvananthapuram - Pathanamthitta - Kottayam - Kochi",
      "frequency": "8 trips daily",
      "fare": 240,
      "stops": ["TVM Central", "Pathanamthitta", "Kottayam Stand", "Kochi Vytilla"],
      "nodeSequence": ["tvm", "pathanamthitta", "kottayam", "kochi"],
      "type": "KSRTC Venad Ordinary"
    },
    {
      "id": "bus_malabar_connect",
      "name": "Malabar Travels (Private)",
      "route": "Kozhikode - Wayanad - Kannur",
      "frequency": "Every 30 minutes",
      "fare": 130,
      "stops": ["Kozhikode Stand", "Kalpetta (Wayanad)", "Kannur Stand"],
      "nodeSequence": ["kozhibode", "wayanad", "kannur"],
      "type": "Private Ordinary"
    },
    {
      "id": "bus_highrange_pvt",
      "name": "Highrange Travels (Private Ordinary)",
      "route": "Kochi - Munnar - Idukki - Kottayam",
      "frequency": "4 trips daily",
      "fare": 180,
      "stops": ["Kochi Vytilla", "Munnar", "Idukki/Painavu", "Kottayam Stand"],
      "nodeSequence": ["kochi", "munnar", "idukki", "kottayam"],
      "type": "Private Ordinary"
    },
    {
      "id": "bus_ac_road_pvt",
      "name": "AC ordinary (Private)",
      "route": "Alappuzha - Kottayam",
      "frequency": "Every 20 minutes",
      "fare": 45,
      "stops": ["Alappuzha Stand", "Kottayam Stand"],
      "nodeSequence": ["alappuzha", "kottayam"],
      "type": "Private Ordinary"
    },
    {
      "id": "bus_kollam_pta_pvt",
      "name": "PTA Express (Private)",
      "route": "Kollam - Pathanamthitta",
      "frequency": "Every 30 minutes",
      "fare": 55,
      "stops": ["Kollam Stand", "Pathanamthitta Stand"],
      "nodeSequence": ["kollam", "pathanamthitta"],
      "type": "Private Ordinary"
    },
    {
      "id": "bus_sh69_pvt",
      "name": "SH69 Line (Private)",
      "route": "Thrissur - Malappuram - Palakkad",
      "frequency": "Every 15 minutes",
      "fare": 95,
      "stops": ["Thrissur Stand", "Malappuram Stand", "Palakkad Stand"],
      "nodeSequence": ["thrissur", "malappuram", "palakkad"],
      "type": "Private Ordinary"
    },
    {
      "id": "bus_malappuram_koz_pvt",
      "name": "Valluvanad Travels (Private)",
      "route": "Malappuram - Kozhikode",
      "frequency": "Every 20 minutes",
      "fare": 60,
      "stops": ["Malappuram Stand", "Kozhikode Stand"],
      "nodeSequence": ["malappuram", "kozhibode"],
      "type": "Private Ordinary"
    }
  ]
};

async function fetchKeralaMap() {
  console.log('Writing comprehensive Kerala highway graph and bus routes database...');
  writeOutput(fallbackKeralaGraph);
}

function writeOutput(graphData) {
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graphData, null, 2), 'utf-8');
  console.log(`Map data successfully written to ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB)`);
}

fetchKeralaMap();
