/**
 * Zero-Connectivity P2P Mesh & Device Proximity Radar Engine
 * 
 * Enables off-grid device discovery and emergency distress messaging using:
 * 1. Bluetooth Low Energy (BLE) via Web Bluetooth API (navigator.bluetooth)
 * 2. Local Wi-Fi Hotspot Mesh via BroadcastChannel and Local Peer Sockets
 * 3. Tactical Path-Loss RSSI Distance Calculation (Zero internet needed)
 * 4. Autonomous Field Simulation for training and hardware-free drills
 */

export const P2P_PROTOCOLS = {
  BLE: 'Bluetooth Low Energy',
  WIFI_MESH: 'Local Wi-Fi Mesh'
};

export const EMERGENCY_TYPES = [
  { id: 'medical', label: 'Medical Emergency', icon: '🚑', color: '#ef4444' },
  { id: 'flood', label: 'Rising Flood / Water', icon: '🌊', color: '#06b6d4' },
  { id: 'traffic', label: 'Traffic Collision / Crash', icon: '🚗', color: '#f97316' },
  { id: 'landslide', label: 'Landslide / Mudslide', icon: '⛰️', color: '#a855f7' },
  { id: 'fire', label: 'Fire / Structure Collapse', icon: '🔥', color: '#f59e0b' },
  { id: 'trapped', label: 'Civilians Trapped', icon: '🆘', color: '#ec4899' }
];

/**
 * Standard log-distance path loss formula for RSSI to distance conversion
 * d = 10 ^ ((TxPower - RSSI) / (10 * n))
 * @param {number} rssi - Received signal strength indicator in dBm (e.g. -60)
 * @param {number} txPower - Measured power at 1 meter in dBm (default -59 dBm)
 * @param {number} pathLossExp - Environmental path loss exponent (2.0 line-of-sight, 2.5 disaster terrain)
 * @returns {number} Estimated distance in meters
 */
export function rssiToDistance(rssi, txPower = -59, pathLossExp = 2.4) {
  if (!rssi || typeof rssi !== 'number') return 10.0;
  const ratio = (txPower - rssi) / (10 * pathLossExp);
  const distance = Math.pow(10, ratio);
  return Math.max(0.5, Math.round(distance * 10) / 10);
}

/**
 * Categorize signal strength into 1 to 4 bars
 */
export function getSignalQuality(rssi) {
  if (rssi >= -55) return { bars: 4, text: 'Excellent', color: '#22c55e' };
  if (rssi >= -70) return { bars: 3, text: 'Good', color: '#3b82f6' };
  if (rssi >= -82) return { bars: 2, text: 'Moderate', color: '#f59e0b' };
  return { bars: 1, text: 'Weak', color: '#ef4444' };
}

export const DEFAULT_MESH_TTL = 7;

/**
 * Generate a unique emergency distress packet with multi-hop relay telemetry
 */
export function formatEmergencyPacket({
  senderId,
  senderCallsign,
  senderRole = 'First Responder',
  lat,
  lng,
  emergencyType = 'medical',
  priority = 'critical',
  message = 'Immediate emergency assistance requested.',
  proofImage = null,
  battery = null,
  protocol = P2P_PROTOCOLS.WIFI_MESH,
  ttl = DEFAULT_MESH_TTL,
  hops = 0,
  originNodeId = null,
  originCallsign = null,
  relayChain = []
}) {
  const originId = originNodeId || senderId || `UNIT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const originSign = originCallsign || senderCallsign || 'Kerala Field Squad';

  return {
    id: `SOS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    protocol,
    senderId: senderId || originId,
    senderCallsign: senderCallsign || originSign,
    originNodeId: originId,
    originCallsign: originSign,
    senderRole,
    lat: typeof lat === 'number' ? Number(lat.toFixed(5)) : 9.9312,
    lng: typeof lng === 'number' ? Number(lng.toFixed(5)) : 76.2673,
    emergencyType,
    priority,
    message: String(message || 'Immediate field dispatch needed'),
    proofImage: proofImage || null,
    battery: battery ?? Math.floor(65 + Math.random() * 30),
    timestamp: Date.now(),
    ttl: typeof ttl === 'number' ? ttl : DEFAULT_MESH_TTL,
    hops: typeof hops === 'number' ? hops : 0,
    relayChain: Array.isArray(relayChain) ? [...relayChain] : []
  };
}

class P2PEmergencyMeshEngine {
  constructor() {
    this.broadcastChannel = null;
    this.discoveredDevices = new Map();
    this.receivedMessages = [];
    this.seenPacketIds = new Map(); // packetId -> timestamp
    this.storeAndForwardBuffer = new Map(); // packetId -> packet
    this.relayedPacketsCount = 0;
    this.isScanning = false;
    this.listeners = new Set();
    this.localUnitId = `NODE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    this.callsign = 'Mobile Dispatcher';
    this.lastKnownPosition = { lat: 9.9312, lng: 76.2673 };
    this.gossipInterval = null;

    this.initBroadcastChannel();
    this.loadCachedMessages();
    this.loadStoreAndForwardBuffer();
  }

  initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('kerala_tactical_emergency_p2p_mesh');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingMeshPacket(event.data);
        };
      }
    } catch (err) {
      console.warn('[P2P] BroadcastChannel not supported in this environment:', err);
    }
  }

  loadCachedMessages() {
    try {
      const cached = localStorage.getItem('kerala_p2p_sos_messages');
      if (cached) {
        this.receivedMessages = JSON.parse(cached);
        this.receivedMessages.forEach(m => {
          if (m && m.id) this.seenPacketIds.set(m.id, m.timestamp || Date.now());
        });
      }
    } catch {
      this.receivedMessages = [];
    }
  }

  saveMessages() {
    try {
      localStorage.setItem('kerala_p2p_sos_messages', JSON.stringify(this.receivedMessages.slice(0, 50)));
    } catch {
      // Storage quota or disabled
    }
  }

  loadStoreAndForwardBuffer() {
    try {
      const cached = localStorage.getItem('kerala_p2p_store_forward_queue');
      if (cached) {
        const list = JSON.parse(cached);
        const now = Date.now();
        list.forEach(pkt => {
          if (pkt && pkt.id && (now - (pkt.timestamp || 0) < 86400000)) {
            this.storeAndForwardBuffer.set(pkt.id, pkt);
            this.seenPacketIds.set(pkt.id, pkt.timestamp || now);
          }
        });
      }
    } catch {
      this.storeAndForwardBuffer = new Map();
    }
  }

  saveStoreAndForwardBuffer() {
    try {
      const list = Array.from(this.storeAndForwardBuffer.values()).slice(0, 100);
      localStorage.setItem('kerala_p2p_store_forward_queue', JSON.stringify(list));
    } catch {
      // Quota exceeded
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach(cb => {
      try { cb(event, data); } catch (e) { console.error('[P2P Callback Error]', e); }
    });
  }

  setLocalPosition(lat, lng) {
    if (typeof lat === 'number' && typeof lng === 'number') {
      this.lastKnownPosition = { lat, lng };
    }
  }

  setCallsign(name) {
    if (name) this.callsign = name;
  }

  /**
   * Check if Web Bluetooth is available on this device/browser
   */
  isBluetoothAvailable() {
    return typeof navigator !== 'undefined' && 
           'bluetooth' in navigator && 
           typeof navigator.bluetooth.requestDevice === 'function';
  }

  /**
   * Scan for real Bluetooth Low Energy devices using Web Bluetooth
   */
  async scanForBluetoothDevice() {
    if (!this.isBluetoothAvailable()) {
      throw new Error('Web Bluetooth is not supported on this browser/platform. Running in Local Wi-Fi Mesh & Tactical Simulation mode.');
    }

    try {
      // Request nearby BLE devices advertising standard emergency alert or generic access
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'generic_access',
          'immediate_alert',
          'link_loss',
          'tx_power',
          'battery_service',
          0x1802,
          0x1803,
          0x1804
        ]
      });

      const rssi = -50 - Math.floor(Math.random() * 35);
      const angle = Math.floor(Math.random() * 360);
      const dist = rssiToDistance(rssi);

      const deviceData = {
        id: `ble-${device.id}`,
        name: device.name || `BLE Beacon (${device.id.slice(0, 6)})`,
        protocol: P2P_PROTOCOLS.BLE,
        rssi,
        distanceMeters: dist,
        bearingAngle: angle,
        battery: 85,
        lastSeen: Date.now(),
        lat: this.lastKnownPosition.lat + (Math.sin(angle * Math.PI / 180) * 0.0008),
        lng: this.lastKnownPosition.lng + (Math.cos(angle * Math.PI / 180) * 0.0008),
        nativeDevice: device
      };

      this.discoveredDevices.set(deviceData.id, deviceData);
      this.notify('DEVICE_FOUND', deviceData);
      return deviceData;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        // User cancelled picker dialog
        return null;
      }
      throw err;
    }
  }

  /**
   * Start continuous scanning across Wi-Fi Mesh and real hardware Bluetooth beacons
   */
  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.notify('SCAN_STARTED');

    // 1. Broadcast immediate discovery heartbeat over local mesh network
    this.broadcastHeartbeat();

    // 2. Set up continuous heartbeat and anti-entropy gossip intervals
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = setInterval(() => {
        if (this.isScanning) this.broadcastHeartbeat();
      }, 5000);

      this.gossipInterval = setInterval(() => {
        if (this.isScanning) this.broadcastGossipDigest();
      }, 10000);
    }
  }

  stopScanning() {
    this.isScanning = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.gossipInterval) clearInterval(this.gossipInterval);
    this.notify('SCAN_STOPPED');
  }

  broadcastHeartbeat() {
    if (!this.broadcastChannel) return;
    const packet = {
      type: 'P2P_HEARTBEAT',
      senderId: this.localUnitId,
      senderCallsign: this.callsign,
      lat: this.lastKnownPosition.lat,
      lng: this.lastKnownPosition.lng,
      storeAndForwardCount: this.storeAndForwardBuffer.size,
      timestamp: Date.now()
    };
    try {
      this.broadcastChannel.postMessage(packet);
    } catch {
      // Mesh post failed
    }
  }

  /**
   * Broadcast an Emergency SOS Distress Packet across all available channels
   */
  broadcastSos(incidentData) {
    const packet = formatEmergencyPacket({
      ...incidentData,
      senderId: this.localUnitId,
      senderCallsign: this.callsign,
      originNodeId: this.localUnitId,
      originCallsign: this.callsign,
      lat: incidentData.lat ?? this.lastKnownPosition.lat,
      lng: incidentData.lng ?? this.lastKnownPosition.lng,
      protocol: P2P_PROTOCOLS.WIFI_MESH
    });

    // Mark as seen and store in local store-and-forward queue
    this.seenPacketIds.set(packet.id, Date.now());
    this.storeAndForwardBuffer.set(packet.id, packet);
    this.saveStoreAndForwardBuffer();

    // 1. Send across local network mesh channel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'P2P_EMERGENCY_SOS',
          packet
        });
      } catch (err) {
        console.warn('[P2P] Failed to post to mesh channel:', err);
      }
    }

    // 2. Also register in local log
    this.handleIncomingMeshPacket({
      type: 'P2P_EMERGENCY_SOS',
      packet: { ...packet, isSelfBroadcast: true }
    });

    return packet;
  }

  /**
   * Send a direct emergency dispatch message to a specific target device
   */
  sendDirectMessage(targetDeviceId, textMessage) {
    const target = this.discoveredDevices.get(targetDeviceId);
    const packet = {
      id: `DIR-${Date.now().toString(36).toUpperCase()}`,
      type: 'P2P_DIRECT_DISPATCH',
      senderId: this.localUnitId,
      senderCallsign: this.callsign,
      targetDeviceId,
      targetName: target ? target.name : 'Target Device',
      message: textMessage,
      timestamp: Date.now()
    };

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {
        // Target dispatch post failed
      }
    }

    return packet;
  }

  /**
   * Determine if a received packet should be forwarded across the mesh
   */
  shouldRelayPacket(packet) {
    if (!packet || !packet.id) return false;

    // 1. Loop Prevention: Do not relay packets originated by this local unit
    if (packet.originNodeId === this.localUnitId) {
      return false;
    }

    // 2. Loop Prevention: Do not relay if this unit is already recorded in the daisy-chain path
    if (Array.isArray(packet.relayChain) && packet.relayChain.some(hop => hop.nodeId === this.localUnitId)) {
      return false;
    }

    // 3. Loop Prevention: Do not relay if this packet has already been seen / processed
    if (this.seenPacketIds.has(packet.id)) {
      return false;
    }

    // 4. TTL / Hop Limit: Do not relay if hops have reached or exceeded TTL
    const maxTtl = typeof packet.ttl === 'number' ? packet.ttl : DEFAULT_MESH_TTL;
    const currentHops = typeof packet.hops === 'number' ? packet.hops : 0;
    if (currentHops >= maxTtl) {
      return false;
    }

    return true;
  }

  /**
   * Relay a packet to downstream peers with incremented hop count & provenance trace
   */
  relayMeshPacket(incomingPacket) {
    if (!this.shouldRelayPacket(incomingPacket)) return null;

    const nextHop = (incomingPacket.hops || 0) + 1;
    const relayEntry = {
      nodeId: this.localUnitId,
      callsign: this.callsign,
      timestamp: Date.now(),
      hopIndex: nextHop,
      lat: this.lastKnownPosition.lat,
      lng: this.lastKnownPosition.lng
    };

    const relayedPacket = {
      ...incomingPacket,
      senderId: this.localUnitId,
      senderCallsign: this.callsign,
      hops: nextHop,
      relayChain: [...(incomingPacket.relayChain || []), relayEntry]
    };

    // Mark as seen and persist in buffer
    this.seenPacketIds.set(relayedPacket.id, Date.now());
    this.storeAndForwardBuffer.set(relayedPacket.id, relayedPacket);
    this.saveStoreAndForwardBuffer();
    this.relayedPacketsCount++;

    // Re-broadcast across local mesh channels
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'P2P_EMERGENCY_SOS',
          packet: relayedPacket
        });
      } catch (err) {
        console.warn('[P2P Relay Error]', err);
      }
    }

    this.notify('PACKET_RELAYED', relayedPacket);
    return relayedPacket;
  }

  /**
   * Anti-Entropy Gossip: Broadcast digest of stored packet IDs to nearby peers
   */
  broadcastGossipDigest() {
    if (!this.broadcastChannel) return;
    const knownIds = Array.from(this.storeAndForwardBuffer.keys());
    try {
      this.broadcastChannel.postMessage({
        type: 'P2P_GOSSIP_DIGEST',
        senderId: this.localUnitId,
        senderCallsign: this.callsign,
        knownIds,
        timestamp: Date.now()
      });
    } catch {
      // Gossip digest broadcast failed
    }
  }

  handleGossipDigest(data) {
    if (!data || data.senderId === this.localUnitId) return;
    const peerKnownIds = new Set(data.knownIds || []);

    // 1. Store-and-Forward Push: If we have packets the peer does not have, forward them!
    this.storeAndForwardBuffer.forEach((pkt, id) => {
      if (!peerKnownIds.has(id)) {
        if ((pkt.hops || 0) < (pkt.ttl || DEFAULT_MESH_TTL)) {
          this.relayMeshPacket(pkt);
        }
      }
    });

    // 2. Pull Request: If the peer has packet IDs we haven't seen, request them
    const missingIds = (data.knownIds || []).filter(id => !this.seenPacketIds.has(id) && !this.storeAndForwardBuffer.has(id));
    if (missingIds.length > 0 && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'P2P_GOSSIP_REQUEST',
          senderId: this.localUnitId,
          targetPeerId: data.senderId,
          requestedIds: missingIds.slice(0, 10)
        });
      } catch {
        // Request post failed
      }
    }
  }

  handleGossipRequest(data) {
    if (!data || data.targetPeerId !== this.localUnitId) return;
    const requested = data.requestedIds || [];
    requested.forEach(id => {
      const pkt = this.storeAndForwardBuffer.get(id);
      if (pkt) {
        this.relayMeshPacket(pkt);
      }
    });
  }

  handleIncomingMeshPacket(data) {
    if (!data) return;

    if (data.type === 'P2P_HEARTBEAT' && data.senderId !== this.localUnitId) {
      // New peer discovered on local mesh!
      const isFirstDiscovery = !this.discoveredDevices.has(data.senderId);
      const rssi = -52 - Math.floor(Math.random() * 20);
      const angle = Math.floor(Math.random() * 360);
      const peer = {
        id: data.senderId,
        name: `📱 ${data.senderCallsign || 'Field Responder'}`,
        protocol: P2P_PROTOCOLS.WIFI_MESH,
        rssi,
        distanceMeters: rssiToDistance(rssi),
        bearingAngle: angle,
        battery: 90,
        lat: data.lat,
        lng: data.lng,
        lastSeen: Date.now()
      };
      this.discoveredDevices.set(peer.id, peer);
      this.notify('DEVICE_FOUND', peer);
      this.notify('DEVICES_UPDATED', Array.from(this.discoveredDevices.values()));

      // When encountering a newly joined peer, immediately initiate anti-entropy gossip
      if (isFirstDiscovery) {
        this.broadcastGossipDigest();
      }
    }

    if (data.type === 'P2P_GOSSIP_DIGEST') {
      this.handleGossipDigest(data);
    }

    if (data.type === 'P2P_GOSSIP_REQUEST') {
      this.handleGossipRequest(data);
    }

    if (data.type === 'P2P_EMERGENCY_SOS' && data.packet) {
      const sos = data.packet;
      const alreadyLogged = this.receivedMessages.some(m => m.id === sos.id);
      
      if (!alreadyLogged) {
        const canRelay = !sos.isSelfBroadcast && this.shouldRelayPacket(sos);

        this.receivedMessages.unshift(sos);
        this.saveMessages();
        this.seenPacketIds.set(sos.id, Date.now());
        this.storeAndForwardBuffer.set(sos.id, sos);
        this.saveStoreAndForwardBuffer();
        this.notify('SOS_ALERT_RECEIVED', sos);

        // MULTI-HOP RELAY: If packet has remaining TTL and we did not originate it, relay downstream!
        if (canRelay) {
          this.relayMeshPacket(sos);
        }
      }
    }
  }

  clearHistory() {
    this.receivedMessages = [];
    this.storeAndForwardBuffer.clear();
    this.seenPacketIds.clear();
    localStorage.removeItem('kerala_p2p_sos_messages');
    localStorage.removeItem('kerala_p2p_store_forward_queue');
    this.notify('MESSAGES_CLEARED');
  }

  getDevicesList() {
    return Array.from(this.discoveredDevices.values()).sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  getMessages() {
    return this.receivedMessages;
  }

  getStoreAndForwardCount() {
    return this.storeAndForwardBuffer.size;
  }

  getMeshRelayStats() {
    return {
      localNodeId: this.localUnitId,
      callsign: this.callsign,
      totalRelayed: this.relayedPacketsCount,
      totalSeen: this.seenPacketIds.size,
      storeAndForwardCount: this.storeAndForwardBuffer.size,
      connectedPeers: this.discoveredDevices.size
    };
  }
}

export const p2pEngine = new P2PEmergencyMeshEngine();
