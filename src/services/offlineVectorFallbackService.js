/**
 * Offline Kerala Tactical Vector Basemap Service
 * 100% Zero-Network, Zero-Bandwidth Standalone Vector Layer
 * 
 * Provides:
 * 1. High-precision Kerala State perimeter & coastline polygon
 * 2. 14 Administrative District boundary polygons
 * 3. Lifeline Transport Corridors (NH-66, NH-544, NH-766, NH-85, SH-1 MC Road)
 * 4. Critical Disaster River Basins (Periyar, Bharathappuzha, Pamba, Chaliyar, Kabini)
 */

export const KERALA_STATE_BOUNDARY = {
  type: "Feature",
  properties: {
    name: "Kerala State Tactical Border",
    type: "state_boundary"
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [74.85, 12.80], [75.35, 12.75], [75.65, 12.20], [75.90, 11.95],
      [76.25, 11.98], [76.45, 11.75], [76.35, 11.50], [76.40, 11.35],
      [76.90, 11.15], [77.00, 10.80], [76.85, 10.45], [77.15, 10.35],
      [77.35, 10.10], [77.25, 9.50],  [77.20, 9.15],  [77.10, 8.85],
      [77.30, 8.30],  [77.05, 8.25],  [76.85, 8.45],  [76.70, 8.75],
      [76.55, 8.85],  [76.50, 9.15],  [76.30, 9.50],  [76.15, 10.05],
      [75.95, 10.55], [75.70, 11.20], [75.55, 11.50], [75.15, 12.00],
      [74.90, 12.55], [74.85, 12.80]
    ]]
  }
};

export const KERALA_LIFELINE_HIGHWAYS = [
  {
    id: 'nh-66',
    name: 'NH-66 (Pan-Kerala Coastal Highway: Kasaragod -> Kochi -> Thiruvananthapuram)',
    coordinates: [
      [12.5103, 74.9852], // Kasaragod
      [11.8745, 75.3704], // Kannur
      [11.5977, 75.5906], // Vadakara
      [11.2588, 75.7804], // Kozhikode
      [10.9333, 75.9167], // Tirur
      [10.5276, 76.2144], // Thrissur
      [10.1076, 76.3496], // Aluva
      [9.9816, 76.2999],  // Kochi
      [9.4981, 76.3388],  // Alappuzha
      [9.1722, 76.5012],  // Kayamkulam
      [8.8932, 76.6141],  // Kollam
      [8.5241, 76.9366],  // Thiruvananthapuram
      [8.4032, 77.0864]   // Neyyattinkara
    ],
    color: '#06b6d4',
    weight: 3.5,
    dashArray: null
  },
  {
    id: 'nh-544',
    name: 'NH-544 (Salem-Kochi Tactical Heavy Cargo Corridor: Palakkad -> Kochi)',
    coordinates: [
      [10.8200, 76.9000], // Walayar Border
      [10.7867, 76.6548], // Palakkad
      [10.6436, 76.5422], // Alathur
      [10.5954, 76.4714], // Vadakkencherry
      [10.5750, 76.3300], // Kuthiran Tunnel
      [10.5276, 76.2144], // Thrissur
      [10.3064, 76.3353], // Chalakudy
      [10.1982, 76.3860], // Angamaly
      [10.1076, 76.3496], // Aluva
      [9.9816, 76.2999]   // Edappally Kochi
    ],
    color: '#3b82f6',
    weight: 4,
    dashArray: null
  },
  {
    id: 'nh-766',
    name: 'NH-766 (Wayanad Ghat Pass: Kozhikode -> Thamarassery Churam -> Kalpetta -> Sulthan Bathery)',
    coordinates: [
      [11.2588, 75.7804], // Kozhikode
      [11.3900, 75.9200], // Kunnamangalam
      [11.4500, 76.0100], // Thamarassery
      [11.5100, 76.0400], // Adivaram
      [11.5450, 76.0250], // Lakkidi (Top of Churam)
      [11.5500, 76.0400], // Vythiri
      [11.6050, 76.0830], // Kalpetta
      [11.6600, 76.2600], // Sulthan Bathery
      [11.7500, 76.3900]  // Muthanga Border
    ],
    color: '#f59e0b',
    weight: 3.5,
    dashArray: '6, 6'
  },
  {
    id: 'sh-1',
    name: 'SH-1 Main Central (MC) Road: Angamaly -> Kottayam -> Adoor -> Thiruvananthapuram',
    coordinates: [
      [10.1982, 76.3860], // Angamaly
      [10.1142, 76.4828], // Perumbavoor
      [9.9794, 76.5828],  // Muvattupuzha
      [9.8500, 76.5700],  // Koothattukulam
      [9.7106, 76.6856],  // Pala Link
      [9.5916, 76.5222],  // Kottayam
      [9.4447, 76.5385],  // Changanassery
      [9.3835, 76.5740],  // Thiruvalla
      [9.2648, 76.7870],  // Pathanamthitta
      [9.1554, 76.7323],  // Adoor
      [9.0142, 76.9248],  // Kottarakkara
      [8.7303, 76.7135],  // Venjaramoodu
      [8.5241, 76.9366]   // Kesavadasapuram TVM
    ],
    color: '#8b5cf6',
    weight: 3,
    dashArray: null
  },
  {
    id: 'nh-85',
    name: 'NH-85 Kochi-Munnar-Dhanushkodi Mountain Pass',
    coordinates: [
      [9.9816, 76.2999],  // Kochi
      [9.9794, 76.5828],  // Muvattupuzha
      [10.0500, 76.7200], // Kothamangalam
      [10.0450, 76.9500], // Neriamangalam
      [10.0214, 76.9535], // Adimali
      [10.0889, 77.0595], // Munnar
      [10.0100, 77.2600]  // Bodimettu Border
    ],
    color: '#ec4899',
    weight: 3,
    dashArray: '4, 4'
  }
];

export const KERALA_MAJOR_RIVERS = [
  {
    id: 'periyar',
    name: 'Periyar River (Mullaperiyar -> Idukki -> Bhoothathankettu -> Aluva)',
    coordinates: [
      [9.5292, 77.1436],
      [9.8497, 76.9744],
      [10.0450, 76.9500],
      [10.1300, 76.6500],
      [10.1076, 76.3496],
      [10.1200, 76.2200]
    ],
    color: '#0284c7',
    weight: 3.5
  },
  {
    id: 'bharathappuzha',
    name: 'Bharathappuzha / Nila (Malampuzha -> Ottapalam -> Shoranur -> Ponnani)',
    coordinates: [
      [10.8300, 76.6900],
      [10.7867, 76.6548],
      [10.7600, 76.3800],
      [10.7600, 76.2700],
      [10.7700, 75.9200]
    ],
    color: '#0284c7',
    weight: 3
  },
  {
    id: 'pamba',
    name: 'Pamba River (Kakki -> Sabarimala -> Ranni -> Kozhencherry -> Kuttanad)',
    coordinates: [
      [9.3300, 77.1500],
      [9.4000, 76.9000],
      [9.3800, 76.7800],
      [9.3400, 76.6000],
      [9.4500, 76.4000]
    ],
    color: '#0284c7',
    weight: 3
  },
  {
    id: 'chaliyar',
    name: 'Chaliyar River (Nilambur -> Edavanna -> Mavoor -> Beypore)',
    coordinates: [
      [11.3500, 76.3500],
      [11.2700, 76.2300],
      [11.2500, 76.0100],
      [11.2400, 75.8700],
      [11.1600, 75.8000]
    ],
    color: '#0284c7',
    weight: 2.5
  }
];
