// Kerala Major Dams & Hydroelectric Reservoirs Telemetry

export const KERALA_DAMS = [
  {
    id: 'dam_idukki',
    name: 'Idukki Arch Dam & Cheruthoni',
    district: 'Idukki',
    river: 'Periyar River',
    fullReservoirLevelFt: 2403,
    currentWaterLevelFt: 2382.4,
    storagePercent: 78,
    alertLevel: 'Orange', // Normal, Blue, Orange, Red
    shutterStatus: '2 Shutters Open (50cm)',
    dischargingCusecs: 1500,
    downstreamZones: ['Cheruthoni', 'Vandiperiyar', 'Kalady', 'Aluva']
  },
  {
    id: 'dam_mullaperiyar',
    name: 'Mullaperiyar Dam',
    district: 'Idukki',
    river: 'Periyar River',
    fullReservoirLevelFt: 142,
    currentWaterLevelFt: 138.6,
    storagePercent: 88,
    alertLevel: 'Red',
    shutterStatus: '3 Spillway Gates Open',
    dischargingCusecs: 2800,
    downstreamZones: ['Vallakkadavu', 'Vandiperiyar', 'Chappath', 'Upputhara']
  },
  {
    id: 'dam_banasura',
    name: 'Banasura Sagar Dam',
    district: 'Wayanad',
    river: 'Karamanathodu (Kabini)',
    fullReservoirLevelFt: 775.6,
    currentWaterLevelFt: 768.2,
    storagePercent: 72,
    alertLevel: 'Blue',
    shutterStatus: 'All Shutters Closed',
    dischargingCusecs: 0,
    downstreamZones: ['Padinjarathara', 'Kottathara', 'Mananthavady']
  },
  {
    id: 'dam_malampuzha',
    name: 'Malampuzha Dam',
    district: 'Palakkad',
    river: 'Bharathapuzha Basin',
    fullReservoirLevelFt: 115.06,
    currentWaterLevelFt: 112.4,
    storagePercent: 81,
    alertLevel: 'Orange',
    shutterStatus: '4 Shutters Raised (15cm)',
    dischargingCusecs: 950,
    downstreamZones: ['Palakkad Town', 'Kalpathy', 'Ottapalam']
  },
  {
    id: 'dam_idamalayar',
    name: 'Idamalayar Dam',
    district: 'Ernakulam',
    river: 'Idamalayar (Periyar tributary)',
    fullReservoirLevelFt: 169,
    currentWaterLevelFt: 154.2,
    storagePercent: 65,
    alertLevel: 'Normal',
    shutterStatus: 'Shutters Closed',
    dischargingCusecs: 0,
    downstreamZones: ['Bhoothathankettu', 'Malayattoor', 'Aluva']
  },
  {
    id: 'dam_kakki',
    name: 'Kakki - Anathode Dam',
    district: 'Pathanamthitta',
    river: 'Pamba River',
    fullReservoirLevelFt: 981.45,
    currentWaterLevelFt: 968.1,
    storagePercent: 74,
    alertLevel: 'Blue',
    shutterStatus: 'Shutters Closed',
    dischargingCusecs: 0,
    downstreamZones: ['Ranni', 'Kozhencherry', 'Chengannur', 'Aranmula']
  }
];

export function getAlertBadgeStyle(level) {
  switch (level) {
    case 'Red':
      return { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' };
    case 'Orange':
      return { bg: 'rgba(249, 115, 22, 0.2)', border: '#f97316', text: '#fdba74' };
    case 'Blue':
      return { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#93c5fd' };
    default:
      return { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#86efac' };
  }
}
