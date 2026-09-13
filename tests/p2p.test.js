import { p2pEngine, rssiToDistance, getSignalQuality, formatEmergencyPacket } from '../src/p2p.js';

console.log('--- [TEST SUITE 1] LIVE P2P RADAR & EMERGENCY MESH ENGINE ---');

// 1. Test RSSI to Distance
const d1 = rssiToDistance(-50);
const d2 = rssiToDistance(-70);
const d3 = rssiToDistance(-85);
console.log(`RSSI -50 dBm => ${d1}m (Expected < 3m)`);
console.log(`RSSI -70 dBm => ${d2}m (Expected ~8-20m)`);
console.log(`RSSI -85 dBm => ${d3}m (Expected > 30m)`);
if (d1 < d2 && d2 < d3) {
  console.log('✓ RSSI path-loss distance calculation PASSED');
} else {
  console.error('✗ RSSI distance calculation FAILED');
  process.exit(1);
}

// 2. Test Signal Quality
const q1 = getSignalQuality(-50);
const q2 = getSignalQuality(-75);
const q3 = getSignalQuality(-90);
console.log(`Signal Quality: -50 dBm = ${q1.text} (${q1.bars} bars)`);
console.log(`Signal Quality: -75 dBm = ${q2.text} (${q2.bars} bars)`);
console.log(`Signal Quality: -90 dBm = ${q3.text} (${q3.bars} bars)`);
if (q1.bars === 4 && q2.bars === 2 && q3.bars === 1) {
  console.log('✓ Signal quality classification PASSED');
} else {
  console.error('✗ Signal quality classification FAILED');
  process.exit(1);
}

// 3. Test Emergency Packet Serialization
const packet = formatEmergencyPacket({
  senderCallsign: 'Rescue Squad Alpha',
  lat: 9.9312,
  lng: 76.2673,
  emergencyType: 'flood',
  priority: 'critical',
  message: 'Water level rising above 2nd floor'
});
console.log('Sample Packet ID:', packet.id);
console.log('Sample Packet Callsign:', packet.senderCallsign);
if (packet.id.startsWith('SOS-') && packet.emergencyType === 'flood' && packet.priority === 'critical') {
  console.log('✓ Emergency packet schema PASSED');
} else {
  console.error('✗ Emergency packet schema FAILED');
  process.exit(1);
}

// 4. Test Engine Discovery (No fake/mock units spawned)
p2pEngine.setLocalPosition(9.9312, 76.2673);
p2pEngine.startScanning();
const devices = p2pEngine.getDevicesList();
console.log(`Discovered Simulated Devices: ${devices.length} (Expected: 0 fake devices)`);
if (devices.length === 0) {
  console.log('✓ Zero fake devices spawned: Engine correctly requires authentic hardware/peers');
} else {
  console.error('✗ Simulated devices still found!');
  process.exit(1);
}

// 5. Test Authentic Mesh Packet Handling
const authenticSos = formatEmergencyPacket({
  senderId: 'LIVE-PEER-001',
  senderCallsign: 'Kozhikode Rapid Response',
  lat: 11.2588,
  lng: 75.7804,
  emergencyType: 'medical',
  priority: 'critical',
  message: 'Immediate trauma support requested at NH junction'
});
p2pEngine.handleIncomingMeshPacket({
  type: 'P2P_EMERGENCY_SOS',
  packet: authenticSos
});

const messages = p2pEngine.getMessages();
if (messages.length > 0 && messages[0].id === authenticSos.id) {
  console.log('✓ Authentic distress packet reception and logging PASSED');
} else {
  console.error('✗ Authentic distress packet reception FAILED');
  process.exit(1);
}

p2pEngine.stopScanning();
console.log('✓ ALL LIVE P2P RADAR & EMERGENCY SOS TESTS PASSED!\n');
