import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, addIncidentLocal, updateIncidentStatusLocal, addBlockageLocal, removeBlockageLocal, updateResponderLocal, logVisitorAudit, getVisitorAudits } from './db';
import mapData from './mapData.json';
import { solveDijkstra, findClosestNode, findClosestEdge, getPositionAtDistance, getRouteLength, haversineDistance } from './routing';
import confetti from 'canvas-confetti';
import { 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  PlusCircle,
  Info, 
  MapPin, 
  TrendingUp, 
  Navigation, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Flame,
  Activity,
  Droplet,
  Trash2,
  Play,
  Square,
  Compass,
  Locate,
  Bus,
  Footprints,
  Car
} from 'lucide-react';

const INITIAL_RESPONDERS = [
  { id: 'resp_1', name: 'Ambulance Alpha', type: 'medical', lat: 8.5241, lng: 76.9366, status: 'idle', speed: 90 },
  { id: 'resp_2', name: 'Fire Engine Beta', type: 'fire_engine', lat: 9.9312, lng: 76.2673, status: 'idle', speed: 80 },
  { id: 'resp_3', name: 'Rescue Boat Gamma', type: 'rescue_boat', lat: 11.2588, lng: 75.7804, status: 'idle', speed: 60 }
];

const getResponderEmoji = (type) => {
  if (type === 'medical') return '🚑';
  if (type === 'fire_engine') return '🚒';
  if (type === 'rescue_boat') return '🛥️';
  return '🚨';
};

export default function App() {
  // App connection state
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueueLength, setSyncQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([
    '[SYSTEM] System initialized. Ready for emergency dispatch.',
    '[SYSTEM] Kerala road network graph loaded (NH 544, MC Road, Local connections).'
  ]);

  // Data States
  const [incidents, setIncidents] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [responders, setResponders] = useState([]);
  
  // Tactical Route Planner States (Custom routing)
  const [selectedStartNode, setSelectedStartNode] = useState('vadakkencherry'); // Default Start
  const [selectedEndNode, setSelectedEndNode] = useState('valliyode'); // Default End
  const [customRoute, setCustomRoute] = useState(null);
  const [meansOfTransport, setMeansOfTransport] = useState('car'); // car, bus, walk
  const [matchingBusLines, setMatchingBusLines] = useState([]);

  // Selection States for Dispatches
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [dispatchRoute, setDispatchRoute] = useState(null);

  // Manual Form States
  const [newIncidentType, setNewIncidentType] = useState('fire');
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [mapClickCoords, setMapClickCoords] = useState(null);
  const [proofImage, setProofImage] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);

  const handleProofUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result);
      setProofPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const [newIncidentDistrict, setNewIncidentDistrict] = useState('tvm');

  // Visitor Access & IP Diagnostics States
  const [visitorIp, setVisitorIp] = useState('');
  const [visitorOs, setVisitorOs] = useState('');
  const [visitorBrowser, setVisitorBrowser] = useState('');
  const [visitorDevice, setVisitorDevice] = useState('');
  const [visitorLogs, setVisitorLogs] = useState([]);
  
  // Admin Authentication States
  const [adminUser, setAdminUser] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUser === 'tryonce' && adminPassword === 'daretoenter') {
      setIsAdminAuthenticated(true);
      setLoginError('');
      logMessage('[SYSTEM] Admin console unlocked. Audit logs active.', 'success');
    } else {
      setLoginError('Authentication Failed: Invalid ID or Password');
      logMessage('[SECURITY] Unauthorized terminal access attempt.', 'error');
    }
  };
  
  // Geolocation states
  const [visitorLat, setVisitorLat] = useState(null);
  const [visitorLng, setVisitorLng] = useState(null);
  const [visitorCity, setVisitorCity] = useState('');
  const [visitorRegion, setVisitorRegion] = useState('');
  const [visitorIsp, setVisitorIsp] = useState('');

  // DISCORD WEBHOOK URL - Paste your Webhook link here to get instant mobile/desktop notifications!
  const DISCORD_WEBHOOK_URL = ""; 

  // Send formatted Embed notification to Discord Webhook
  const sendDiscordNotification = async (ip, city, region, country, isp, deviceDetails) => {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: "🌐 Admin Terminal Access Event",
            description: "A visitor has loaded the Kerala Emergency Navigation system.",
            color: 11032311, // Pulsing Purple hex color
            fields: [
              { name: "IP Address", value: `${ip}`, inline: true },
              { name: "Provider/ISP", value: `${isp}`, inline: true },
              { name: "Physical Location", value: `${city}, ${region}, ${country}`, inline: false },
              { name: "Operating System", value: deviceDetails.os, inline: true },
              { name: "Browser Engine", value: deviceDetails.browser, inline: true },
              { name: "Device Type", value: deviceDetails.device, inline: true }
            ],
            footer: { text: "Tactical Dispatch Dashboard Access Audit Logs" },
            timestamp: new Date().toISOString()
          }]
        })
      });
      console.log("Discord access alert successfully delivered!");
    } catch (err) {
      console.error("Failed to post Discord alert:", err);
    }
  };

  // Send AJAX email notification via FormSubmit
  const sendEmailNotification = async (ip, city, region, country, isp, deviceDetails) => {
    try {
      await fetch("https://formsubmit.co/ajax/d5f061be2ea307f52c8e19fbdeee7c75", {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          "_subject": `🚨 Terminal Access Alert: ${ip}`,
          "Event": "New Visitor Session Registered",
          "IP Address": ip,
          "Location": `${city}, ${region}, ${country}`,
          "Network Provider (ISP)": isp,
          "Operating System": deviceDetails.os,
          "Browser Client": deviceDetails.browser,
          "Device Platform": deviceDetails.device,
          "Timestamp": new Date().toLocaleString()
        })
      });
      console.log("Email access alert successfully sent!");
    } catch (err) {
      console.error("Failed to send email alert:", err);
    }
  };

  // Extract Browser and OS details from UserAgent
  const getDeviceDetails = () => {
    const ua = navigator.userAgent;
    let os = "Unknown OS";
    let browser = "Unknown Browser";
    let device = "Desktop";

    if (/windows/i.test(ua)) os = "Windows";
    else if (/macintosh|mac os/i.test(ua)) os = "macOS";
    else if (/android/i.test(ua)) { os = "Android"; device = "Mobile"; }
    else if (/iphone|ipad|ipod/i.test(ua)) { os = "iOS"; device = "Mobile"; }
    else if (/linux/i.test(ua)) os = "Linux";

    if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = "Chrome";
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
    else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
    else if (/edge|edg/i.test(ua)) browser = "Edge";
    else if (/opr/i.test(ua)) browser = "Opera";
    else if (/msie|trident/i.test(ua)) browser = "IE";

    return { os, browser, device };
  };

  // Fetch global visitor audits from serverless KVdb cloud
  const fetchGlobalVisitorAudits = async () => {
    try {
      const response = await fetch('https://kvdb.io/WU7tRgWs3eh9gR77c1ajYi/terminal_audits');
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("Failed to fetch global audits:", err);
      return [];
    }
  };

  // Save global visitor audits to serverless KVdb cloud
  const saveGlobalVisitorAudits = async (auditsList) => {
    try {
      await fetch('https://kvdb.io/WU7tRgWs3eh9gR77c1ajYi/terminal_audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditsList)
      });
    } catch (err) {
      console.error("Failed to save global audits to KVdb:", err);
    }
  };

  // Fetch Public IP and Geolocation details using IPify key
  const fetchIpAndLocation = async () => {
    const apiKey = 'at_dJuXYJm5gfIOnGdUmRV75lSTAP6g7';
    try {
      const response = await fetch(`https://geo.ipify.org/api/v2/country,city?apiKey=${apiKey}`);
      if (!response.ok) throw new Error('Ipify API rejected request');
      const data = await response.json();
      return {
        ip: data.ip,
        city: data.location.city || 'Unknown City',
        region: data.location.region || 'Unknown Region',
        country: data.location.country || 'Unknown Country',
        lat: data.location.lat,
        lng: data.location.lng,
        isp: data.isp || 'Local ISP'
      };
    } catch (err) {
      console.error("IPify Geo API failed, running public fallback:", err);
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return {
          ip: data.ip,
          city: 'Local Loopback',
          region: 'Kerala',
          country: 'IN',
          lat: 10.8505,
          lng: 76.2711,
          isp: 'Local ISP'
        };
      } catch (err2) {
        return {
          ip: '127.0.0.1 (Localhost)',
          city: 'Offline Loop',
          region: 'Kerala',
          country: 'IN',
          lat: 10.8505,
          lng: 76.2711,
          isp: 'Offline System'
        };
      }
    }
  };

  // Initialize client audit logs on mount
  useEffect(() => {
    const runAudit = async () => {
      const deviceDetails = getDeviceDetails();
      setVisitorOs(deviceDetails.os);
      setVisitorBrowser(deviceDetails.browser);
      setVisitorDevice(deviceDetails.device);

      const geo = await fetchIpAndLocation();
      setVisitorIp(geo.ip);
      setVisitorCity(geo.city);
      setVisitorRegion(geo.region);
      setVisitorIsp(geo.isp);
      setVisitorLat(geo.lat);
      setVisitorLng(geo.lng);

      try {
        await logVisitorAudit({
          ip: geo.ip,
          os: deviceDetails.os,
          browser: deviceDetails.browser,
          device: deviceDetails.device,
          city: geo.city,
          region: geo.region,
          country: geo.country,
          isp: geo.isp,
          lat: geo.lat,
          lng: geo.lng,
          timestamp: Date.now()
        });
        
        logMessage(`[SYSTEM] Access verified: IP ${geo.ip} (${geo.city}, ${geo.region})`, 'system');
        
        // Trigger Webhook Notification
        await sendDiscordNotification(geo.ip, geo.city, geo.region, geo.country, geo.isp, deviceDetails);
        
        // Trigger Email Notification
        await sendEmailNotification(geo.ip, geo.city, geo.region, geo.country, geo.isp, deviceDetails);

        const logs = await getVisitorAudits();
        setVisitorLogs(logs);
      } catch (err) {
        console.error("Failed to log terminal audit:", err);
      }
    };
    runAudit();
  }, []);

  // Geolocation / Live Navigation States
  const [gpsActive, setGpsActive] = useState(false);
  const [instructionBannerVisible, setInstructionBannerVisible] = useState(true);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsHeading, setGpsHeading] = useState(0);
  const [bindGpsToUnit, setBindGpsToUnit] = useState(false);
  const [mockGpsMode, setMockGpsMode] = useState(false);

  // Map Refs & Layers
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const roadsLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const incidentMarkersRef = useRef(new Map());
  const blockageMarkersRef = useRef(new Map());
  const responderMarkersRef = useRef(new Map());
  const customSimulationMarkerRef = useRef(null);
  const cityMarkersRef = useRef([]);
  const gpsMarkerRef = useRef(null);
  const terminalMarkersRef = useRef(new Map());
  const busMarkersRef = useRef(new Map());
  const shelterMarkersRef = useRef(new Map());

  // Evacuation Shelters State
  const [shelters, setShelters] = useState([
    { id: 'shelter_1', name: 'Thrissur Town Hall Camp', lat: 10.5310, lng: 76.2200, capacity: 250, occupancy: 145, resources: 'Food: High | Meds: Medium', district: 'thrissur' },
    { id: 'shelter_2', name: 'Palakkad Victoria College Camp', lat: 10.7920, lng: 76.6590, capacity: 300, occupancy: 88, resources: 'Food: High | Meds: High', district: 'palakkad' },
    { id: 'shelter_3', name: 'Alappuzha SD College Center', lat: 9.4780, lng: 76.3450, capacity: 200, occupancy: 185, resources: 'Food: Low | Meds: Low', district: 'alappuzha' },
    { id: 'shelter_4', name: 'Wayanad Kalpetta School Camp', lat: 11.6080, lng: 76.0880, capacity: 150, occupancy: 42, resources: 'Food: Medium | Meds: High', district: 'wayanad' }
  ]);

  // Simulated Buses States (Bustle Live Tracker)
  const [trackedBusId, setTrackedBusId] = useState(null);
  const [simulatedBuses, setSimulatedBuses] = useState([
    {
      id: 'sim_bus_1',
      name: 'Kairali Travels (KL 09 A 2021)',
      vehicleNumber: 'KL 09 A 2021',
      nodeSequence: ['vadakkencherry', 'valliyode', 'alathur'],
      route: 'Vadakkencherry - Valliyode - Alathur',
      speed: 45,
      type: 'Private Ordinary',
      currentSegmentIndex: 0,
      segmentProgress: 0.1,
      lat: 10.5954,
      lng: 76.4714,
      heading: 0,
      status: 'En Route',
      stopDuration: 0,
      color: '#fbbf24' // Yellow
    },
    {
      id: 'sim_bus_2',
      name: 'KSRTC SWIFT Super Fast (KL 15 A 8901)',
      vehicleNumber: 'KL 15 A 8901',
      nodeSequence: ['tvm', 'kollam', 'alappuzha', 'kochi'],
      route: 'Thiruvananthapuram - Kollam - Alappuzha - Kochi',
      speed: 65,
      type: 'KSRTC SWIFT Super Fast',
      currentSegmentIndex: 0,
      segmentProgress: 0.4,
      lat: 8.5241,
      lng: 76.9366,
      heading: 0,
      status: 'En Route',
      stopDuration: 0,
      color: '#38bdf8' // Blue
    },
    {
      id: 'sim_bus_3',
      name: 'Jayasree Private (KL 47 C 2700)',
      vehicleNumber: 'KL 47 C 2700',
      nodeSequence: ['kochi', 'thrissur', 'vadakkencherry', 'alathur', 'palakkad'],
      route: 'Kochi - Thrissur - Vadakkencherry - Alathur - Palakkad',
      speed: 55,
      type: 'Private Limited Stop',
      currentSegmentIndex: 1,
      segmentProgress: 0.2,
      lat: 10.5276,
      lng: 76.2144,
      heading: 0,
      status: 'En Route',
      stopDuration: 0,
      color: '#10b981' // Green
    },
    {
      id: 'sim_bus_4',
      name: 'Malabar Travels (KL 11 T 5599)',
      vehicleNumber: 'KL 11 T 5599',
      nodeSequence: ['kozhibode', 'wayanad', 'kannur'],
      route: 'Kozhikode - Wayanad - Kannur',
      speed: 48,
      type: 'Private Ordinary',
      currentSegmentIndex: 0,
      segmentProgress: 0.6,
      lat: 11.2588,
      lng: 75.7804,
      heading: 0,
      status: 'En Route',
      stopDuration: 0,
      color: '#ec4899' // Pink
    }
  ]);

  // Simulation State
  const [simulationActive, setSimulationActive] = useState(false);
  const [simTransport, setSimTransport] = useState('car'); // car, bus, walk
  const [simulationProgress, setSimulationProgress] = useState(0); // km traveled
  const [currentBusStopName, setCurrentBusStopName] = useState('');
  const simTimerRef = useRef(null);
  
  const watchIdRef = useRef(null);
  
  // Google Maps Style Live Navigation States
  const [activeTab, setActiveTab] = useState('planner'); // planner, bustle, alerts, shelters, sync
  const [isNavigating, setIsNavigating] = useState(false);
  const [nextInstruction, setNextInstruction] = useState("Head toward destination");
  const [nextTurnIcon, setNextTurnIcon] = useState("straight"); // left, right, straight, arrive
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const lastSpokenInstructionRef = useRef("");
  

  // 1. Initial Load and DB Seed
  useEffect(() => {
    const initDbAndData = async () => {
      try {
        const existingResponders = await db.responders.toArray();
        if (existingResponders.length === 0) {
          for (const r of INITIAL_RESPONDERS) {
            await db.responders.add(r);
          }
        }
        await reloadLocalData();
      } catch (err) {
        console.error("Failed to initialize database:", err);
      }
    };

    initDbAndData();
    
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // 1b. Draw active Admin Terminal markers for all connected sessions on Leaflet map
  useEffect(() => {
    if (!mapRef.current || visitorLogs.length === 0) return;
    
    // Clear removed terminal markers
    terminalMarkersRef.current.forEach((marker, ipKey) => {
      if (!visitorLogs.some(log => `${log.ip}_${log.timestamp}` === ipKey)) {
        marker.remove();
        terminalMarkersRef.current.delete(ipKey);
      }
    });

    // Plot/Update terminal markers
    visitorLogs.forEach(log => {
      if (!log.lat || !log.lng) return;
      const ipKey = `${log.ip}_${log.timestamp}`;

      const terminalIcon = L.divIcon({
        className: 'custom-terminal-icon',
        html: `
          <div style="position: relative; width: 32px; height: 32px;">
            <div class="radar-ripple" style="color: #a855f7;"></div>
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              background: rgba(15, 23, 42, 0.9);
              border: 2px solid #a855f7;
              border-radius: 50%;
              box-shadow: 0 0 10px #a855f7;
              z-index: 2;
            ">
              💻
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      if (terminalMarkersRef.current.has(ipKey)) {
        // Marker already plotted
      } else {
        const m = L.marker([log.lat, log.lng], { icon: terminalIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="color: #f3f4f6; font-family: sans-serif; min-width: 160px;">
              <h4 style="margin: 0 0 4px; color: #a855f7; text-transform: uppercase; font-size: 10px; font-weight: 800;">Active Terminal Session</h4>
              <p style="margin: 0; font-size: 10px; color: #9ca3af;">IP: <strong>${log.ip}</strong></p>
              <p style="margin: 2px 0 0; font-size: 10px; color: #9ca3af;">City: <strong>${log.city || 'Unknown'}, ${log.region || 'Region'}</strong></p>
              <p style="margin: 2px 0 0; font-size: 10px; color: #9ca3af;">ISP: <strong>${log.isp || 'Network'}</strong></p>
              <p style="margin: 2px 0 0; font-size: 10px; color: #9ca3af;">Client: <strong>${log.os} (${log.browser})</strong></p>
            </div>
          `);
        terminalMarkersRef.current.set(ipKey, m);
      }
    });
  }, [visitorLogs, mapRef.current]);

  const reloadLocalData = async () => {
    const listIncidents = await db.incidents.toArray();
    const listBlockages = await db.blockages.toArray();
    const listResponders = await db.responders.toArray();
    const queue = await db.syncQueue.toArray();

    listIncidents.sort((a, b) => b.reportedAt - a.reportedAt);

    setIncidents(listIncidents);
    setBlockages(listBlockages);
    setResponders(listResponders);
    setSyncQueueLength(queue.length);
  };

  const logMessage = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  };

  // Helper to interpolate coordinates along geometry
  const interpolateCoordinates = (geometry, progress) => {
    if (!geometry || geometry.length === 0) return { lat: 0, lng: 0, heading: 0 };
    if (geometry.length === 1) return { lat: geometry[0][0], lng: geometry[0][1], heading: 0 };
    
    const totalPoints = geometry.length;
    const subSegments = totalPoints - 1;
    const rawIndex = progress * subSegments;
    const segmentIdx = Math.min(subSegments - 1, Math.floor(rawIndex));
    const segmentProg = rawIndex - segmentIdx;

    const p1 = geometry[segmentIdx];
    const p2 = geometry[segmentIdx + 1];

    const lat = p1[0] + (p2[0] - p1[0]) * segmentProg;
    const lng = p1[1] + (p2[1] - p1[1]) * segmentProg;

    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = (90 - angle + 360) % 360;

    return { lat, lng, heading: angle };
  };

  // Live Bus Tracker simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedBuses(prevBuses => {
        return prevBuses.map(bus => {
          let { currentSegmentIndex, segmentProgress, status, stopDuration, nodeSequence } = bus;

          if (status === 'Stopped') {
            if (stopDuration > 0) {
              return { ...bus, stopDuration: stopDuration - 1 };
            } else {
              status = 'En Route';
              currentSegmentIndex = currentSegmentIndex + 1;
              if (currentSegmentIndex >= nodeSequence.length - 1) {
                currentSegmentIndex = 0;
              }
              segmentProgress = 0;
            }
          } else {
            const step = bus.speed / 1800; // Speed step
            segmentProgress += step;
            if (segmentProgress >= 1) {
              segmentProgress = 1;
              status = 'Stopped';
              stopDuration = 3; // Pause at stops
            }
          }

          const fromNodeId = nodeSequence[currentSegmentIndex];
          const toNodeId = nodeSequence[currentSegmentIndex + 1];
          if (!fromNodeId || !toNodeId) return bus;

          let edge = mapData.edges.find(e => 
            (e.from === fromNodeId && e.to === toNodeId) || 
            (e.from === toNodeId && e.to === fromNodeId)
          );

          let geom = edge ? edge.geometry : [
            [mapData.nodes[fromNodeId].lat, mapData.nodes[fromNodeId].lng],
            [mapData.nodes[toNodeId].lat, mapData.nodes[toNodeId].lng]
          ];

          if (edge && edge.from === toNodeId) {
            geom = [...geom].reverse();
          }

          const pos = interpolateCoordinates(geom, segmentProgress);

          return {
            ...bus,
            currentSegmentIndex,
            segmentProgress,
            status,
            stopDuration,
            lat: pos.lat,
            lng: pos.lng,
            heading: pos.heading
          };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-pan map on tracked bus if it exits the current view
  useEffect(() => {
    if (trackedBusId && mapRef.current) {
      const bus = simulatedBuses.find(b => b.id === trackedBusId);
      if (bus) {
        const bounds = mapRef.current.getBounds();
        const busLatLng = L.latLng(bus.lat, bus.lng);
        if (!bounds.contains(busLatLng)) {
          mapRef.current.panTo(busLatLng);
        }
      }
    }
  }, [trackedBusId, simulatedBuses]);

  // 2. Leaflet Map Setup
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [10.61, 76.50], // Center around Vadakkencherry / Valliyode Palakkad corridor
        zoom: 12,
        minZoom: 7,
        maxZoom: 15,
        doubleClickZoom: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;
      roadsLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      drawRoadNetwork();
      drawCities();

      // Listen to double-click on map to trigger incident or blockage report
      map.on('dblclick', (e) => {
        handleMapDoubleClick(e.latlng.lat, e.latlng.lng);
      });

      // Listen to single click for Mock GPS placement
      map.on('click', (e) => {
        handleMapSingleClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [blockages]);

  // 3. Draw Road Network
  const drawRoadNetwork = () => {
    if (!mapRef.current || !roadsLayerRef.current) return;
    roadsLayerRef.current.clearLayers();

    mapData.edges.forEach(edge => {
      const isBlocked = blockages.some(b => 
        (b.fromNode === edge.from && b.toNode === edge.to) ||
        (b.fromNode === edge.to && b.toNode === edge.from)
      );

      const color = isBlocked ? '#ef4444' : '#334155';
      const dashArray = isBlocked ? '5, 5' : null;
      const weight = isBlocked ? 4 : 3;
      const opacity = isBlocked ? 0.9 : 0.6;

      const polyline = L.polyline(edge.geometry, {
        color: color,
        weight: weight,
        opacity: opacity,
        dashArray: dashArray
      });

      polyline.bindTooltip(`<strong>${edge.name}</strong><br/>Distance: ${edge.distance} km`, {
        sticky: true,
        className: 'leaflet-road-tooltip'
      });

      polyline.on('click', async (e) => {
        L.DomEvent.stopPropagation(e);
        await toggleRoadBlockage(edge);
      });

      roadsLayerRef.current.addLayer(polyline);
    });
  };

  // 4. Draw City Markers
  const drawCities = () => {
    if (!mapRef.current) return;
    
    cityMarkersRef.current.forEach(m => m.remove());
    cityMarkersRef.current = [];

    Object.keys(mapData.nodes).forEach(nodeId => {
      const node = mapData.nodes[nodeId];
      if (node.type === 'city' && node.name) {
        const cityIcon = L.divIcon({
          className: 'custom-city-icon',
          html: `
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 8px; height: 8px; background: white; border: 2px solid #0f172a; border-radius: 50%;"></div>
              <div style="
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid rgba(255,255,255,0.1);
                color: #f3f4f6;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                margin-top: 2px;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
              ">${node.name}</div>
            </div>
          `,
          iconSize: [60, 30],
          iconAnchor: [30, 4]
        });

        const marker = L.marker([node.lat, node.lng], { icon: cityIcon, interactive: false }).addTo(mapRef.current);
        cityMarkersRef.current.push(marker);
      }
    });
  };

  // 5. Update Incident Markers
  useEffect(() => {
    if (!mapRef.current) return;

    incidentMarkersRef.current.forEach((marker, id) => {
      if (!incidents.some(inc => inc.id === id)) {
        marker.remove();
        incidentMarkersRef.current.delete(id);
      }
    });

    incidents.forEach(inc => {
      if (inc.status === 'resolved') {
        if (incidentMarkersRef.current.has(inc.id)) {
          incidentMarkersRef.current.get(inc.id).remove();
          incidentMarkersRef.current.delete(inc.id);
        }
        return;
      }

      let color = '#ef4444';
      let emoji = '🔥';
      if (inc.type === 'medical') { color = '#38bdf8'; emoji = '🩺'; }
      if (inc.type === 'flood') { color = '#3b82f6'; emoji = '🌊'; }

      const iconHtml = `
        <div style="position: relative; width: 32px; height: 32px;">
          <div class="radar-ripple" style="color: ${color};"></div>
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            background: rgba(15, 23, 42, 0.85);
            border: 2px solid ${color};
            border-radius: 50%;
            box-shadow: 0 0 10px ${color};
            z-index: 2;
          ">
            ${emoji}
          </div>
        </div>
      `;

      const divIcon = L.divIcon({
        className: 'custom-div-icon',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupHtml = `
        <div style="color: #f3f4f6; font-family: sans-serif; min-width: 150px;">
          <h4 style="margin: 0 0 4px; color: ${color}; text-transform: uppercase;">${inc.type} Incident</h4>
          <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af;">${inc.description}</p>
          <div style="font-size: 11px; margin-bottom: 8px;">Status: <span style="font-weight:bold; color:${color}">${inc.status}</span></div>
          <button id="pop-dispatch-${inc.id}" style="
            background: ${color}; 
            color: white; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-weight: bold;
            font-size: 11px;
            cursor: pointer;
            width: 100%;
            margin-bottom: 4px;
          ">Dispatch Responder</button>
          <button id="pop-delete-${inc.id}" style="
            background: rgba(239, 68, 68, 0.1); 
            color: #ef4444; 
            border: 1px solid rgba(239, 68, 68, 0.3); 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-weight: bold;
            font-size: 11px;
            cursor: pointer;
            width: 100%;
          ">Dismiss Fake Alert</button>
        </div>
      `;

      let m;
      if (incidentMarkersRef.current.has(inc.id)) {
        m = incidentMarkersRef.current.get(inc.id);
        m.setLatLng([inc.lat, inc.lng]);
        m.setIcon(divIcon);
        m.bindPopup(popupHtml);
      } else {
        m = L.marker([inc.lat, inc.lng], { icon: divIcon })
          .addTo(mapRef.current)
          .bindPopup(popupHtml);

        m.on('click', () => {
          setSelectedIncident(inc);
        });

        incidentMarkersRef.current.set(inc.id, m);
      }

      m.off('popupopen');
      m.on('popupopen', () => {
        const btn = document.getElementById(`pop-dispatch-${inc.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedIncident(inc);
            mapRef.current?.closePopup();
          };
        }
        const delBtn = document.getElementById(`pop-delete-${inc.id}`);
        if (delBtn) {
          delBtn.onclick = () => {
            deleteIncident(inc.id);
            mapRef.current?.closePopup();
          };
        }
      });
    });
  }, [incidents]);

  // 6. Update Road Blockage Markers
  useEffect(() => {
    if (!mapRef.current) return;

    blockageMarkersRef.current.forEach((marker, id) => {
      if (!blockages.some(b => b.id === id)) {
        marker.remove();
        blockageMarkersRef.current.delete(id);
      }
    });

    blockages.forEach(b => {
      const blockageIcon = L.divIcon({
        className: 'custom-blockage-icon',
        html: `
          <div style="
            font-size: 14px;
            background: rgba(239, 68, 68, 0.25);
            border: 1.5px solid #ef4444;
            border-radius: 4px;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #ef4444;
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
          ">
            ⚠️
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      if (blockageMarkersRef.current.has(b.id)) {
        blockageMarkersRef.current.get(b.id).setLatLng([b.lat, b.lng]);
      } else {
        const m = L.marker([b.lat, b.lng], { icon: blockageIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="color: #f3f4f6; font-family: sans-serif;">
              <h4 style="margin: 0 0 4px; color: #ef4444;">Road Blockage</h4>
              <p style="margin: 0 0 8px; font-size: 11px;">Road segment: <strong>${b.name}</strong></p>
              <button id="pop-clear-block-${b.id}" style="
                background: #475569; 
                color: white; 
                border: none; 
                padding: 4px 8px; 
                border-radius: 4px; 
                font-weight: bold;
                font-size: 11px;
                cursor: pointer;
                width: 100%;
              ">Clear Blockage</button>
            </div>
          `);

        m.on('popupopen', () => {
          const btn = document.getElementById(`pop-clear-block-${b.id}`);
          if (btn) {
            btn.onclick = async () => {
              await removeBlockage(b.id);
              mapRef.current?.closePopup();
            };
          }
        });

        blockageMarkersRef.current.set(b.id, m);
      }
    });
  }, [blockages]);

  // 7. Update Responder Markers
  useEffect(() => {
    if (!mapRef.current) return;

    responderMarkersRef.current.forEach((marker, id) => {
      if (!responders.some(r => r.id === id)) {
        marker.remove();
        responderMarkersRef.current.delete(id);
      }
    });

    responders.forEach(r => {
      const emoji = getResponderEmoji(r.type);
      const isSelected = selectedResponder && selectedResponder.id === r.id;
      const border = isSelected ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)';
      const scale = isSelected ? 1.25 : 1.0;
      const glow = isSelected ? '0 0 12px #38bdf8' : '0 2px 6px rgba(0,0,0,0.5)';
      const rotation = r.heading || 0;

      const divIcon = L.divIcon({
        className: 'custom-responder-icon',
        html: `
          <div style="
            transform: rotate(${rotation}deg) scale(${scale});
            transition: transform 0.1s linear, scale 0.2s ease;
            font-size: 24px;
            width: 38px;
            height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(15, 23, 42, 0.9);
            border: ${border};
            border-radius: 50%;
            box-shadow: ${glow};
          ">
            ${emoji}
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      if (responderMarkersRef.current.has(r.id)) {
        const m = responderMarkersRef.current.get(r.id);
        m.setLatLng([r.lat, r.lng]);
        m.setIcon(divIcon);
      } else {
        const m = L.marker([r.lat, r.lng], { icon: divIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="color: #f3f4f6; font-family: sans-serif;">
              <h4 style="margin: 0 0 2px; color: #38bdf8;">${r.name}</h4>
              <p style="margin: 0 0 6px; font-size: 11px; color: #9ca3af;">Type: ${r.type} | Speed: ${r.speed} km/h</p>
              <div style="font-size: 11px; margin-bottom: 6px;">Status: <span style="font-weight:bold; color:#4ade80">${r.status}</span></div>
              <button id="pop-select-resp-${r.id}" style="
                background: #38bdf8; 
                color: #0b0f19; 
                border: none; 
                padding: 4px 8px; 
                border-radius: 4px; 
                font-weight: bold;
                font-size: 11px;
                cursor: pointer;
                width: 100%;
              ">Select Unit</button>
            </div>
          `);

        m.on('popupopen', () => {
          const btn = document.getElementById(`pop-select-resp-${r.id}`);
          if (btn) {
            btn.onclick = () => {
              setSelectedResponder(r);
              mapRef.current?.closePopup();
            };
          }
        });

        responderMarkersRef.current.set(r.id, m);
      }
    });
  }, [responders, selectedResponder]);

  // Update Simulated Bus Markers (Live Bus Tracker)
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove any markers that are no longer in simulatedBuses
    busMarkersRef.current.forEach((marker, id) => {
      if (!simulatedBuses.some(b => b.id === id)) {
        marker.remove();
        busMarkersRef.current.delete(id);
      }
    });

    // Draw/Update markers
    simulatedBuses.forEach(bus => {
      const isTracked = trackedBusId === bus.id;
      const ringGlow = isTracked ? '0 0 14px #f43f5e' : '0 2px 5px rgba(0,0,0,0.5)';
      const border = isTracked ? '2.5px solid #f43f5e' : `1.5px solid ${bus.color}`;
      const scale = isTracked ? 1.2 : 1.0;
      
      const busIcon = L.divIcon({
        className: 'custom-bus-icon-wrapper',
        html: `
          <div class="bus-simulation-marker ${isTracked ? 'tracked-active' : ''}" style="
            transform: rotate(${bus.heading}deg) scale(${scale});
            border: ${border};
            box-shadow: ${ringGlow};
            transition: transform 0.2s linear;
          ">
            <span class="bus-icon-text">🚌</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      if (busMarkersRef.current.has(bus.id)) {
        const m = busMarkersRef.current.get(bus.id);
        m.setLatLng([bus.lat, bus.lng]);
        m.setIcon(busIcon);
      } else {
        const m = L.marker([bus.lat, bus.lng], { icon: busIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="color: #f3f4f6; font-family: sans-serif; font-size: 11px;">
              <h4 style="margin: 0 0 4px; color: #fbbf24;">${bus.name}</h4>
              <p style="margin: 0 0 4px;">Route: <strong>${bus.route}</strong></p>
              <p style="margin: 0 0 8px;">Status: <strong style="color: ${bus.status === 'Stopped' ? '#fbbf24' : '#4ade80'};">${bus.status === 'Stopped' ? 'Stopped at Depot' : `En Route (${bus.speed} km/h)`}</strong></p>
              <button id="track-bus-btn-${bus.id}" style="
                background: #f43f5e;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
              ">Track Live Position</button>
            </div>
          `);

        m.on('popupopen', () => {
          const btn = document.getElementById(`track-bus-btn-${bus.id}`);
          if (btn) {
            btn.onclick = () => {
              setTrackedBusId(bus.id);
              logMessage(`Tracking active for ${bus.name}`, 'info');
              if (mapRef.current) {
                mapRef.current.setView([bus.lat, bus.lng], 12);
              }
              mapRef.current?.closePopup();
            };
          }
        });

        m.on('click', () => {
          setTrackedBusId(bus.id);
        });

        busMarkersRef.current.set(bus.id, m);
      }
    });
  }, [simulatedBuses, trackedBusId]);

  // Update Shelter Markers
  useEffect(() => {
    if (!mapRef.current) return;

    shelters.forEach(sh => {
      const isFull = sh.occupancy >= sh.capacity * 0.9;
      const ringColor = isFull ? '#ef4444' : '#10b981';
      const shelterIcon = L.divIcon({
        className: 'custom-shelter-icon',
        html: `
          <div style="
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            background: rgba(15, 23, 42, 0.9);
            border: 2px solid ${ringColor};
            border-radius: 6px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
          ">
            🏠
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      if (shelterMarkersRef.current.has(sh.id)) {
        shelterMarkersRef.current.get(sh.id).setLatLng([sh.lat, sh.lng]);
      } else {
        const m = L.marker([sh.lat, sh.lng], { icon: shelterIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="color: #f3f4f6; font-family: sans-serif; font-size: 11px; min-width: 160px;">
              <h4 style="margin: 0 0 4px; color: #10b981;">🏠 ${sh.name}</h4>
              <p style="margin: 0 0 3px;">Occupancy: <strong>${sh.occupancy} / ${sh.capacity}</strong> (${Math.round((sh.occupancy / sh.capacity) * 100)}%)</p>
              <p style="margin: 0 0 6px; color: #9ca3af; font-size: 10px;">${sh.resources}</p>
              <button id="route-shelter-btn-${sh.id}" style="
                background: #10b981;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
              ">Route Evacuation Path</button>
            </div>
          `);

        m.on('popupopen', () => {
          const btn = document.getElementById(`route-shelter-btn-${sh.id}`);
          if (btn) {
            btn.onclick = () => {
              const { id: shelterNodeId } = findClosestNode(sh.lat, sh.lng, mapData.nodes);
              if (gpsCoords && gpsActive) {
                const { id: startId } = findClosestNode(gpsCoords.lat, gpsCoords.lng, mapData.nodes);
                setSelectedStartNode(startId);
              }
              setSelectedEndNode(shelterNodeId);
              logMessage(`Evacuation routing active to ${sh.name}`, 'success');
              mapRef.current?.closePopup();
            };
          }
        });

        shelterMarkersRef.current.set(sh.id, m);
      }
    });
  }, [shelters, gpsCoords, gpsActive]);

  // 8. Live GPS tracking markers
  useEffect(() => {
    if (!mapRef.current) return;

    if (gpsActive && gpsCoords) {
      const gpsIcon = L.divIcon({
        className: 'custom-gps-marker',
        html: `
          <div style="position: relative;">
            <div style="
              width: 18px;
              height: 18px;
              background-color: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 10px #3b82f6;
            "></div>
            <div style="
              position: absolute;
              top: -11px;
              left: -11px;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 2px solid rgba(59, 130, 246, 0.4);
              animation: gps-pulse 1.8s infinite;
              pointer-events: none;
            "></div>
            ${gpsHeading ? `
              <div style="
                position: absolute;
                top: -5px;
                left: 7px;
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-bottom: 10px solid #3b82f6;
                transform: rotate(${gpsHeading}deg);
                transform-origin: 50% 120%;
              "></div>
            ` : ''}
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      if (gpsMarkerRef.current) {
        gpsMarkerRef.current.setLatLng([gpsCoords.lat, gpsCoords.lng]);
        gpsMarkerRef.current.setIcon(gpsIcon);
      } else {
        gpsMarkerRef.current = L.marker([gpsCoords.lat, gpsCoords.lng], { icon: gpsIcon, zIndexOffset: 1000 })
          .addTo(mapRef.current)
          .bindTooltip("Live GPS", { permanent: false, direction: 'top' });
        mapRef.current.setView([gpsCoords.lat, gpsCoords.lng], 12);
      }
    } else {
      if (gpsMarkerRef.current) {
        gpsMarkerRef.current.remove();
        gpsMarkerRef.current = null;
      }
    }
  }, [gpsActive, gpsCoords, gpsHeading]);

  // 9. Handle GPS / Geolocation watch
  const handleGpsToggle = () => {
    if (gpsActive) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      setGpsCoords(null);
      setBindGpsToUnit(false);
      logMessage('[GPS] Live GPS tracking deactivated.', 'info');
    } else {
      if (!navigator.geolocation) {
        logMessage('[GPS] Error: Geolocation is not supported by your browser.', 'error');
        return;
      }

      logMessage('[GPS] Requesting device GPS coordinates...', 'info');

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          setGpsCoords({ lat: latitude, lng: longitude });
          setGpsActive(true);
          setMockGpsMode(false);
          if (heading !== null) setGpsHeading(heading);
          
          logMessage(`[GPS] Location update: [${latitude.toFixed(5)}, ${longitude.toFixed(5)}]`, 'system');
        },
        (error) => {
          logMessage(`[GPS] Tracking failed: ${error.message}. Initiating Mock GPS Mode (click map to test).`, 'warning');
          // Start with mock GPS at Vadakkencherry
          setGpsCoords({ lat: 10.5954, lng: 76.4714 });
          setGpsActive(true);
          setMockGpsMode(true);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  
  // Speak navigation instructions when updating
  useEffect(() => {
    if (isNavigating && speechEnabled && nextInstruction && lastSpokenInstructionRef.current !== nextInstruction) {
      lastSpokenInstructionRef.current = nextInstruction;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(nextInstruction);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [isNavigating, speechEnabled, nextInstruction]);

  // Turn bearing calculation utility
  const getNavigationInstruction = (lat, lng, route) => {
    if (!route || !route.geometry || route.geometry.length === 0) {
      return { instruction: "Proceed along the route", icon: "straight" };
    }
    
    const geom = route.geometry;
    let minIdx = 0;
    let minDistance = Infinity;
    for (let i = 0; i < geom.length; i++) {
      const dist = haversineDistance(lat, lng, geom[i][0], geom[i][1]);
      if (dist < minDistance) {
        minDistance = dist;
        minDistance = dist;
        minIdx = i;
      }
    }
    
    const distToEnd = haversineDistance(lat, lng, geom[geom.length - 1][0], geom[geom.length - 1][1]);
    if (distToEnd < 0.15) {
      return { instruction: "You have arrived at your destination.", icon: "arrive" };
    }
    
    const lookAheadIdx = Math.min(geom.length - 1, minIdx + 5);
    if (lookAheadIdx === minIdx) {
      return { instruction: "Continue to your destination.", icon: "straight" };
    }
    
    const { id: closestDestNode } = findClosestNode(geom[geom.length - 1][0], geom[geom.length - 1][1], mapData.nodes);
    const currentDestName = mapData.nodes[closestDestNode]?.name || "Destination";
    
    const pCurrent = geom[minIdx];
    const pNext = geom[Math.min(geom.length - 1, minIdx + 2)];
    const pAfter = geom[Math.min(geom.length - 1, minIdx + 6)];
    
    const bearing1 = getHeading(pCurrent, pNext);
    const bearing2 = getHeading(pNext, pAfter);
    let diff = bearing2 - bearing1;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    
    let icon = "straight";
    let action = "Proceed straight";
    
    if (diff < -25) {
      icon = "left";
      action = "Turn left";
    } else if (diff > 25) {
      icon = "right";
      action = "Turn right";
    }
    
    const { id: closestNode } = findClosestNode(pAfter[0], pAfter[1], mapData.nodes);
    const nodeName = mapData.nodes[closestNode]?.name || "";
    
    let instruction = "";
    if (nodeName && nodeName !== currentDestName) {
      instruction = `${action} toward ${nodeName} on your way to ${currentDestName}.`;
    } else {
      instruction = `${action} toward your destination ${currentDestName}.`;
    }
    
    return { instruction, icon };
  };
  
  // 9b. Geonavigation Route Deviation & Auto-Rerouting
  useEffect(() => {
    if (!gpsCoords || !gpsActive) {
      if (isNavigating) setIsNavigating(false);
      return;
    }
    
    // Google Maps Lock view & update instruction
    if (isNavigating) {
      mapRef.current?.setView([gpsCoords.lat, gpsCoords.lng], 16);
      const activeRoute = customRoute || dispatchRoute;
      const { instruction, icon } = getNavigationInstruction(gpsCoords.lat, gpsCoords.lng, activeRoute);
      setNextInstruction(instruction);
      setNextTurnIcon(icon);
    }
    
    // Snap the bound responder unit to the current GPS coordinates
    if (bindGpsToUnit && selectedResponder) {
      updateResponderLocal(selectedResponder.id, {
        lat: parseFloat(gpsCoords.lat.toFixed(5)),
        lng: parseFloat(gpsCoords.lng.toFixed(5)),
        heading: gpsHeading
      }).then(() => reloadLocalData());
    }
    

    // 1. Tactical Route deviation check
    if (customRoute && customRoute.geometry) {
      let minDistance = Infinity;
      customRoute.geometry.forEach(pt => {
        const dist = haversineDistance(gpsCoords.lat, gpsCoords.lng, pt[0], pt[1]);
        if (dist < minDistance) minDistance = dist;
      });

      // If user drifts > 250 meters off the active route line
      if (minDistance > 0.25) {
        const { id: newStartId } = findClosestNode(gpsCoords.lat, gpsCoords.lng, mapData.nodes);
        if (newStartId && newStartId !== selectedStartNode) {
          logMessage(`[NAV-TACTICAL] Deviation: ${minDistance.toFixed(2)} km off-route. Auto-redirecting starting node to ${mapData.nodes[newStartId]?.name || newStartId}...`, 'warning');
          setSelectedStartNode(newStartId);
          
          confetti({
            particleCount: 25,
            spread: 50,
            origin: { y: 0.85, x: 0.85 },
            colors: ['#fbbf24', '#f59e0b']
          });
        }
      }
    }

    // 2. Dispatch Route deviation check
    if (dispatchRoute && dispatchRoute.geometry && bindGpsToUnit) {
      let minDistance = Infinity;
      dispatchRoute.geometry.forEach(pt => {
        const dist = haversineDistance(gpsCoords.lat, gpsCoords.lng, pt[0], pt[1]);
        if (dist < minDistance) minDistance = dist;
      });

      // If emergency unit drifts > 250 meters off the dispatch line
      if (minDistance > 0.25) {
        logMessage(`[NAV-DISPATCH] Deviation: ${minDistance.toFixed(2)} km off-course. Recalculating path to incident...`, 'warning');
      }
    }
  }, [gpsCoords, gpsActive, customRoute, dispatchRoute, bindGpsToUnit, gpsHeading, selectedResponder]);

  const handleMapDoubleClick = (lat, lng) => {
    const { id: closestNodeId } = findClosestNode(lat, lng, mapData.nodes);
    const closestNode = mapData.nodes[closestNodeId];

    setNewIncidentDesc(`Emergency reported near ${closestNode.name || 'Highway Segment'}`);
    setNewIncidentType('fire');
    setMapClickCoords({ lat, lng });
    setActiveTab('alerts');
    setProofImage(null);
    setProofPreview(null);
    logMessage('[VERIFICATION DRAFT] Plotted incident location. Please upload photo proof to submit report.', 'warning');
  };

  const handleMapSingleClick = async (lat, lng) => {
    if (gpsActive) {
      const heading = gpsCoords ? getHeading([gpsCoords.lat, gpsCoords.lng], [lat, lng]) : 0;
      setGpsCoords({ lat, lng });
      setGpsHeading(heading);
      setMockGpsMode(true);
      logMessage(`[MOCK GPS] Location moved: [${lat.toFixed(5)}, ${lng.toFixed(5)}]`, 'system');

      if (bindGpsToUnit && selectedResponder) {
        await updateResponderLocal(selectedResponder.id, {
          lat: parseFloat(lat.toFixed(5)),
          lng: parseFloat(lng.toFixed(5)),
          heading: heading
        });
        await reloadLocalData();
      }
    }
  };

  // 10. Report Incident
  const deleteIncident = async (id) => {
    try {
      if (selectedIncident && selectedIncident.id === id) {
        setSelectedIncident(null);
      }
      await db.incidents.delete(id);
      logMessage(`[INCIDENT] Incident dismissed/deleted: ${id}`, 'system');
      await reloadLocalData();
    } catch (err) {
      logMessage(`Failed to delete incident: ${err.message}`, 'error');
    }
  };

  const reportIncident = async (type, desc, lat, lng, proof) => {
    // Run AI Triage
    let priority = 'medium';
    let aiRecommendation = 'Dispatch local emergency responder to assess situation.';
    
    const text = (desc || '').toLowerCase();
    if (/fire|smoke|burn|landslide|collapse/i.test(text)) {
      priority = 'critical';
      aiRecommendation = 'CRITICAL: Landslide or Fire hazard. Dispatch Fire Engine Beta immediately.';
    } else if (/heart|injury|accident|bleed|stroke|unconscious/i.test(text)) {
      priority = 'high';
      aiRecommendation = 'HIGH: Medical triage. Dispatch Ambulance Alpha with trauma kits.';
    } else if (/flood|water|drain|drown/i.test(text)) {
      priority = 'high';
      aiRecommendation = 'HIGH: Water hazard. Dispatch Rescue Boat Gamma with flotation vests.';
    } else if (type === 'fire') {
      priority = 'critical';
      aiRecommendation = 'CRITICAL: Fire emergency. Dispatch Fire Engine Beta immediately.';
    } else if (type === 'medical') {
      priority = 'high';
      aiRecommendation = 'HIGH: Medical alert. Dispatch Ambulance Alpha.';
    } else if (type === 'flood') {
      priority = 'high';
      aiRecommendation = 'HIGH: Flood hazard. Dispatch Rescue Boat Gamma.';
    }

    const id = `inc_${Date.now()}`;
    const newInc = {
      id,
      type,
      description: desc || `Reported ${type} emergency`,
      lat: parseFloat(lat.toFixed(5)),
      lng: parseFloat(lng.toFixed(5)),
      status: 'pending',
      reportedAt: Date.now(),
      resolvedAt: null,
      priority,
      aiRecommendation,
      proofImage: proof || null
    };

    try {
      await addIncidentLocal(newInc, isOnline);
      logMessage(`[INCIDENT] Reported ${type.toUpperCase()} emergency at coordinates: [${newInc.lat}, ${newInc.lng}]`, 'warning');
      await reloadLocalData();
    } catch (err) {
      logMessage(`Failed to report incident: ${err.message}`, 'error');
    }
  };

  const handleManualIncidentSubmit = (e) => {
    e.preventDefault();
    if (!proofImage) {
      logMessage('Failed to file report: Photographical proof is required.', 'error');
      return;
    }

    let lat, lng;
    if (mapClickCoords) {
      lat = mapClickCoords.lat;
      lng = mapClickCoords.lng;
    } else {
      const node = mapData.nodes[newIncidentDistrict];
      if (!node) return;
      const offsetLat = (Math.random() - 0.5) * 0.05;
      const offsetLng = (Math.random() - 0.5) * 0.05;
      lat = node.lat + offsetLat;
      lng = node.lng + offsetLng;
    }

    const desc = newIncidentDesc || `${newIncidentType.toUpperCase()} incident`;

    reportIncident(newIncidentType, desc, lat, lng, proofImage);
    
    // Reset Form
    setNewIncidentDesc('');
    setMapClickCoords(null);
    setProofImage(null);
    setProofPreview(null);
  };

  // 11. Toggle Road Blockage
  const toggleRoadBlockage = async (edge) => {
    const existing = blockages.find(b => 
      (b.fromNode === edge.from && b.toNode === edge.to) ||
      (b.fromNode === edge.to && b.toNode === edge.from)
    );

    if (existing) {
      await removeBlockage(existing.id);
    } else {
      const id = `block_${Date.now()}`;
      const midIdx = Math.floor(edge.geometry.length / 2);
      const midCoords = edge.geometry[midIdx] || edge.geometry[0];

      const newBlock = {
        id,
        fromNode: edge.from,
        toNode: edge.to,
        lat: midCoords[0],
        lng: midCoords[1],
        name: edge.name,
        active: 1
      };

      try {
        await addBlockageLocal(newBlock, isOnline);
        logMessage(`[ROAD BLOCKAGE] Placed barrier on ${edge.name}`, 'warning');
        await reloadLocalData();
      } catch (err) {
        logMessage(`Failed to place blockage: ${err.message}`, 'error');
      }
    }
  };

  const removeBlockage = async (id) => {
    try {
      await removeBlockageLocal(id, isOnline);
      logMessage(`[ROAD BLOCKAGE] Barrier cleared`, 'system');
      await reloadLocalData();
    } catch (err) {
      logMessage(`Failed to clear blockage: ${err.message}`, 'error');
    }
  };

  // Helper to trace headings for custom animations
  const getHeading = (p1, p2) => {
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const dLng = (p2[1] - p1[1]) * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  };

  // 12. Solve Routing (Custom/Tactical Planner vs Responder Dispatch)
  const drawRoutePolyline = (geometry) => {
    if (!mapRef.current || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    const glowLine = L.polyline(geometry, {
      color: '#38bdf8',
      weight: 8,
      opacity: 0.3
    });

    const coreLine = L.polyline(geometry, {
      color: '#10b981',
      weight: 4,
      opacity: 0.95,
      className: 'flowing-route-line'
    });

    routeLayerRef.current.addLayer(glowLine);
    routeLayerRef.current.addLayer(coreLine);
  };

  // Dynamic Routing Logic for Tactical Router
  useEffect(() => {
    if (!selectedStartNode || !selectedEndNode) {
      setCustomRoute(null);
      return;
    }

    const result = solveDijkstra(selectedStartNode, selectedEndNode, mapData.nodes, mapData.edges, blockages);
    if (result) {
      setCustomRoute(result);
      
      // If dispatch simulator is not active, render the tactical path
      if (!simulationActive) {
        drawRoutePolyline(result.geometry);
      }

      // Check bus availability along this path
      const buses = getTransitOptionsForPath(result.nodes, result.distance);
      setMatchingBusLines(buses);
    } else {
      setCustomRoute(null);
      setMatchingBusLines([]);
      if (!simulationActive && routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      }
    }
  }, [selectedStartNode, selectedEndNode, blockages, simulationActive]);

  // Dispatch Dispatching Route Solver
  useEffect(() => {
    if (!selectedIncident) {
      setDispatchRoute(null);
      return;
    }

    let startLat, startLng;
    if (bindGpsToUnit && gpsCoords && selectedResponder) {
      startLat = gpsCoords.lat;
      startLng = gpsCoords.lng;
    } else if (selectedResponder) {
      startLat = selectedResponder.lat;
      startLng = selectedResponder.lng;
    } else {
      return;
    }

    const { id: startId } = findClosestNode(startLat, startLng, mapData.nodes);
    const { id: endId } = findClosestNode(selectedIncident.lat, selectedIncident.lng, mapData.nodes);

    const result = solveDijkstra(startId, endId, mapData.nodes, mapData.edges, blockages);
    if (result) {
      setDispatchRoute(result);
      if (!simulationActive) {
        drawRoutePolyline(result.geometry);
      }
    } else {
      setDispatchRoute(null);
      if (!simulationActive && routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      }
    }
  }, [selectedIncident, selectedResponder, gpsCoords, bindGpsToUnit, blockages, simulationActive]);

  // 13. Public Transit Route Matching Algorithm
  const getTransitOptionsForPath = (pathNodes, totalDistance) => {
    if (!pathNodes || pathNodes.length < 2) return [];

    const results = [];
    const startNodeName = mapData.nodes[pathNodes[0]]?.name || 'Start';
    const endNodeName = mapData.nodes[pathNodes[pathNodes.length - 1]]?.name || 'Destination';

    // 1. Direct Bus Search
    (mapData.busLines || []).forEach(bus => {
      const startIndex = bus.nodeSequence.indexOf(pathNodes[0]);
      const endIndex = bus.nodeSequence.indexOf(pathNodes[pathNodes.length - 1]);

      if (startIndex !== -1 && endIndex !== -1) {
        const rate = bus.type.includes('Fast') || bus.type.includes('Express') || bus.type.includes('Limited') ? 2.4 : 1.6;
        const fare = Math.max(15, Math.round(totalDistance * rate));
        const speed = bus.type.includes('Fast') || bus.type.includes('Express') ? 50 : 35; // km/h
        const timeMins = Math.round((totalDistance / speed) * 60) + (bus.type.includes('Ordinary') ? 8 : 3);

        results.push({
          id: bus.id,
          name: bus.name,
          route: bus.route,
          type: bus.type,
          frequency: bus.frequency,
          fare: fare,
          time: `${timeMins} mins`,
          isDirect: true,
          summary: `Direct service from ${startNodeName} to ${endNodeName}`
        });
      }
    });

    // 2. Multi-leg transfer routing!
    if (results.length === 0 && pathNodes.length > 2) {
      const legs = [];
      let totalFare = 0;
      let totalTimeMins = 0;
      let hasAllLegs = true;

      for (let i = 0; i < pathNodes.length - 1; i++) {
        const fromId = pathNodes[i];
        const toId = pathNodes[i+1];
        const fromName = mapData.nodes[fromId]?.name || fromId;
        const toName = mapData.nodes[toId]?.name || toId;

        const edge = mapData.edges.find(e => 
          (e.from === fromId && e.to === toId) || 
          (e.from === toId && e.to === fromId)
        );
        const dist = edge ? edge.distance : 5;

        const legBuses = (mapData.busLines || []).filter(bus => {
          const idx1 = bus.nodeSequence.indexOf(fromId);
          const idx2 = bus.nodeSequence.indexOf(toId);
          return idx1 !== -1 && idx2 !== -1;
        });

        if (legBuses.length > 0) {
          const bestBus = legBuses[0];
          const rate = bestBus.type.includes('Fast') || bestBus.type.includes('Express') ? 2.4 : 1.6;
          const fare = Math.max(15, Math.round(dist * rate));
          const speed = bestBus.type.includes('Fast') || bestBus.type.includes('Express') ? 50 : 35;
          const timeMins = Math.round((dist / speed) * 60) + 4;

          totalFare += fare;
          totalTimeMins += timeMins;

          legs.push({
            from: fromName,
            to: toName,
            busName: bestBus.name,
            fare: fare,
            time: `${timeMins} mins`
          });
        } else {
          hasAllLegs = false;
        }
      }

      if (hasAllLegs && legs.length > 0) {
        results.push({
          id: `transfer_${Date.now()}`,
          name: 'Multi-Bus Transit Route',
          type: 'Transfer Required',
          frequency: 'Varies',
          fare: totalFare,
          time: `${totalTimeMins + (legs.length - 1) * 10} mins`, // 10 min transfer buffers
          isDirect: false,
          legs: legs,
          summary: `Transfer route: ${legs.map(l => l.busName).join(' ➔ ')}`
        });
      }
    }

    return results;
  };

  // Get travel time estimation based on mode
  const getTravelTime = (distance, mode) => {
    if (mode === 'walk') {
      const hrs = distance / 5; // 5 km/h walking speed
      const totalMins = Math.round(hrs * 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m} mins`;
    }
    if (mode === 'bus') {
      // 40 km/h average speed including stop delays
      const hrs = distance / 40;
      const totalMins = Math.round(hrs * 60) + 5; // Add stop buffers
      return `${totalMins} mins`;
    }
    // Emergency Car/Responder (80 km/h)
    const hrs = distance / 85;
    const totalMins = Math.round(hrs * 60);
    return `${totalMins || 1} mins`;
  };

  // Get active route metrics to show in overlay
  const getActiveRouteMetrics = () => {
    const route = simulationActive ? customRoute || dispatchRoute : customRoute || dispatchRoute;
    if (!route) return null;
    return {
      distance: route.distance,
      time: getTravelTime(route.distance, meansOfTransport)
    };
  };

  // 14. Animate Custom / Public Transit Route Traversal Simulation
  const startCustomSimulation = async (mode) => {
    const route = customRoute;
    if (!route) return;

    setSimulationActive(true);
    setSimTransport(mode);
    setSimulationProgress(0);
    setCurrentBusStopName('');
    
    // Choose simulation emoji based on transport mode
    let emoji = '🚗';
    let speed = 90; // km/h
    
    if (mode === 'walk') {
      emoji = '🚶';
      speed = 15; // speed up walking for visual demo (15 km/h)
    } else if (mode === 'bus') {
      emoji = '🚌';
      speed = 60; // km/h
    }

    logMessage(`[SIMULATION] Starting journey from ${mapData.nodes[selectedStartNode].name} to ${mapData.nodes[selectedEndNode].name} via ${mode.toUpperCase()}...`, 'system');

    // Create a temporary simulation marker
    const startCoord = route.geometry[0];
    const simIcon = L.divIcon({
      className: 'custom-simulation-marker',
      html: `<div style="font-size: 26px; transform-origin: center; filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.85));">${emoji}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    customSimulationMarkerRef.current = L.marker([startCoord[0], startCoord[1]], { icon: simIcon, zIndexOffset: 2000 })
      .addTo(mapRef.current);

    const speedKms = speed / 3600;
    const tickRateMs = 80;
    const simSpeedMultiplier = 35; // 35x speed
    const distancePerTick = speedKms * (tickRateMs / 1000) * simSpeedMultiplier;

    let currentProgress = 0;
    let intermediateStops = route.nodes.slice(1, -1); // junctions along route

    simTimerRef.current = setInterval(() => {
      currentProgress += distancePerTick;

      if (currentProgress >= route.distance) {
        // Arrived!
        clearInterval(simTimerRef.current);
        setSimulationActive(false);
        setSimulationProgress(route.distance);
        setCurrentBusStopName('');

        if (customSimulationMarkerRef.current) {
          customSimulationMarkerRef.current.remove();
          customSimulationMarkerRef.current = null;
        }

        logMessage(`[SIMULATION] Journey complete. Arrived at ${mapData.nodes[selectedEndNode].name}!`, 'success');
        confetti({
          particleCount: 70,
          spread: 50,
          origin: { y: 0.8, x: 0.15 },
          colors: ['#38bdf8', '#4ade80', '#fbbf24']
        });
      } else {
        setSimulationProgress(currentProgress);
        const pos = getPositionAtDistance(route.geometry, currentProgress);
        
        if (pos) {
          if (customSimulationMarkerRef.current) {
            customSimulationMarkerRef.current.setLatLng([pos.lat, pos.lng]);
            
            // Apply rotation matching heading
            const markerDom = customSimulationMarkerRef.current.getElement();
            if (markerDom) {
              const inner = markerDom.querySelector('div');
              if (inner) {
                inner.style.transform = `rotate(${pos.heading}deg)`;
              }
            }
          }

          // Check if bus is passing through an intermediate bus stop/town
          if (mode === 'bus') {
            // Find closest intermediate node
            intermediateStops.forEach((stopId, idx) => {
              const stopNode = mapData.nodes[stopId];
              const distToStop = haversineDistance(pos.lat, pos.lng, stopNode.lat, stopNode.lng);

              // If closer than 400m, show stopping banner!
              if (distToStop < 0.4 && stopNode.name) {
                setCurrentBusStopName(stopNode.name);
                // Remove stop from queue so we don't trigger repeatedly
                intermediateStops.splice(idx, 1);
                
                // Slow down/pause animation briefly to simulate passengers boarding
                logMessage(`[TRANSIT] Bus arrived at: ${stopNode.name} (boarding passengers)`, 'info');
              }
            });
          }
        }
      }
    }, tickRateMs);
  };

  const stopCustomSimulation = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
    }
    setSimulationActive(false);
    setCurrentBusStopName('');

    if (customSimulationMarkerRef.current) {
      customSimulationMarkerRef.current.remove();
      customSimulationMarkerRef.current = null;
    }

    logMessage('[SIMULATION] Travel simulation cancelled by operator.', 'warning');
  };

  // Submit standard responder dispatch
  const handleResponderDispatchSubmit = async () => {
    if (!dispatchRoute || !selectedResponder || !selectedIncident) return;
    
    setSimulationActive(true);
    setSimTransport('car');
    setSimulationProgress(0);
    
    await updateResponderLocal(selectedResponder.id, { status: 'enroute' });
    await updateIncidentStatusLocal(selectedIncident.id, 'responding', null, isOnline);
    await reloadLocalData();

    logMessage(`[DISPATCH] unit ${selectedResponder.name} dispatched to incident. Route simulation initiated.`, 'system');

    const speedKmh = selectedResponder.speed;
    const speedKms = speedKmh / 3600;
    
    const tickRateMs = 100;
    const simSpeedMultiplier = 40;
    const distancePerTick = speedKms * (tickRateMs / 1000) * simSpeedMultiplier;

    let currentProgress = 0;

    simTimerRef.current = setInterval(async () => {
      currentProgress += distancePerTick;
      
      if (currentProgress >= dispatchRoute.distance) {
        clearInterval(simTimerRef.current);
        setSimulationActive(false);
        setSimulationProgress(dispatchRoute.distance);

        const finalCoords = { 
          lat: selectedIncident.lat, 
          lng: selectedIncident.lng, 
          status: 'busy', 
          heading: 0 
        };

        await updateResponderLocal(selectedResponder.id, finalCoords);
        await updateIncidentStatusLocal(selectedIncident.id, 'responding', null, isOnline);
        
        logMessage(`[ARRIVED] ${selectedResponder.name} arrived at emergency location.`, 'success');
        
        setTimeout(async () => {
          await updateIncidentStatusLocal(selectedIncident.id, 'resolved', Date.now(), isOnline);
          await updateResponderLocal(selectedResponder.id, { status: 'idle' });
          logMessage(`[RESOLVED] incident resolved. ${selectedResponder.name} back on standby.`, 'success');
          
          setSelectedIncident(null);
          setSelectedResponder(null);
          setDispatchRoute(null);
          if (routeLayerRef.current) routeLayerRef.current.clearLayers();
          
          await reloadLocalData();
        }, 4000);

        await reloadLocalData();
      } else {
        setSimulationProgress(currentProgress);
        const pos = getPositionAtDistance(dispatchRoute.geometry, currentProgress);
        
        if (pos) {
          await updateResponderLocal(selectedResponder.id, {
            lat: pos.lat,
            lng: pos.lng,
            heading: pos.heading
          });

          setResponders(prev => prev.map(u => 
            u.id === selectedResponder.id 
              ? { ...u, lat: pos.lat, lng: pos.lng, heading: pos.heading }
              : u
          ));
        }
      }
    }, tickRateMs);
  };

  // Sync processor
  const handleSyncToggle = async (e) => {
    const checked = e.target.checked;
    setIsOnline(checked);

    if (checked && syncQueueLength > 0) {
      setIsSyncing(true);
      logMessage(`[SYNC] Connectivity restored. Replicating ${syncQueueLength} queued transactions...`, 'system');

      const queue = await db.syncQueue.toArray();
      
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        await new Promise(resolve => setTimeout(resolve, 800));
        logMessage(`[SYNC] [${i+1}/${queue.length}] Uploaded local action: ${item.action}`, 'info');
      }

      await db.syncQueue.clear();
      setSyncQueueLength(0);
      setIsSyncing(false);
      logMessage('[SYNC] Database synchronized.', 'success');

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8, x: 0.15 },
        colors: ['#10b981', '#34d399', '#38bdf8']
      });
    } else {
      if (checked) {
        logMessage('[SYSTEM] Connection established.', 'info');
      } else {
        logMessage('[SYSTEM] Connection lost. Operating in LOCAL-ONLY mode.', 'warning');
      }
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Controls */}
      {/* 1. Tab Toolbar (Futuristic HUD Navigation) */}
      <nav className="tab-toolbar">
        <div className="brand-icon-wrapper">
          <ShieldAlert size={26} className="brand-logo" />
        </div>
        <div className="tab-buttons">
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => setActiveTab('planner')}
            title="Tactical Route Planner"
          >
            <Navigation size={18} />
            <span className="tab-label">Routing</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'bustle' ? 'active' : ''}`}
            onClick={() => setActiveTab('bustle')}
            title="Live Bus Tracker (Bustle)"
          >
            <Bus size={18} />
            <span className="tab-label">Transit</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
            title="Emergencies & Standby"
          >
            <Flame size={18} />
            <span className="tab-label">Alerts</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'shelters' ? 'active' : ''}`}
            onClick={() => setActiveTab('shelters')}
            title="Evacuation Shelters"
          >
            <Activity size={18} />
            <span className="tab-label">Shelters</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
            title="Database Sync Console"
          >
            <Wifi size={18} />
            {syncQueueLength > 0 && <span className="tab-badge">{syncQueueLength}</span>}
            <span className="tab-label">Sync</span>
          </button>
        </div>
        <div className="toolbar-footer">
          <span className={`network-dot ${isOnline ? 'online' : 'offline'}`}></span>
        </div>
      </nav>

      {/* 2. active tab sidebar panel */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1 className="brand-title">
            {activeTab === 'planner' && 'Tactical Planner'}
            {activeTab === 'bustle' && 'Live Bus Tracker'}
            {activeTab === 'alerts' && 'Emergency Dispatch'}
            {activeTab === 'shelters' && 'Evacuation Safe Hubs'}
            {activeTab === 'sync' && 'System Console'}
          </h1>
          <div className="brand-subtitle">
            {activeTab === 'planner' && 'Multi-modal routing & mock navigation'}
            {activeTab === 'bustle' && 'Live private/KSRTC schedule monitor'}
            {activeTab === 'alerts' && 'File incidents and coordinate response'}
            {activeTab === 'shelters' && 'Active camps capacity & relief tracking'}
            {activeTab === 'sync' && 'Offline sync logs & cluster updates'}
          </div>
        </header>

        <section className="network-bar">
          <div className="status-indicator">
            <span className={`dot ${isOnline ? 'online' : 'offline'}`}></span>
            <span>{isOnline ? 'NETWORK ONLINE' : 'LOCAL-OFFLINE'}</span>
          </div>
          <div className="switch-container">
            <span>Sync</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={isOnline} 
                onChange={handleSyncToggle}
                disabled={isSyncing}
              />
              <span className="slider"></span>
            </label>
          </div>
        </section>

        <div className="sidebar-content">
          {activeTab === 'planner' && (
            <>
              {/* Tactical Route Planner Card */}
              <section className="panel-card" style={{ borderLeft: '3px solid hsl(var(--color-secondary))' }}>
                <h2 className="section-title">
                  <span>Tactical Route Planner</span>
                  <Navigation size={14} style={{ color: 'hsl(var(--color-secondary))' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label>Departure Point</label>
                    <select 
                      value={selectedStartNode} 
                      onChange={(e) => setSelectedStartNode(e.target.value)}
                      disabled={simulationActive}
                    >
                      {Object.keys(mapData.nodes)
                        .filter(id => mapData.nodes[id].type === 'city')
                        .map(id => (
                          <option key={id} value={id}>{mapData.nodes[id].name}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label>Destination Point</label>
                    <select 
                      value={selectedEndNode} 
                      onChange={(e) => setSelectedEndNode(e.target.value)}
                      disabled={simulationActive}
                    >
                      {Object.keys(mapData.nodes)
                        .filter(id => mapData.nodes[id].type === 'city')
                        .map(id => (
                          <option key={id} value={id}>{mapData.nodes[id].name}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label>Means of Transport</label>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        type="button" 
                        className={`btn ${meansOfTransport === 'car' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '0.4rem 0' }}
                        onClick={() => setMeansOfTransport('car')}
                        disabled={simulationActive}
                      >
                        <Car size={12} style={{ marginRight: '0.25rem' }} /> Car
                      </button>
                      <button 
                        type="button" 
                        className={`btn ${meansOfTransport === 'bus' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '0.4rem 0' }}
                        onClick={() => setMeansOfTransport('bus')}
                        disabled={simulationActive}
                      >
                        <Bus size={12} style={{ marginRight: '0.25rem' }} /> Bus
                      </button>
                      <button 
                        type="button" 
                        className={`btn ${meansOfTransport === 'walk' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '0.4rem 0' }}
                        onClick={() => setMeansOfTransport('walk')}
                        disabled={simulationActive}
                      >
                        <Footprints size={12} style={{ marginRight: '0.25rem' }} /> Walk
                      </button>
                    </div>
                  </div>

                  {customRoute ? (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Calculated Distance:</span>
                        <strong style={{ color: '#f3f4f6' }}>{customRoute.distance} km</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Est. Travel Time:</span>
                        <strong style={{ color: '#fbbf24' }}>
                          {meansOfTransport === 'car' && `${Math.round((customRoute.distance / 85) * 60)} mins (at 85 km/h)`}
                          {meansOfTransport === 'walk' && `${Math.round((customRoute.distance / 5) * 60)} mins (at 5 km/h)`}
                          {meansOfTransport === 'bus' && (matchingBusLines.length > 0 ? matchingBusLines[0].time : 'N/A')}
                        </strong>
                      </div>
                      
                      {meansOfTransport === 'bus' && (
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                            Available Bus Services along this path:
                          </label>
                          {matchingBusLines.length === 0 ? (
                            <div className="empty-state" style={{ padding: '0.4rem', color: 'hsl(var(--color-primary))' }}>
                              ⚠️ No bus sequence covers this corridor segment.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {matchingBusLines.map((bus, idx) => (
                                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <strong style={{ color: '#fbbf24', fontSize: '0.75rem' }}>{bus.name}</strong>
                                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                        {bus.type} {bus.frequency !== 'Varies' && `| Freq: ${bus.frequency}`}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>₹{bus.fare}</span>
                                      <span style={{ color: '#38bdf8', fontSize: '0.65rem', fontWeight: '600' }}>{bus.time}</span>
                                    </div>
                                  </div>
                                  
                                  {/* If multi-leg transfer, draw the itinerary timeline */}
                                  {!bus.isDirect && bus.legs && (
                                    <div style={{ marginTop: '0.5rem', borderLeft: '1.5px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {bus.legs.map((leg, lidx) => (
                                        <div key={lidx} style={{ fontSize: '0.7.rem', color: 'var(--text-secondary)', position: 'relative' }}>
                                          <span style={{ position: 'absolute', left: '-9.5px', top: '3px', width: '5px', height: '5px', background: '#a855f7', borderRadius: '50%' }}></span>
                                          <strong>{leg.from}</strong> to <strong>{leg.to}</strong>
                                          <div style={{ color: '#fbbf24', fontSize: '0.65rem', marginTop: '0.05rem' }}>
                                            🚌 {leg.busName} | ₹{leg.fare} | {leg.time}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {meansOfTransport === 'walk' && (
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          🚶 Foot patrol calorie estimate: <strong style={{ color: '#4ade80' }}>~{Math.round(customRoute.distance * 60)} kcal</strong>
                        </div>
                      )}

                      {!simulationActive ? (
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                          <button 
                            type="button" 
                            onClick={() => startCustomSimulation(meansOfTransport)} 
                            className="btn btn-secondary" 
                            style={{ flex: 1, borderColor: 'hsl(var(--color-secondary))' }}
                            disabled={meansOfTransport === 'bus' && matchingBusLines.length === 0}
                          >
                            <Play size={12} /> Simulate Travel
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (!gpsActive) {
                                handleGpsToggle();
                              }
                              setIsNavigating(true);
                              logMessage('[NAV] Active turn-by-turn guidance initiated.', 'success');
                            }}
                            className="btn btn-success"
                            style={{ flex: 1 }}
                          >
                            <Navigation size={12} /> Navigate
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>
                            <span>Simulating Route...</span>
                            <span>{Math.round((simulationProgress / customRoute.distance) * 100)}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${(simulationProgress / customRoute.distance) * 100}%`, 
                              height: '100%', 
                              background: '#10b981'
                            }}></div>
                          </div>
                          <button 
                            type="button" 
                            onClick={stopCustomSimulation} 
                            className="btn btn-primary" 
                            style={{ marginTop: '0.5rem' }}
                          >
                            <Square size={10} /> Abort Journey
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">No route found. Clear blockages.</div>
                  )}
                </div>
              </section>

              {/* Live Geolocation Control Panel */}
              <section className="panel-card" style={{ borderLeft: gpsActive ? '3px solid #3b82f6' : '1px solid var(--border-color)' }}>
                <h2 className="section-title">
                  <span>Live GPS Navigation</span>
                  <Compass size={14} className={gpsActive ? 'spinning-compass' : ''} style={{ color: gpsActive ? '#3b82f6' : 'var(--text-muted)' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    onClick={handleGpsToggle} 
                    className={`btn ${gpsActive ? 'btn-success' : 'btn-secondary'}`}
                  >
                    <Locate size={14} />
                    {gpsActive ? 'Deactivate Live GPS' : 'Activate Live GPS'}
                  </button>

                  {gpsActive && gpsCoords && (
                    <div style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Latitude:</span>
                        <strong style={{ color: '#f3f4f6' }}>{gpsCoords.lat.toFixed(5)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Longitude:</span>
                        <strong style={{ color: '#f3f4f6' }}>{gpsCoords.lng.toFixed(5)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Mode:</span>
                        <strong style={{ color: mockGpsMode ? '#fbbf24' : '#4ade80' }}>
                          {mockGpsMode ? 'MOCK / EMULATED' : 'PHYSICAL SENSOR'}
                        </strong>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Bind GPS to Standby Responder:</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={bindGpsToUnit} 
                            onChange={(e) => setBindGpsToUnit(e.target.checked)}
                            disabled={!selectedResponder}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                      {!selectedResponder && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          * Select a responder unit below first to enable device-to-unit mapping.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === 'bustle' && (
            <>
              {/* Live Bus Tracker Console (Bustle Integration) */}
              <section className="panel-card" style={{ borderLeft: trackedBusId ? '3px solid #f43f5e' : '1px solid var(--border-color)' }}>
                <h2 className="section-title">
                  <span>Live Bus Tracker (Bustle)</span>
                  <Bus size={14} className={trackedBusId ? 'brand-logo' : ''} style={{ color: trackedBusId ? '#f43f5e' : 'var(--text-muted)' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.25rem' }}>
                    <label>Select Bus to Track</label>
                    <select 
                      value={trackedBusId || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setTrackedBusId(val || null);
                        if (val) {
                          const selected = simulatedBuses.find(b => b.id === val);
                          if (selected && mapRef.current) {
                            mapRef.current.setView([selected.lat, selected.lng], 12);
                          }
                        }
                      }}
                    >
                      <option value="">-- Click to start tracking --</option>
                      {simulatedBuses.map(bus => (
                        <option key={bus.id} value={bus.id}>{bus.name} ({bus.type})</option>
                      ))}
                    </select>
                  </div>

                  {trackedBusId ? (() => {
                    const bus = simulatedBuses.find(b => b.id === trackedBusId);
                    if (!bus) return null;
                    const nextStopId = bus.nodeSequence[bus.currentSegmentIndex + 1] || bus.nodeSequence[0];
                    const nextStopName = mapData.nodes[nextStopId]?.name || 'Terminus';
                    const fromNodeName = mapData.nodes[bus.nodeSequence[bus.currentSegmentIndex]]?.name || 'Origin';

                    return (
                      <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                          <strong style={{ color: bus.status === 'Stopped' ? '#fbbf24' : '#4ade80' }}>
                            {bus.status === 'Stopped' ? '🛑 Stopped at Stop' : `⚡ En Route (${bus.speed} km/h)`}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Current Link:</span>
                          <strong style={{ color: '#e5e7eb' }}>{fromNodeName} ➔ {nextStopName}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Next Station:</span>
                          <strong style={{ color: '#fbbf24' }}>{nextStopName}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Distance Progress:</span>
                          <strong style={{ color: '#38bdf8' }}>{Math.round(bus.segmentProgress * 100)}%</strong>
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                            Route Timetable
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderLeft: '1.5px solid rgba(244, 63, 94, 0.2)', paddingLeft: '0.5rem' }}>
                            {bus.nodeSequence.map((nid, idx) => {
                              const isVisited = idx <= bus.currentSegmentIndex;
                              const isCurrent = idx === bus.currentSegmentIndex;
                              return (
                                <div key={nid} style={{ display: 'flex', justifyContent: 'space-between', color: isCurrent ? '#fbbf24' : isVisited ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                                  <span>{isCurrent ? '●' : '○'} {mapData.nodes[nid]?.name || nid}</span>
                                  <span>{idx === 0 ? '08:00 AM' : `+\idx * 30} mins`}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <button 
                          type="button" 
                          onClick={() => setTrackedBusId(null)} 
                          className="btn btn-secondary" 
                          style={{ marginTop: '0.75rem', width: '100%', borderColor: 'rgba(255, 255, 255, 0.15)', padding: '0.3rem' }}
                        >
                          Stop Tracking
                        </button>
                      </div>
                    );
                  })() : (
                    <div className="empty-state" style={{ padding: '0.5rem' }}>
                      No active bus selected for tracking. Select from menu or click on any 🚌 marker.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === 'alerts' && (
            <>
              {/* Dispatch Form Panel */}
              <section className="panel-card">
                <h2 className="section-title">
                  <span>Report Emergency</span>
                  <PlusCircle size={14} style={{ color: 'hsl(var(--color-primary))' }} />
                </h2>
                <form onSubmit={handleManualIncidentSubmit}>
                  <div className="form-group">
                    <label>Incident Type</label>
                    <select 
                      value={newIncidentType} 
                      onChange={(e) => setNewIncidentType(e.target.value)}
                      disabled={simulationActive}
                    >
                      <option value="fire">🔥 Fire / Landslide</option>
                      <option value="medical">🩺 Medical Emergency</option>
                      <option value="flood">🌊 Water Rescue / Flooding</option>
                    </select>
                  </div>
                  
                  {mapClickCoords ? (
                    <div className="form-group">
                      <label>Incident Location (Mapped Coordinates)</label>
                      <div style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.08)', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#38bdf8' }}>
                        <span>Coordinates: <strong>[{mapClickCoords.lat.toFixed(5)}, {mapClickCoords.lng.toFixed(5)}]</strong></span>
                        <button 
                          type="button" 
                          onClick={() => setMapClickCoords(null)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Incident District Hub</label>
                      <select 
                        value={newIncidentDistrict} 
                        onChange={(e) => setNewIncidentDistrict(e.target.value)}
                        disabled={simulationActive}
                      >
                        {Object.keys(mapData.nodes)
                          .filter(id => mapData.nodes[id].type === 'city')
                          .map(id => (
                            <option key={id} value={id}>{mapData.nodes[id].name}</option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Situation Details</label>
                    <input 
                      type="text" 
                      value={newIncidentDesc} 
                      onChange={(e) => setNewIncidentDesc(e.target.value)}
                      placeholder="e.g. NH 544 landslide warning..."
                      disabled={simulationActive}
                    />
                  </div>

                  <div className="form-group">
                    <label>Upload Photographic Proof (Required)</label>
                    <input 
                      type="file" 
                      id="incident-proof-file"
                      accept="image/*" 
                      onChange={handleProofUpload}
                      style={{ display: 'none' }}
                      disabled={simulationActive}
                    />
                    <label htmlFor="incident-proof-file" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed var(--border-color)',
                      borderRadius: '10px',
                      padding: '1rem',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.01)',
                      transition: 'all 0.2s',
                      gap: '4px',
                      marginTop: '0.25rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!simulationActive) {
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.background = 'rgba(56, 189, 248, 0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                    }}
                    >
                      {proofPreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
                          <img src={proofPreview} alt="Proof preview" style={{ width: '100%', maxHeight: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>✓ Proof Uploaded</span>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '1.3rem' }}>📷</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Select Image Proof</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Image format required to report</span>
                        </>
                      )}
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={simulationActive || !proofImage}>
                    File Incident Report
                  </button>
                </form>
              </section>

              {/* Active Incidents Registry */}
              <section className="panel-card">
                <h2 className="section-title">
                  <span>Active Emergencies ({incidents.filter(i => i.status !== 'resolved').length})</span>
                  <ShieldAlert size={14} />
                </h2>
                <div className="list-container">
                  {incidents.filter(i => i.status !== 'resolved').length === 0 ? (
                    <div className="empty-state">No pending emergency alerts.</div>
                  ) : (
                    incidents.filter(i => i.status !== 'resolved').map(inc => {
                      const isActive = selectedIncident && selectedIncident.id === inc.id;
                      let iconClass = 'fire';
                      if (inc.type === 'medical') iconClass = 'medical';
                      if (inc.type === 'flood') iconClass = 'flood';
                      
                      return (
                        <div 
                          key={inc.id} 
                          className={`list-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            if (!simulationActive) {
                              setSelectedIncident(inc);
                              mapRef.current?.panTo([inc.lat, inc.lng]);
                            }
                          }}
                        >
                          <div className={`item-icon ${iconClass}`}>
                            {inc.type === 'fire' && <Flame size={16} />}
                            {inc.type === 'medical' && <Activity size={16} />}
                            {inc.type === 'flood' && <Droplet size={16} />}
                          </div>
                          <div className="item-details">
                            <div className="item-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible', whiteSpace: 'normal' }}>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginRight: '0.5rem', flex: 1 }} title={inc.description}>
                                {inc.description}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                {inc.priority && (
                                  <span className={`badge`} style={{ 
                                    background: inc.priority === 'critical' ? 'rgba(239,68,68,0.25)' : inc.priority === 'high' ? 'rgba(245,158,11,0.25)' : 'rgba(234,179,8,0.25)',
                                    color: inc.priority === 'critical' ? '#ef4444' : inc.priority === 'high' ? '#f59e0b' : '#eab308',
                                    border: `1px solid ${inc.priority === 'critical' ? '#ef4444' : inc.priority === 'high' ? '#f59e0b' : '#eab308'}`,
                                    fontSize: '0.55rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    padding: '0.05rem 0.25rem',
                                    borderRadius: '4px'
                                  }}>
                                    {inc.priority}
                                  </span>
                                )}
                                <button 
                                  type="button" 
                                  title="Dismiss Fake Alert"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteIncident(inc.id);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    padding: '0 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s',
                                    outline: 'none'
                                  }}
                                  onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                                  onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            <div className="item-subtitle" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                              <span>Status: <span className={`badge badge-${inc.status}`}>{inc.status}</span></span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                {new Date(inc.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {isActive && inc.aiRecommendation && (
                              <div style={{ 
                                marginTop: '0.4rem', 
                                padding: '0.35rem', 
                                background: 'rgba(59, 130, 246, 0.06)', 
                                border: '1px solid rgba(59, 130, 246, 0.15)', 
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                color: '#9ca3af'
                              }}>
                                <span style={{ color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '0.1rem' }}>🤖 AI Command Assist:</span>
                                {inc.aiRecommendation}
                              </div>
                            )}
                            {isActive && inc.proofImage && (
                              <div style={{ marginTop: '0.4rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '0.15rem' }}>📷 Photographic Proof:</span>
                                <img src={inc.proofImage} alt="Incident Proof" style={{ width: '100%', maxHeight: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Active Units Status */}
              <section className="panel-card">
                <h2 className="section-title">
                  <span>Standby Fleet</span>
                  <Navigation size={14} style={{ color: 'hsl(var(--color-secondary))' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {responders.map(r => {
                    const isSelected = selectedResponder && selectedResponder.id === r.id;
                    return (
                      <div 
                        key={r.id} 
                        className={`list-item ${isSelected ? 'active' : ''}`}
                        style={{ cursor: simulationActive ? 'not-allowed' : 'pointer' }}
                        onClick={() => {
                          if (!simulationActive) {
                            setSelectedResponder(r);
                            mapRef.current?.panTo([r.lat, r.lng]);
                          }
                        }}
                      >
                        <div style={{ fontSize: '20px', paddingRight: '0.5rem' }}>
                          {getResponderEmoji(r.type)}
                        </div>
                        <div className="item-details">
                          <div className="item-title" style={{ fontWeight: '600' }}>{r.name}</div>
                          <div className="item-subtitle">
                            <span>Speed: {r.speed} km/h</span>
                            <span className={`badge badge-${r.status === 'idle' ? 'resolved' : r.status === 'enroute' ? 'responding' : 'pending'}`}>
                              {r.status === 'enroute' && bindGpsToUnit && isSelected ? 'GPS Live' : r.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {activeTab === 'shelters' && (
            <>
              {/* Evacuation Relief Shelters panel */}
              <section className="panel-card" style={{ borderLeft: '3px solid #10b981' }}>
                <h2 className="section-title">
                  <span>Evacuation Relief Shelters</span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', fontWeight: 'bold' }}>SAFE HUBS</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {shelters.map(sh => {
                    const ratio = sh.occupancy / sh.capacity;
                    const isFull = ratio >= 0.9;
                    const progressColor = isFull ? '#ef4444' : ratio >= 0.7 ? '#fbbf24' : '#10b981';

                    return (
                      <div key={sh.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.45rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', marginBottom: '0.2rem' }}>
                          <span style={{ color: '#f3f4f6' }}>{sh.name}</span>
                          <span style={{ color: progressColor }}>{sh.occupancy}/{sh.capacity}</span>
                        </div>
                        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1.5px', overflow: 'hidden', marginBottom: '0.35rem' }}>
                          <div style={{ width: `${Math.min(100, (sh.occupancy / sh.capacity) * 100)}%`, height: '100%', background: progressColor }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{sh.resources}</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              const { id: shelterNodeId } = findClosestNode(sh.lat, sh.lng, mapData.nodes);
                              if (gpsCoords && gpsActive) {
                                const { id: startId } = findClosestNode(gpsCoords.lat, gpsCoords.lng, mapData.nodes);
                                setSelectedStartNode(startId);
                              }
                              setSelectedEndNode(shelterNodeId);
                              if (mapRef.current) {
                                mapRef.current.setView([sh.lat, sh.lng], 13);
                              }
                              logMessage(`Evacuation routing to ${sh.name}`, 'success');
                            }}
                            style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.15rem 0.4rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Evac Route
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {activeTab === 'sync' && (
            <>
              {!isAdminAuthenticated ? (
                /* Admin Login Form */
                <section className="panel-card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '0' }}>
                  <h2 className="section-title" style={{ justifyContent: 'center', marginBottom: '1.25rem' }}>
                    <Compass size={18} style={{ color: '#a855f7', animation: 'spin 8s linear infinite' }} />
                    <span>Terminal Authentication</span>
                  </h2>
                  <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {loginError && (
                      <div style={{ fontSize: '0.725rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.45rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center', fontWeight: 'bold' }}>
                        {loginError}
                      </div>
                    )}
                    <div className="form-group">
                      <label>Admin User ID</label>
                      <input 
                        type="text" 
                        value={adminUser}
                        onChange={(e) => setAdminUser(e.target.value)}
                        placeholder="Enter admin ID..."
                        required
                        style={{ border: loginError ? '1px solid #ef4444' : '1px solid var(--border-color)' }}
                        disabled={simulationActive}
                      />
                    </div>
                    <div className="form-group">
                      <label>Terminal Password</label>
                      <input 
                        type="password" 
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter password..."
                        required
                        style={{ 
                          width: '100%',
                          padding: '0.65rem 0.8rem',
                          background: 'var(--bg-input)',
                          border: loginError ? '1px solid #ef4444' : '1px solid var(--border-color)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.85rem',
                          outline: 'none',
                          transition: 'var(--transition-fast)'
                        }}
                        disabled={simulationActive}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ background: '#a855f7', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)', marginTop: '0.5rem' }} disabled={simulationActive}>
                      Access Terminal
                    </button>
                  </form>
                </section>
              ) : (
                /* Authenticated Sync Tab Content (Audits, Details, Sync Console) */
                <>
                  {/* Terminal Info Card */}
                  <section className="panel-card" style={{ marginBottom: '0.75rem' }}>
                    <h2 className="section-title">
                      <span>Terminal Access Details</span>
                      <Info size={14} style={{ color: '#38bdf8' }} />
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Public IP Address:</span>
                        <strong style={{ color: '#38bdf8' }}>{visitorIp || 'Detecting...'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Physical Location:</span>
                        <strong style={{ color: '#a855f7' }}>{visitorCity && visitorRegion ? `${visitorCity}, ${visitorRegion}` : 'Detecting...'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Network Carrier (ISP):</span>
                        <strong style={{ color: '#fbbf24', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }} title={visitorIsp}>{visitorIsp || 'Detecting...'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Operating System:</span>
                        <strong style={{ color: '#f3f4f6' }}>{visitorOs || 'Detecting...'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Browser Client:</span>
                        <strong style={{ color: '#f3f4f6' }}>{visitorBrowser || 'Detecting...'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Platform Type:</span>
                        <strong style={{ color: '#10b981' }}>{visitorDevice || 'Detecting...'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                        <strong style={{ color: '#10b981' }}>Authenticated</strong>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAdminAuthenticated(false);
                          setAdminUser('');
                          setAdminPassword('');
                          logMessage('[SYSTEM] Terminal console locked by admin.', 'warning');
                        }}
                        className="btn btn-secondary"
                        style={{ marginTop: '0.5rem', padding: '0.35rem', fontSize: '0.7rem', width: '100%', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                      >
                        Lock Console
                      </button>
                    </div>
                  </section>

              {/* Recent Access Log */}
              <section className="panel-card" style={{ marginBottom: '0.75rem' }}>
                <h2 className="section-title">
                  <span>Recent Terminal Audits ({visitorLogs.length})</span>
                  <Activity size={14} style={{ color: '#10b981' }} />
                </h2>
                <div className="list-container" style={{ maxHeight: '110px', gap: '0.4rem' }}>
                  {visitorLogs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '0.4rem' }}>No audits logged.</div>
                  ) : (
                    visitorLogs.map((log, idx) => (
                      <div key={log.id || idx} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{log.ip}</span>
                          <span style={{ color: '#a855f7', fontSize: '0.65rem' }}>{log.city ? `${log.city}, ${log.region}` : 'Resolved Geo'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{log.os} • {log.browser}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Sync Console */}
              <section className="console-panel" style={{ height: 'calc(100vh - 380px)', margin: '0' }}>
                <div className="console-title">
                  <span>IndexedDB Sync Console</span>
                  {syncQueueLength > 0 && (
                    <span style={{ color: 'hsl(var(--color-primary))', fontWeight: 'bold' }}>
                      {syncQueueLength} PENDING SYNC
                    </span>
                  )}
                </div>
                <div className="console-logs" style={{ height: 'calc(100% - 30px)' }}>
                  {isSyncing && (
                    <div className="console-log-line system" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span>⏳</span>
                      <span>Uploading transactions to central cluster...</span>
                    </div>
                  )}
                  {syncLogs.map((log, idx) => {
                    let logClass = '';
                    if (log.includes('[ERROR]')) logClass = 'error';
                    else if (log.includes('[SYSTEM]') || log.includes('[SYNC]')) logClass = 'system';
                    else if (log.includes('[INCIDENT]') || log.includes('[ROAD BLOCKAGE]')) logClass = 'warning';
                    else if (log.includes('[GPS]') || log.includes('[MOCK GPS]') || log.includes('[SIMULATION]')) logClass = 'system';
                    
                    return (
                      <div key={idx} className={`console-log-line ${logClass}`}>
                        {log}
                      </div>
                    );
                  })}
                </div>
              </section>
                </>
              )}
            </>
          )}
        </div>
      </aside>
      {/* Main Interactive Map Viewport */}
      <main className="map-viewport">
        {/* Interactive Leaflet Element */}
        <div ref={mapContainerRef} className="map-container"></div>
        
        {/* Google Maps Style Navigation HUD Overlay */}
        {isNavigating && gpsCoords && (
          <>
            {/* Top turn-by-turn banner */}
            <div className="nav-banner-top">
              <div className="nav-turn-icon">
                {nextTurnIcon === 'left' && '⬅️'}
                {nextTurnIcon === 'right' && '➡️'}
                {nextTurnIcon === 'straight' && '⬆️'}
                {nextTurnIcon === 'arrive' && '📍'}
              </div>
              <div className="nav-instruction-text">
                {nextInstruction}
              </div>
              <button 
                type="button" 
                className="nav-speech-btn" 
                onClick={() => setSpeechEnabled(!speechEnabled)}
                title={speechEnabled ? "Mute Voice Guidance" : "Unmute Voice Guidance"}
              >
                {speechEnabled ? '🔊' : '🔇'}
              </button>
            </div>
            
            {/* Bottom travel details bar */}
            <div className="nav-details-bottom">
              <div className="nav-detail-col">
                <span className="nav-detail-val" style={{ color: '#10b981' }}>
                  {customRoute ? Math.round((customRoute.distance / (meansOfTransport === 'walk' ? 5 : meansOfTransport === 'bus' ? 55 : 85)) * 60) : 0} min
                </span>
                <span className="nav-detail-label">TIME</span>
              </div>
              <div className="nav-detail-col">
                <span className="nav-detail-val">
                  {customRoute ? customRoute.distance : 0} km
                </span>
                <span className="nav-detail-label">DISTANCE</span>
              </div>
              <div className="nav-detail-col">
                <span className="nav-detail-val">
                  {(() => {
                    const etaMins = customRoute ? Math.round((customRoute.distance / (meansOfTransport === 'walk' ? 5 : meansOfTransport === 'bus' ? 55 : 85)) * 60) : 0;
                    const date = new Date();
                    date.setMinutes(date.getMinutes() + etaMins);
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  })()}
                </span>
                <span className="nav-detail-label">ARRIVAL</span>
              </div>
              <button 
                type="button" 
                className="btn btn-primary nav-exit-btn" 
                onClick={() => {
                  setIsNavigating(false);
                  logMessage('[NAV] Navigation session ended.', 'info');
                }}
              >
                Exit Nav
              </button>
            </div>
          </>
        )}
  

        {/* Hover / Dispatch Controls Overlay */}
        <div className="map-overlay-panel">
          {/* Dispatch controls card */}
          {selectedIncident && (
            <div className="map-overlay-card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ShieldAlert size={14} style={{ color: 'hsl(var(--color-primary))' }} />
                  <span>Mission Dispatch Controls</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedIncident(null);
                    setSelectedResponder(null);
                    setDispatchRoute(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                  title="Close Controls"
                >
                  ✕
                </button>
              </h3>
              
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Incident: <strong>{selectedIncident.description}</strong>
              </div>

              {!selectedResponder ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Select an idle responder unit from the sidebar or click below to auto-find the closest.
                  </div>
                  <button onClick={handleAutoDispatch} className="btn btn-secondary">
                    Auto-Find Closest Responder
                  </button>
                  <button 
                    onClick={() => deleteIncident(selectedIncident.id)} 
                    className="btn btn-primary"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', marginTop: '0.25rem' }}
                  >
                    Dismiss Fake Alert
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: '4px' }}>
                    <span>Selected Unit:</span>
                    <strong style={{ color: '#38bdf8' }}>{selectedResponder.name}</strong>
                  </div>

                  {bindGpsToUnit && gpsActive ? (
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', margin: '0.25rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        <span className="dot online" style={{ background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }}></span>
                        <span>LIVE GPS NAVIGATION ACTIVE</span>
                      </div>
                      {dispatchRoute ? (
                        <div>
                          Distance to emergency: <strong>{dispatchRoute.distance} km</strong>
                          <br/>
                          Est. Travel Time: <strong>{Math.round((dispatchRoute.distance / selectedResponder.speed) * 60)} mins</strong>
                        </div>
                      ) : (
                        <span style={{ color: '#ef4444' }}>No open route (check blockages)</span>
                      )}
                      <button 
                        onClick={() => deleteIncident(selectedIncident.id)} 
                        className="btn btn-primary"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%', marginTop: '0.5rem' }}
                      >
                        Dismiss Fake Alert
                      </button>
                    </div>
                  ) : dispatchRoute && (
                    <div className="route-meta" style={{ margin: '0.25rem 0' }}>
                      <div className="meta-row">
                        <span>Route Length:</span>
                        <span className="meta-value">{dispatchRoute.distance} km</span>
                      </div>
                      <div className="meta-row">
                        <span>Est. Driving Time:</span>
                        <span className="meta-value">
                          {Math.round((dispatchRoute.distance / selectedResponder.speed) * 60)} mins
                        </span>
                      </div>
                    </div>
                  )}

                  {!bindGpsToUnit && (
                    <>
                      {!simulationActive ? (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            onClick={handleResponderDispatchSubmit} 
                            className="btn btn-success" 
                            style={{ flex: 1 }}
                            disabled={!dispatchRoute}
                          >
                            <Play size={14} /> Dispatch
                          </button>
                          <button 
                            onClick={() => deleteIncident(selectedIncident.id)} 
                            className="btn btn-primary"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', flex: 1 }}
                          >
                            Dismiss Fake Alert
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                            <span>Simulating Route...</span>
                            <span>{Math.round((simulationProgress / (dispatchRoute?.distance || 1)) * 100)}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${(simulationProgress / (dispatchRoute?.distance || 1)) * 100}%`, 
                              height: '100%', 
                              background: '#10b981',
                              transition: 'width 0.1s linear'
                            }}></div>
                          </div>
                          <button 
                            onClick={stopSimulation} 
                            className="btn btn-primary" 
                            style={{ marginTop: '0.5rem' }}
                          >
                            <Square size={12} /> Abort Mission
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Blockages overview card */}
          {blockages.length > 0 && (
            <div className="map-overlay-card" style={{ borderLeft: '3px solid #ef4444' }}>
              <h3 style={{ fontSize: '0.8rem', marginBottom: '0.25rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertTriangle size={12} />
                <span>Active Road Closures ({blockages.length})</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto' }}>
                {blockages.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0.25rem 0' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {b.name}
                    </span>
                    <button 
                      onClick={() => removeBlockage(b.id)} 
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px' }}
                      disabled={simulationActive}
                    >
                      <Trash2 size={10} style={{ color: '#f87171' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bus Stopping / Arrival Alert */}
          {currentBusStopName && (
            <div className="map-overlay-card" style={{ borderLeft: '3px solid #fbbf24', background: 'rgba(15,23,42,0.92)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <Bus size={14} className="brand-logo" />
                <span>BUS ARRIVING AT STOP</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', marginTop: '0.25rem', color: '#f3f4f6' }}>
                {currentBusStopName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Ordinary Stop | Boarding & Alighting
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Map Instruction Banner */}
        {instructionBannerVisible ? (
          <div className="instruction-banner" style={{ pointerEvents: 'auto' }}>
            <MapPin size={12} style={{ color: 'hsl(var(--color-primary))' }} />
            <span style={{ fontSize: '0.75rem', marginRight: '0.5rem' }}>
              {gpsActive 
                ? <strong>[GPS Mode] Click map to reposition Mock GPS location and trigger live path rerouting.</strong>
                : "Double-click map to place emergency incident. Click road segment to block/unblock it."
              }
            </span>
            <button 
              type="button" 
              onClick={() => setInstructionBannerVisible(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => e.target.style.color = '#ef4444'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
              title="Minimize Instructions"
            >
              ✕
            </button>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => setInstructionBannerVisible(true)}
            className="instruction-restore-btn"
            title="Show Instructions"
          >
            ℹ️
          </button>
        )}
      </main>
    </div>
  );
}
