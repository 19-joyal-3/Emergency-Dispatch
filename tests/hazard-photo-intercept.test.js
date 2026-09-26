import { checkUserHazardProximity, formatGeofenceAlertMessage, findEntitiesInGeofence } from '../src/geofence.js';
import { formatEmergencyPacket } from '../src/p2p.js';

console.log('--- [TEST SUITE 2] LOCATION-BASED HAZARD CHECK & SCREEN ALERT PHOTO INTERCEPT ---');

// Mock uploaded photograph (data URL)
const mockUploadedPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...MOCK_LANDSLIDE_EVIDENCE_PHOTO_DATA...';

// 1. New Incident Reported with Photo
const reportedIncident = {
  id: 'inc_test_wayanad_landslide',
  type: 'landslide',
  description: 'Severe landslide blocking NH-766 corridor near Chooralmala. Multiple debris flows across roadway.',
  lat: 11.5321,
  lng: 76.1284,
  priority: 'critical',
  proofImage: mockUploadedPhoto,
  status: 'pending'
};

// 2. Active tracked users in different locations across Kerala
const activeUsers = [
  { id: 'user_driver_approaching', name: 'Citizen Driver (Approaching Wayanad)', lat: 11.5250, lng: 76.1200 }, // ~1.2 km away -> MUST BE ALERTED
  { id: 'user_first_responder', name: 'Patrol Car Echo (Route Interceptor)', lat: 11.5400, lng: 76.1350 },     // ~1.1 km away -> MUST BE ALERTED
  { id: 'user_distant_kochi', name: 'Citizen in Kochi', lat: 9.9312, lng: 76.2673 },                            // >170 km away -> MUST NOT BE ALERTED
  { id: 'user_distant_trivandrum', name: 'Citizen in Trivandrum', lat: 8.5241, lng: 76.9366 }                   // >330 km away -> MUST NOT BE ALERTED
];

// Step A: Spatial Geofence Scan (5.0 km perimeter)
const inDangerZone = findEntitiesInGeofence({
  centerLat: reportedIncident.lat,
  centerLng: reportedIncident.lng,
  radiusKm: 5.0,
  customers: activeUsers,
  responders: []
});

console.log(`[SPATIAL CHECK] Total users analyzed: ${activeUsers.length}`);
console.log(`[SPATIAL CHECK] Users within 5.0km hazard perimeter: ${inDangerZone.totalCount}`);

if (inDangerZone.totalCount !== 2) {
  console.error(`FAILED: Expected 2 users in danger zone, found ${inDangerZone.totalCount}`);
  process.exit(1);
}
console.log('✓ Correctly identified exactly the 2 users in proximity of the hazard');

// Step B: Screen Alert Modal evaluation for each user
activeUsers.forEach(user => {
  const check = checkUserHazardProximity({
    userLat: user.lat,
    userLng: user.lng,
    incidents: [reportedIncident],
    hazardZones: [],
    thresholdKm: 5.0
  });

  if (check.isThreatDetected) {
    console.log(`🚨 SCREEN ALERT TRIGGERED for [${user.name}]:`);
    console.log(`   - Distance Ahead: ${check.distanceKm.toFixed(2)} km`);
    console.log(`   - Hazard Title: ${check.hazard.title}`);
    console.log(`   - SITREP Message: ${check.hazard.description}`);
    console.log(`   - Ground Photographic Evidence Attached: ${check.hazard.proofImage ? 'YES (Verified Base64 Image)' : 'NO'}`);
    
    if (!check.hazard.proofImage) {
      console.error(`FAILED: Proof image was not attached to the hazard alert object for ${user.name}`);
      process.exit(1);
    }
  } else {
    console.log(`🟢 SAFE (No alert) for [${user.name}]: User is outside hazard perimeter`);
  }
});

// Step C: Verify P2P mesh relay preserves the photo payload
const p2pSosPacket = formatEmergencyPacket({
  senderCallsign: 'Chooralmala Field Reporter',
  lat: reportedIncident.lat,
  lng: reportedIncident.lng,
  emergencyType: 'landslide',
  priority: 'critical',
  message: reportedIncident.description,
  proofImage: mockUploadedPhoto
});

console.log('[P2P BROADCAST PACKET VERIFICATION]');
console.log(`Packet ID: ${p2pSosPacket.id}`);
console.log(`Packet Type: ${p2pSosPacket.emergencyType}`);
console.log(`Photo Payload Preserved: ${!!p2pSosPacket.proofImage}`);

if (!p2pSosPacket.proofImage) {
  console.error('FAILED: P2P SOS packet dropped the proofImage');
  process.exit(1);
}

// Step D: Verify Geofence Broadcast Alert Formatting with Photo
const geoAlert = formatGeofenceAlertMessage({
  title: 'Chooralmala Debris Flow',
  severity: 'CRITICAL',
  actionAdvice: 'DO NOT PROCEED TOWARDS MEADI/WAYANAD CORRIDOR.',
  proofImage: mockUploadedPhoto
});

console.log('[GEOFENCE BROADCAST MESSAGE]');
console.log(`Alert ID: ${geoAlert.id}`);
console.log(`Alert Photo: ${geoAlert.proofImage ? 'Attached' : 'None'}`);

if (!geoAlert.proofImage) {
  console.error('FAILED: Geofence alert dropped the proofImage');
  process.exit(1);
}

console.log('✓ ALL HAZARD PROXIMITY & PHOTO INTERCEPT TESTS PASSED!\n');
