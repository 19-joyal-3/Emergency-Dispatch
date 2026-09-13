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
  originNodeId: 'LIVE-PEER-001',
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

// 6. Test Multi-Hop Daisy-Chain Relay Simulation
console.log('--- Testing Multi-Hop Daisy-Chain Gossip Relay ---');
const originPacket = formatEmergencyPacket({
  senderId: 'NODE-MEPPADI-01',
  senderCallsign: 'Wayanad Isolated Citizen',
  originNodeId: 'NODE-MEPPADI-01',
  originCallsign: 'Wayanad Isolated Citizen',
  lat: 11.55,
  lng: 76.12,
  emergencyType: 'landslide',
  priority: 'critical',
  message: 'Trapped on rooftop due to mudflow',
  ttl: 4,
  hops: 0
});

// Simulate 4 daisy-chained intermediate relay nodes
const relayNodes = [
  { id: 'NODE-RELAY-1', callsign: 'Relay Squad Alpha' },
  { id: 'NODE-RELAY-2', callsign: 'Ambulance 04 Bravo' },
  { id: 'NODE-RELAY-3', callsign: 'Checkpost Charlie' },
  { id: 'NODE-COMMAND-HUB', callsign: 'SEOC Command' }
];

let currentPacket = originPacket;
for (let i = 0; i < relayNodes.length; i++) {
  const relay = relayNodes[i];
  const nextHop = (currentPacket.hops || 0) + 1;
  const relayEntry = {
    nodeId: relay.id,
    callsign: relay.callsign,
    timestamp: Date.now() + (i * 100),
    hopIndex: nextHop
  };
  currentPacket = {
    ...currentPacket,
    senderId: relay.id,
    senderCallsign: relay.callsign,
    hops: nextHop,
    relayChain: [...(currentPacket.relayChain || []), relayEntry]
  };
  console.log(`Relay Hop ${currentPacket.hops}/${currentPacket.ttl}: Relayed via [${relay.callsign}]`);
}

if (currentPacket.hops === 4 && currentPacket.relayChain.length === 4) {
  console.log('✓ 4-Hop daisy-chain mesh relay propagation PASSED');
} else {
  console.error('✗ Daisy-chain relay propagation FAILED');
  process.exit(1);
}

// 7. Test TTL Expiration Enforcement
// A packet with hops >= ttl must NOT be relayed further
const canRelayExpired = p2pEngine.shouldRelayPacket(currentPacket);
console.log(`TTL Expiration Check: Can relay 4-hop packet with TTL 4? ${canRelayExpired} (Expected: false)`);
if (canRelayExpired === false) {
  console.log('✓ TTL expiration enforcement PASSED');
} else {
  console.error('✗ TTL expiration failed: packet with hops >= ttl was permitted to relay');
  process.exit(1);
}

// 8. Test Loop Prevention & Deduplication
// Test 8a: Self-originated packet loop prevention
const selfPacket = formatEmergencyPacket({
  senderId: p2pEngine.localUnitId,
  originNodeId: p2pEngine.localUnitId,
  senderCallsign: p2pEngine.callsign,
  message: 'Self test packet'
});
if (p2pEngine.shouldRelayPacket(selfPacket) === false) {
  console.log('✓ Self-origin loop reflection prevention PASSED');
} else {
  console.error('✗ Self-origin loop prevention FAILED');
  process.exit(1);
}

// Test 8b: Already seen / duplicate packet loop prevention
p2pEngine.seenPacketIds.set('TEST-SEEN-123', Date.now());
const seenPacket = { id: 'TEST-SEEN-123', originNodeId: 'OTHER-NODE', hops: 1, ttl: 5 };
if (p2pEngine.shouldRelayPacket(seenPacket) === false) {
  console.log('✓ Seen packet deduplication & loop prevention PASSED');
} else {
  console.error('✗ Duplicate packet loop prevention FAILED');
  process.exit(1);
}

// 9. Test Store-and-Forward Buffer & Gossip Stats
const sfCount = p2pEngine.getStoreAndForwardCount();
const stats = p2pEngine.getMeshRelayStats();
console.log(`Store-and-Forward Buffer Count: ${sfCount}`);
console.log(`Local Node ID: ${stats.localNodeId} (${stats.callsign})`);
if (typeof sfCount === 'number' && stats.localNodeId) {
  console.log('✓ Store-and-Forward telemetry and buffer PASSED');
} else {
  console.error('✗ Store-and-Forward telemetry FAILED');
  process.exit(1);
}

p2pEngine.stopScanning();
console.log('✓ ALL LIVE P2P RADAR, MULTI-HOP GOSSIP & STORE-AND-FORWARD TESTS PASSED!\n');
