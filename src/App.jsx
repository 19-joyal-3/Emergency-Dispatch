import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, addIncidentLocal, updateIncidentStatusLocal, addBlockageLocal, removeBlockageLocal, updateResponderLocal, logVisitorAudit, getVisitorAudits } from './db';
import { formatSosMessage, getSosContacts, openSosCall, openSosSms, saveSosContacts } from './sos';
import mapData from './mapData.json';
import { solveDijkstra, findClosestNode, findClosestEdge, getPositionAtDistance, getRouteLength, haversineDistance } from './routing';
import { fetchWeather } from './weatherApi';
import { isSupabaseConfigured, supabase } from './supabase';
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
  Car,
  HelpCircle,
  Phone,
  MessageSquare,
  Users,
  Radio,
  Building2,
  LockKeyhole,
  BarChart3,
  CircleDollarSign,
  ShieldCheck,
  Globe2
  ,Download
  ,Languages
  ,FileText
  ,Presentation
  ,Search
  ,Volume2
  ,Vibrate
  ,PhoneCall
  ,Eye
  ,EyeOff
  ,Loader2
  ,LogOut
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

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const DISPATCH_CONFIG = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
  emergencyNumbers: {
    police: import.meta.env.VITE_EMERGENCY_POLICE || '100',
    fire: import.meta.env.VITE_EMERGENCY_FIRE || '101',
    medical: import.meta.env.VITE_EMERGENCY_MEDICAL || '108',
    disaster: import.meta.env.VITE_EMERGENCY_DISASTER || '112'
  }
};

const getStoredJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  // Onboarding Tour States & Handlers
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Map Environment HUD States
  const [mapTheme, setMapTheme] = useState('dark'); // 'light', 'dark', 'satellite', 'terrain'
  const [weatherEffect, setWeatherEffect] = useState('mist'); // 'clear', 'rain', 'mist'
  const [weather, setWeather] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState('loading');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchStatus, setLocationSearchStatus] = useState('idle');
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [mapDataStatus, setMapDataStatus] = useState('ready');
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(() => getStoredJson('dispatch_sound_alerts', true));
  const [vibrationAlertsEnabled, setVibrationAlertsEnabled] = useState(() => getStoredJson('dispatch_vibration_alerts', true));
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(() => getStoredJson('dispatch_auto_assign', true));
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('all');
  const [incidentPriorityFilter, setIncidentPriorityFilter] = useState('all');
  const [emergencyNumbers, setEmergencyNumbers] = useState(() => getStoredJson('dispatch_emergency_numbers', DISPATCH_CONFIG.emergencyNumbers));

  const tileLayerRef = useRef(null);

  const getTileUrl = (_theme) => {
    if (!navigator.onLine) return null;
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  };

  const getTileAttribution = (theme) => {
    if (!navigator.onLine) return 'Offline mode: local road network view';
    if (theme === 'dark') return '&copy; OpenStreetMap contributors &copy; CARTO';
    return 'Map data: &copy; OpenStreetMap contributors';
  };

  const persistAlertPreference = (key, value, setter) => {
    setter(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  const searchLocations = async (event) => {
    event?.preventDefault();
    const query = locationQuery.trim();
    if (!query) {
      setLocationResults([]);
      return;
    }
    if (!navigator.onLine) {
      setLocationSearchStatus('offline');
      setLocationResults([]);
      logMessage('[MAP] Location search unavailable offline. Use the bundled road network.', 'warning');
      return;
    }
    setLocationSearchStatus('loading');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`Search returned ${response.status}`);
      const results = await response.json();
      setLocationResults(results);
      setLocationSearchStatus(results.length ? 'ready' : 'empty');
    } catch (error) {
      console.warn('Location search failed:', error);
      setLocationSearchStatus('error');
      setLocationResults([]);
    }
  };

  const selectLocationResult = (result) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !mapRef.current) return;
    mapRef.current.setView([lat, lng], 14);
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    searchMarkerRef.current = L.marker([lat, lng]).addTo(mapRef.current)
      .bindPopup(`<strong>${escapeHtml(result.display_name)}</strong>`)
      .openPopup();
    setLocationResults([]);
    setLocationQuery(result.display_name);
    setShowLocationSearch(false);
  };

  const TOUR_STEPS = [
    {
      title: "Welcome to Dispatch Hub",
      subtitle: "Kerala Highway emergency system guide",
      body: "This tactical dashboard coordinates real-time emergency dispatches, safe camps, and road closures. Let's take a quick 1-minute tour to see how to use it!",
      icon: "🚒"
    },
    {
      title: "Dijkstra Route Planner",
      subtitle: "Tab 1: Highway Path Solver",
      body: "Select a departure point and destination along NH 544. Click 'Navigate' to solve the fastest path. The Dijkstra solver automatically routes vehicles around active road blockages!",
      icon: "🧭"
    },
    {
      title: "Interactive Incident Map",
      subtitle: "Viewport: Live Mapping & Geolocation",
      body: "Double-click anywhere on the map to file an emergency incident or report a road closure. You will see responder units traveling and active operators globally in real-time.",
      icon: "🗺️"
    },
    {
      title: "Emergency Dispatch Panel",
      subtitle: "Tab 3: Response Dispatcher",
      body: "Report new incidents here. You can inspect active accidents, upload proof photos from the scene, and click 'Dispatch' to route nearby emergency vehicles instantly.",
      icon: "🚨"
    },
    {
      title: "Evacuation Safe Hubs",
      subtitle: "Tab 4: Safe Camps & Capacity",
      body: "Monitor and update relief camp capacities, locate safe zones, and track resources/population in evacuation safe hubs during flood or landslide emergencies.",
      icon: "🏕️"
    },
    {
      title: "Cloud Sync Console",
      subtitle: "Tab 5: System Admin Logs",
      body: "Log in with your authorized Operator ID and Password to access secure audit logs, view other active operators on the map, and synchronize incidents globally in real-time!",
      icon: "💻"
    }
  ];

  const handleTourNext = () => {
    const nextStep = tourStep + 1;
    if (nextStep < TOUR_STEPS.length) {
      setTourStep(nextStep);
      // Auto-switch tabs to corresponding panel to display targeted elements
      if (nextStep === 1) setActiveTab('planner');
      if (nextStep === 2) setActiveTab('planner');
      if (nextStep === 3) setActiveTab('alerts');
      if (nextStep === 4) setActiveTab('shelters');
      if (nextStep === 5) setActiveTab('sync');
    } else {
      handleTourEnd();
    }
  };

  const handleTourPrev = () => {
    const prevStep = tourStep - 1;
    if (prevStep >= 0) {
      setTourStep(prevStep);
      if (prevStep === 1) setActiveTab('planner');
      if (prevStep === 2) setActiveTab('planner');
      if (prevStep === 3) setActiveTab('alerts');
      if (prevStep === 4) setActiveTab('shelters');
      if (prevStep === 5) setActiveTab('sync');
    }
  };

  const handleTourEnd = () => {
    setShowTour(false);
    localStorage.setItem('emergency_nav_tour_finished', 'true');
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const startOnboardingTour = () => {
    setShowTour(true);
    setTourStep(0);
    setActiveTab('planner');
  };



  // App connection state
  const [isOnline, setIsOnline] = useState(() => navigator.onLine !== false);
  const [syncQueueLength, setSyncQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sosContacts, setSosContacts] = useState(() => getSosContacts());
  const [sosContactName, setSosContactName] = useState('');
  const [sosContactPhone, setSosContactPhone] = useState('');

  useEffect(() => {
    const handleConnectionChange = () => {
      const online = navigator.onLine !== false;
      setIsOnline(online);
      if (!online) {
        logMessage('[SYSTEM] Network lost. Operating in local-only mode.', 'warning');
      } else {
        logMessage('[SYSTEM] Network restored. Online services available.', 'success');
      }
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, []);
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
  
  // AI Incident Photo Verification States
  const [mobilenetModel, setMobilenetModel] = useState(null);
  const [modelStatus, setModelStatus] = useState('loading'); // 'loading', 'ready', 'classifying', 'failed'
  const [aiVerificationResult, setAiVerificationResult] = useState(null);
  const [overrideAiVerification, setOverrideAiVerification] = useState(false);

  // Load TensorFlow.js and MobileNet scripts dynamically
  const loadModelScripts = () => {
    return new Promise((resolve) => {
      if (!navigator.onLine) {
        setModelStatus('offline');
        setAiVerificationResult({
          success: false,
          label: 'AI verification unavailable offline',
          confidence: 0
        });
        resolve();
        return;
      }
      if (window.mobilenet) {
        resolve();
        return;
      }
      const tfScript = document.createElement('script');
      tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
      tfScript.onload = () => {
        const mnScript = document.createElement('script');
        mnScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js';
        mnScript.onload = () => {
          resolve();
        };
        document.body.appendChild(mnScript);
      };
      tfScript.onerror = () => {
        setModelStatus('offline');
        resolve();
      };
      document.body.appendChild(tfScript);
    });
  };

  // Classify uploaded base64 verification photo using MobileNet model
  const classifyVerificationPhoto = useCallback(async (dataUrl) => {
    if (!mobilenetModel) {
      setAiVerificationResult({
        success: false,
        label: 'AI model is still loading',
        confidence: 0
      });
      return;
    }
    
    setModelStatus('classifying');
    setAiVerificationResult(null);
    setOverrideAiVerification(false);

    const tempImg = new Image();
    tempImg.src = dataUrl;
    tempImg.onload = async () => {
      try {
        const predictions = await mobilenetModel.classify(tempImg);
        
        const threatCategories = [
          {
            name: "Flood Threat",
            incidentTypes: ['flood'],
            keywords: ['flood', 'floodwater', 'river', 'stream', 'canal', 'waterfall', 'dam'],
            emoji: "🌊"
          },
          {
            name: "Landslide Threat",
            incidentTypes: ['fire'],
            keywords: ['landslide', 'rockslide', 'mudslide', 'avalanche', 'debris', 'debris flow', 'boulder', 'cliff', 'rock', 'stone', 'earth', 'mud', 'slope', 'mountain', 'valley', 'volcano', 'quarry', 'badlands', 'soil', 'dirt', 'rubble', 'gravel'],
            emoji: "⛰️"
          },
          {
            name: "Traffic Threat",
            incidentTypes: ['medical'],
            keywords: ['traffic', 'collision', 'crash', 'wreck', 'intersection'],
            emoji: "🚦"
          },
          {
            name: "Fire Threat",
            incidentTypes: ['fire'],
            keywords: ['fire', 'flame', 'smoke', 'blaze', 'bonfire'],
            emoji: "🔥"
          },
          {
            name: "Medical/Crash Threat",
            incidentTypes: ['medical'],
            keywords: ['ambulance', 'crash', 'wreck', 'collision', 'stretcher', 'hospital'],
            emoji: "🩺"
          }
        ];

        const minimumConfidence = 0.55;
        const explicitLandslideCues = new Set([
          'landslide', 'rockslide', 'mudslide', 'avalanche', 'debris', 'debris flow', 'boulder', 'rubble'
        ]);

        let matchedThreat = null;
        let matchedPrediction = null;

        for (const pred of predictions) {
          const labelLower = pred.className.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          for (const cat of threatCategories) {
            const matchesIncidentType = cat.incidentTypes.includes(newIncidentType);
            const match = matchesIncidentType && cat.keywords.some(kw => {
              const escapedKeyword = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return new RegExp(`(?:^|\\s)${escapedKeyword}(?:$|\\s)`, 'i').test(labelLower);
            });
            const isExplicitLandslideCue = cat.name === 'Landslide Threat' &&
              cat.keywords.some(keyword => explicitLandslideCues.has(keyword) && labelLower.includes(keyword));
            const requiredConfidence = isExplicitLandslideCue ? 0.35 : minimumConfidence;
            if (match && pred.probability >= requiredConfidence) {
              matchedThreat = cat;
              matchedPrediction = pred;
              break;
            }
          }
          if (matchedThreat) break;
        }

        if (matchedThreat) {
          setAiVerificationResult({
            success: true,
            threatName: matchedThreat.name,
            threatEmoji: matchedThreat.emoji,
            label: matchedPrediction.className,
            confidence: Math.round(matchedPrediction.probability * 100)
          });
          logMessage(`🤖 AI Verified: ${matchedThreat.emoji} ${matchedThreat.name} (Detected: ${matchedPrediction.className}, Confidence: ${Math.round(matchedPrediction.probability * 100)}%)`, 'success');
        } else {
          const topMatch = predictions[0];
          setAiVerificationResult({
            success: false,
            label: topMatch.className,
            confidence: Math.round(topMatch.probability * 100)
          });
          logMessage(`🤖 AI Security Warning: Photo did not match threat profiles (Top Match: ${topMatch.className}, Confidence: ${Math.round(topMatch.probability * 100)}%)`, 'warning');
        }
        setModelStatus('ready');
      } catch (err) {
        console.error('TensorFlow classification error:', err);
        setAiVerificationResult({
          success: false,
          label: 'Unable to verify image',
          confidence: 0
        });
        setModelStatus('failed');
      }
    };
  }, [mobilenetModel, newIncidentType]);

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

  useEffect(() => {
    if (proofImage && mobilenetModel) {
      classifyVerificationPhoto(proofImage);
    }
  }, [classifyVerificationPhoto, mobilenetModel, proofImage]);
  const [newIncidentDistrict, setNewIncidentDistrict] = useState('tvm');

  // Visitor Access & IP Diagnostics States
  const [visitorOs, setVisitorOs] = useState('');
  const [visitorBrowser, setVisitorBrowser] = useState('');
  const [visitorDevice, setVisitorDevice] = useState('');
  const [visitorLogs, setVisitorLogs] = useState([]);
  
  // Admin Authentication States
  const [adminUser, setAdminUser] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirmation, setAdminPasswordConfirmation] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [authCooldown, setAuthCooldown] = useState(0);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdminAuthenticated(Boolean(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminAuthenticated(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setAuthNotice('');

    if (authCooldown > 0) {
      setLoginError(`Please wait ${authCooldown} seconds before trying again.`);
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      setLoginError('Supabase is not configured. Add VITE_SUPABASE_PUBLISHABLE_KEY and restart the app.');
      return;
    }

    if (authMode === 'reset') {
      setAuthLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(adminUser.trim(), {
        redirectTo: window.location.origin
      });
      setAuthLoading(false);
      if (error) {
        setLoginError(error.message);
        return;
      }
      setAuthNotice('Password reset instructions sent. Check your email.');
      return;
    }

    if (authMode === 'signup' && adminPassword !== adminPasswordConfirmation) {
      setLoginError('Passwords do not match.');
      return;
    }

    setAuthLoading(true);
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email: adminUser.trim(), password: adminPassword })
      : await supabase.auth.signInWithPassword({ email: adminUser.trim(), password: adminPassword });
    setAuthLoading(false);

    if (result.error) {
      const errorMessage = result.error.message.toLowerCase();
      if (errorMessage.includes('rate limit') || errorMessage.includes('email rate')) {
        setLoginError('Supabase email rate limit reached. Wait about an hour, or disable email confirmation for local testing in Supabase Authentication settings.');
        setAuthCooldown(60);
        const cooldownTimer = window.setInterval(() => {
          setAuthCooldown((seconds) => {
            if (seconds <= 1) {
              window.clearInterval(cooldownTimer);
              return 0;
            }
            return seconds - 1;
          });
        }, 1000);
      } else {
        setLoginError(result.error.message);
      }
      return;
    }

    if (authMode === 'signup') {
      setAuthNotice('Account created. Check your email to verify your address before signing in.');
      setAuthMode('login');
      setAdminPassword('');
      setAdminPasswordConfirmation('');
    } else {
      setIsAdminAuthenticated(true);
      logMessage('[SYSTEM] Admin console unlocked. Audit logs active.', 'success');
    }
  };

  const handleAdminLogout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoginError(error.message);
      return;
    }
    setIsAdminAuthenticated(false);
    setAdminPassword('');
    setAuthMode('login');
  };

  // Geolocation states
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

  // Initialize TensorFlow Model on startup
  useEffect(() => {
    if (!navigator.onLine) {
      setModelStatus('offline');
      setAiVerificationResult({
        success: false,
        label: 'AI verification unavailable offline',
        confidence: 0
      });
      return;
    }

    loadModelScripts().then(async () => {
      try {
        if (!window.mobilenet || !navigator.onLine) {
          setModelStatus('offline');
          setAiVerificationResult({
            success: false,
            label: 'AI verification unavailable offline',
            confidence: 0
          });
          return;
        }
        setModelStatus('loading');
        const model = await window.mobilenet.load();
        setMobilenetModel(model);
        setModelStatus('ready');
        logMessage('🤖 AI verification model initialized successfully.', 'success');
      } catch (err) {
        console.error('Failed to load TensorFlow model:', err);
        setModelStatus('offline');
        setAiVerificationResult({
          success: false,
          label: 'AI verification unavailable offline',
          confidence: 0
        });
      }
    });
  }, []);

  // Keep a minimal local device audit without collecting IP addresses or precise location.
  useEffect(() => {
    const runAudit = async () => {
      const deviceDetails = getDeviceDetails();
      setVisitorOs(deviceDetails.os);
      setVisitorBrowser(deviceDetails.browser);
      setVisitorDevice(deviceDetails.device);
      try {
        const newAudit = {
          os: deviceDetails.os,
          browser: deviceDetails.browser,
          device: deviceDetails.device,
          timestamp: Date.now()
        };
        await logVisitorAudit(newAudit);
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
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const knownIncidentIdsRef = useRef(new Set());
  const incidentsHydratedRef = useRef(false);
  const dataLoadedRef = useRef(false);
  const searchMarkerRef = useRef(null);
  
  useEffect(() => {
    const fallbackNode = mapData.nodes[selectedStartNode] || mapData.nodes.tvm;
    const location = gpsCoords || fallbackNode;
    const controller = new AbortController();
    setWeatherStatus('loading');

    fetchWeather(location.lat, location.lng, controller.signal)
      .then(setWeather)
      .then(() => setWeatherStatus('ready'))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to load weather:', error);
          setWeatherStatus('error');
        }
      });

    return () => controller.abort();
  }, [gpsCoords, selectedStartNode, weatherRefreshKey]);
  const [gpsHeading, setGpsHeading] = useState(0);
  const [bindGpsToUnit, setBindGpsToUnit] = useState(false);
  const [mockGpsMode, setMockGpsMode] = useState(false);
  const [customerTrackingActive, setCustomerTrackingActive] = useState(false);
  const [trackedCustomerId, setTrackedCustomerId] = useState(null);
  const [customers, setCustomers] = useState([
    { id: 'customer_1', name: 'Anita Menon', phone: '•••• 1842', lat: 10.5954, lng: 76.4714, status: 'Moving', speed: 34, source: 'Demo GPS', heading: 90 },
    { id: 'customer_2', name: 'Rahul Nair', phone: '•••• 6720', lat: 10.5276, lng: 76.2144, status: 'Moving', speed: 18, source: 'Demo GPS', heading: 180 },
    { id: 'customer_3', name: 'Meera Joseph', phone: '•••• 9031', lat: 9.9312, lng: 76.2673, status: 'Stationary', speed: 0, source: 'Demo GPS', heading: 0 },
    { id: 'customer_4', name: 'This device', phone: 'Location sharing off', lat: 10.6100, lng: 76.5000, status: 'Offline', speed: 0, source: 'Not sharing', heading: 0, isSelf: true }
  ]);
  const [businessRole, setBusinessRole] = useState('Dispatcher');
  const [businessName, setBusinessName] = useState('');
  const [businessStoreType, setBusinessStoreType] = useState('Emergency Services');
  const [businessLocation, setBusinessLocation] = useState(null);
  const [businessLogo, setBusinessLogo] = useState('');
  const [businessSetupSaved, setBusinessSetupSaved] = useState(false);
  const [businessDirectory, setBusinessDirectory] = useState([]);
  const [interfaceLanguage, setInterfaceLanguage] = useState('English');
  const [presentationMode, setPresentationMode] = useState(false);
  const [reportRange, setReportRange] = useState('All activity');
  const [paymentStatus, setPaymentStatus] = useState('Not started');
  const [locationRetentionDays, setLocationRetentionDays] = useState(30);
  const [geofenceAlertsEnabled, setGeofenceAlertsEnabled] = useState(true);
  const [businessPlan, setBusinessPlan] = useState('Operations');
  const [geofenceEvents] = useState([
    { id: 'geo_1', customer: 'Anita Menon', zone: 'NH 544 Response Zone', event: 'Entered', time: '2 min ago', severity: 'info' },
    { id: 'geo_2', customer: 'Rahul Nair', zone: 'Alathur Safe Area', event: 'Exited', time: '8 min ago', severity: 'warning' }
  ]);

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
  const customerMarkersRef = useRef(new Map());
  const businessMarkerRef = useRef(null);

  useEffect(() => {
    try {
      const savedBusiness = JSON.parse(localStorage.getItem('emergency_dispatch_business') || 'null');
      if (!savedBusiness) return;
      setBusinessName(savedBusiness.name || '');
      setBusinessStoreType(savedBusiness.storeType || 'Emergency Services');
      setBusinessLocation(savedBusiness.location || null);
      setBusinessLogo(savedBusiness.logo || '');
      setBusinessSetupSaved(Boolean(savedBusiness.name));
      setBusinessDirectory(savedBusiness.name ? [savedBusiness] : []);
    } catch (error) {
      console.error('Failed to load saved business profile:', error);
    }
  }, []);

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
  const activeSimulationRouteRef = useRef(null);
  const pendingCustomRerouteRef = useRef(null);
  
  const watchIdRef = useRef(null);
  
  // Google Maps Style Live Navigation States
  const [activeTab, setActiveTab] = useState(null); // planner, bustle, alerts, shelters, sync
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
            <div class="radar-ripple ripple-2" style="color: #c084fc;"></div>
            <div class="radar-ripple ripple-3" style="color: #e9d5ff;"></div>
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
    dataLoadedRef.current = true;
  };

  // New incidents notify the operator without relying on a remote push service.
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    if (!incidentsHydratedRef.current) {
      incidents.forEach(incident => knownIncidentIdsRef.current.add(incident.id));
      incidentsHydratedRef.current = true;
      return;
    }
    const newIncidents = incidents.filter(incident => !knownIncidentIdsRef.current.has(incident.id));
    newIncidents.forEach(incident => {
      knownIncidentIdsRef.current.add(incident.id);
      if (soundAlertsEnabled) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = incident.priority === 'critical' ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.36);
            oscillator.onended = () => context.close();
          }
        } catch (error) {
          console.warn('Alert sound could not be played:', error);
        }
      }
      if (vibrationAlertsEnabled && navigator.vibrate) {
        navigator.vibrate(incident.priority === 'critical' ? [180, 80, 180] : [120, 60, 120]);
      }
      logMessage(`[ALERT] New ${incident.priority || 'medium'} priority ${incident.type} emergency received.`, 'warning');
    });
  }, [incidents, soundAlertsEnabled, vibrationAlertsEnabled]);

  const logMessage = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  };

  const addSosContact = (e) => {
    e.preventDefault();
    const name = sosContactName.trim();
    const phone = sosContactPhone.trim();
    if (!name || !phone) return;

    const nextContacts = [...sosContacts, { id: `sos_${Date.now()}`, name, phone }];
    setSosContacts(nextContacts);
    saveSosContacts(nextContacts);
    setSosContactName('');
    setSosContactPhone('');
    logMessage(`[SOS] Saved emergency contact: ${name}`, 'success');
  };

  const removeSosContact = (id) => {
    const nextContacts = sosContacts.filter(contact => contact.id !== id);
    setSosContacts(nextContacts);
    saveSosContacts(nextContacts);
  };

  const sendSosSms = (incident, contact) => {
    const message = formatSosMessage(incident);
    logMessage(`[SOS] Opening SMS fallback for ${contact.name}. Press Send in the phone app.`, 'warning');
    openSosSms(contact, message);
  };

  const callSosContact = (contact) => {
    logMessage(`[SOS] Opening emergency call fallback for ${contact.name}.`, 'warning');
    openSosCall(contact);
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

      const offlineTileUrl = getTileUrl(mapTheme);
      if (offlineTileUrl) {
        const tileLayer = L.tileLayer(offlineTileUrl, {
          attribution: getTileAttribution(mapTheme)
        }).addTo(map);
        tileLayerRef.current = tileLayer;
      } else {
        tileLayerRef.current = null;
        map.getContainer().style.background = 'radial-gradient(circle at center, rgba(30,41,59,0.95), rgba(2,6,23,1))';
      }

      mapRef.current = map;
      setMapDataStatus('ready');
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

      // Right-click selects the exact map point for a new business profile.
      map.on('contextmenu', (e) => {
        handleBusinessMapLocation(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [blockages]);

  // Dynamic Map Theme/Base-Layer Switcher
  useEffect(() => {
    if (!mapRef.current) return;

    const tileUrl = getTileUrl(mapTheme);
    if (tileUrl) {
      if (!tileLayerRef.current) {
        tileLayerRef.current = L.tileLayer(tileUrl, {
          attribution: getTileAttribution(mapTheme)
        }).addTo(mapRef.current);
      } else {
        tileLayerRef.current.setUrl(tileUrl);
      }
      tileLayerRef.current.setOpacity(1);
      mapRef.current.getContainer().style.background = '';
    } else {
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      mapRef.current.getContainer().style.background = 'radial-gradient(circle at center, rgba(30,41,59,0.95), rgba(2,6,23,1))';
    }
  }, [mapTheme, isOnline]);

  // Re-draw road network when blockages or traffic overlay state updates
  useEffect(() => {
    if (mapRef.current) {
      drawRoadNetwork();
    }
  }, [blockages, showTraffic]);

  // 3. Draw Road Network
  const drawRoadNetwork = () => {
    if (!mapRef.current || !roadsLayerRef.current) return;
    roadsLayerRef.current.clearLayers();

    const getTrafficColor = (edge) => {
      // Deterministic hash based on edge name length and distance
      const hash = (edge.name.length + edge.distance) % 10;
      if (hash < 6) return '#10b981'; // 60% Green (Free flow)
      if (hash < 8) return '#f59e0b'; // 20% Orange (Moderate)
      return '#ef4444'; // 20% Red (Heavy congestion)
    };

    mapData.edges.forEach(edge => {
      const isBlocked = blockages.some(b => 
        (b.fromNode === edge.from && b.toNode === edge.to) ||
        (b.fromNode === edge.to && b.toNode === edge.from)
      );

      const color = isBlocked ? '#ef4444' : (showTraffic ? getTrafficColor(edge) : '#334155');
      const dashArray = isBlocked ? '5, 5' : null;
      const weight = isBlocked ? 4 : (showTraffic ? 4 : 3);
      const opacity = isBlocked ? 0.9 : (showTraffic ? 0.85 : 0.6);

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

      // Hover feedback to make road lines feel alive
      polyline.on('mouseover', () => {
        polyline.setStyle({
          color: isBlocked ? '#f87171' : '#c084fc',
          weight: isBlocked ? 6 : 5,
          opacity: 0.95
        });
      });

      polyline.on('mouseout', () => {
        polyline.setStyle({
          color: color,
          weight: weight,
          opacity: opacity
        });
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
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
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

        const marker = L.marker([node.lat, node.lng], { icon: cityIcon, interactive: true })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="color: #f3f4f6; font-family: sans-serif; font-size: 11px; min-width: 140px;">
              <h4 style="margin: 0 0 4px; color: #38bdf8; font-weight: bold;">${node.name}</h4>
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 10px;">Select node action:</p>
              <div style="display: flex; gap: 4px;">
                <button id="set-start-${nodeId}" style="
                  background: #a855f7; 
                  color: white; 
                  border: none; 
                  padding: 4px 6px; 
                  border-radius: 4px; 
                  font-weight: bold;
                  font-size: 10px;
                  cursor: pointer;
                  flex: 1;
                ">Start Here</button>
                <button id="set-end-${nodeId}" style="
                  background: #38bdf8; 
                  color: #0b0f19; 
                  border: none; 
                  padding: 4px 6px; 
                  border-radius: 4px; 
                  font-weight: bold;
                  font-size: 10px;
                  cursor: pointer;
                  flex: 1;
                ">End Here</button>
              </div>
            </div>
          `);

        marker.on('popupopen', () => {
          const btnStart = document.getElementById(`set-start-${nodeId}`);
          if (btnStart) {
            btnStart.onclick = () => {
              setSelectedStartNode(nodeId);
              setActiveTab('planner');
              logMessage(`Departure point set to ${node.name}`, 'info');
              mapRef.current?.closePopup();
            };
          }
          const btnEnd = document.getElementById(`set-end-${nodeId}`);
          if (btnEnd) {
            btnEnd.onclick = () => {
              setSelectedEndNode(nodeId);
              setActiveTab('planner');
              logMessage(`Destination point set to ${node.name}`, 'info');
              mapRef.current?.closePopup();
            };
          }
        });

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
          <div class="radar-ripple ripple-2" style="color: ${color};"></div>
          <div class="radar-ripple ripple-3" style="color: ${color};"></div>
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
          <h4 style="margin: 0 0 4px; color: ${color}; text-transform: uppercase;">${escapeHtml(inc.type)} Incident</h4>
          <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af;">${escapeHtml(inc.description)}</p>
          <div style="font-size: 11px; margin-bottom: 8px;">Status: <span style="font-weight:bold; color:${color}">${escapeHtml(inc.status)}</span></div>
          <button id="pop-dispatch-${escapeHtml(inc.id)}" style="
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
          <button id="pop-delete-${escapeHtml(inc.id)}" style="
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

  // Update Simulated Bus Markers (Live Bus Tracker) - Disabled to keep map clean of automated vehicles
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear all active bus markers from the map
    busMarkersRef.current.forEach((marker) => {
      marker.remove();
    });
    busMarkersRef.current.clear();
  }, [simulatedBuses]);

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

  // 8b. Live customer location markers
  useEffect(() => {
    if (!mapRef.current) return;

    const activeIds = new Set(customers.map(customer => customer.id));
    customerMarkersRef.current.forEach((marker, customerId) => {
      if (!activeIds.has(customerId)) {
        marker.remove();
        customerMarkersRef.current.delete(customerId);
      }
    });

    customers.forEach(customer => {
      const isSelected = trackedCustomerId === customer.id;
      const color = customer.isSelf && customerTrackingActive ? '#22c55e' : customer.status === 'Moving' ? '#f59e0b' : '#94a3b8';
      const customerIcon = L.divIcon({
        className: 'custom-customer-marker',
        html: `<div style="position: relative; width: 28px; height: 28px;">
          <div style="width: 18px; height: 18px; margin: 5px; background: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 ${isSelected ? 16 : 8}px ${color};"></div>
          ${customer.status === 'Moving' ? `<div style="position: absolute; inset: 0; border: 1px solid ${color}; border-radius: 50%; opacity: .45; animation: gps-pulse 1.8s infinite;"></div>` : ''}
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const popup = `<div style="color: #f3f4f6; font-family: sans-serif; font-size: 11px; min-width: 150px;">
        <h4 style="margin: 0 0 5px; color: ${color};">${customer.name}</h4>
        <div>${customer.status} ${customer.speed ? `• ${customer.speed} km/h` : ''}</div>
        <div style="color: #9ca3af; margin-top: 3px;">Source: ${customer.source}</div>
        <div style="color: #9ca3af;">Updated: just now</div>
      </div>`;

      if (customerMarkersRef.current.has(customer.id)) {
        const marker = customerMarkersRef.current.get(customer.id);
        marker.setLatLng([customer.lat, customer.lng]);
        marker.setIcon(customerIcon);
        marker.setPopupContent(popup);
      } else {
        const marker = L.marker([customer.lat, customer.lng], { icon: customerIcon, zIndexOffset: isSelected ? 800 : 400 })
          .addTo(mapRef.current)
          .bindPopup(popup);
        customerMarkersRef.current.set(customer.id, marker);
      }
    });

    if (trackedCustomerId) {
      const tracked = customers.find(customer => customer.id === trackedCustomerId);
      if (tracked) mapRef.current.setView([tracked.lat, tracked.lng], 12);
    }
  }, [customers, trackedCustomerId, customerTrackingActive]);

  // Show the selected business location on the map and keep it in sync with the profile.
  useEffect(() => {
    if (!mapRef.current) return;

    if (!businessLocation) {
      businessMarkerRef.current?.remove();
      businessMarkerRef.current = null;
      return;
    }

    const logoMarkup = businessLogo
      ? `<img src="${businessLogo}" alt="" style="width: 28px; height: 28px; object-fit: contain; border-radius: 5px; background: white; padding: 2px;" />`
      : '<div style="width: 28px; height: 28px; display: grid; place-items: center; color: white; font-size: 17px;">⌂</div>';
    const businessIcon = L.divIcon({
      className: 'custom-business-marker',
      html: `<div style="width: 36px; height: 36px; display: grid; place-items: center; border: 2px solid #ec4899; border-radius: 9px; background: #111827; box-shadow: 0 0 14px rgba(236,72,153,.75);">${logoMarkup}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    const popup = `<div style="color: #f3f4f6; font-family: sans-serif; font-size: 11px; min-width: 155px;">
      <h4 style="margin: 0 0 5px; color: #f9a8d4;">${businessName || 'Business location'}</h4>
      <div style="color: #d1d5db;">${businessStoreType}</div>
      <div style="color: #9ca3af; margin-top: 4px;">[${businessLocation.lat.toFixed(5)}, ${businessLocation.lng.toFixed(5)}]</div>
    </div>`;

    if (businessMarkerRef.current) {
      businessMarkerRef.current.setLatLng([businessLocation.lat, businessLocation.lng]);
      businessMarkerRef.current.setIcon(businessIcon);
      businessMarkerRef.current.setPopupContent(popup);
    } else {
      businessMarkerRef.current = L.marker([businessLocation.lat, businessLocation.lng], { icon: businessIcon, zIndexOffset: 1200 })
        .addTo(mapRef.current)
        .bindPopup(popup);
    }
  }, [businessLocation, businessLogo, businessName, businessStoreType]);

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
          logMessage(`[GPS] Tracking failed: ${error.message}. Initiating Mock GPS Mode at selected Departure Point.`, 'warning');
          // Start with mock GPS at the current selected start node coordinates!
          const startNode = mapData.nodes[selectedStartNode] || mapData.nodes['vadakkencherry'];
          setGpsCoords({ lat: startNode.lat, lng: startNode.lng });
          setGpsActive(true);
          setMockGpsMode(true);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  const handleCustomerLocationToggle = () => {
    if (customerTrackingActive) {
      setCustomerTrackingActive(false);
      setCustomers(prev => prev.map(customer => customer.isSelf
        ? { ...customer, status: 'Offline', source: 'Not sharing', phone: 'Location sharing off' }
        : customer));
      logMessage('[CUSTOMER] Location sharing stopped for this device.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      logMessage('[CUSTOMER] This browser does not support location sharing.', 'error');
      return;
    }

    setCustomerTrackingActive(true);
    logMessage('[CUSTOMER] Requesting consent to share this device location.', 'info');
    if (!gpsActive) handleGpsToggle();
  };

  const handleBusinessLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      logMessage('[BUSINESS] Please upload an image file for the logo.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBusinessLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBusinessSetupSubmit = (event) => {
    event.preventDefault();
    if (!businessName.trim()) {
      logMessage('[BUSINESS] Enter a business name before saving.', 'error');
      return;
    }
    setBusinessSetupSaved(true);
    const locationText = businessLocation ? ` at [${businessLocation.lat.toFixed(5)}, ${businessLocation.lng.toFixed(5)}]` : '';
    const savedProfile = {
      name: businessName.trim(),
      storeType: businessStoreType,
      location: businessLocation,
      logo: businessLogo
    };
    localStorage.setItem('emergency_dispatch_business', JSON.stringify(savedProfile));
    setBusinessDirectory([savedProfile]);
    logMessage(`[BUSINESS] ${businessName.trim()} setup saved as ${businessStoreType}${locationText}.`, 'success');
  };

  const exportOperationsReport = () => {
    const rows = [
      ['Emergency Dispatch Operations Report', reportRange],
      ['Business', businessName || 'Not configured'],
      ['Generated', new Date().toISOString()],
      [],
      ['Customers', 'Status', 'Source', 'Latitude', 'Longitude'],
      ...customers.map(customer => [customer.name, customer.status, customer.source, customer.lat, customer.lng]),
      [],
      ['Incident ID', 'Type', 'Status', 'Latitude', 'Longitude', 'Reported At'],
      ...incidents.map(incident => [incident.id, incident.type, incident.status, incident.lat, incident.lng, new Date(incident.reportedAt).toISOString()])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dispatch-report-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    logMessage('[REPORT] Operations CSV exported.', 'success');
  };

  const downloadIncidentPdf = (incident = null) => {
    const selectedReports = incident ? [incident] : incidents.filter(item => item.status !== 'resolved');
    const lines = [
      'EMERGENCY DISPATCH INCIDENT REPORT',
      `Generated: ${new Date().toLocaleString()}`,
      `Workspace: ${businessName || 'Not configured'}`,
      ''
    ];
    selectedReports.forEach((item, index) => {
      lines.push(
        `Incident ${index + 1}: ${item.id}`,
        `Type: ${(item.type || 'unknown').toUpperCase()} | Priority: ${(item.priority || 'medium').toUpperCase()}`,
        `Status: ${item.status || 'pending'}`,
        `Reported: ${new Date(item.reportedAt).toLocaleString()}`,
        `Location: ${item.lat}, ${item.lng}`,
        `Description: ${item.description || 'No description'}`,
        `Assigned responder: ${item.assignedResponderName || 'Unassigned'}`,
        ''
      );
    });
    if (!selectedReports.length) lines.push('No active incidents.');
    const escapePdf = (value) => String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const content = `BT\n/F1 11 Tf\n50 760 Td\n${lines.map(line => `(${escapePdf(line)}) Tj\n0 -16 Td`).join('')}ET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = incident ? `incident-${incident.id}.pdf` : `dispatch-incidents-${Date.now()}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    logMessage(`[REPORT] ${incident ? 'Incident' : 'Operations'} PDF exported.`, 'success');
  };

  const saveEmergencyNumber = (key, value) => {
    const nextNumbers = { ...emergencyNumbers, [key]: value };
    setEmergencyNumbers(nextNumbers);
    localStorage.setItem('dispatch_emergency_numbers', JSON.stringify(nextNumbers));
  };

  const handleBusinessMapLocation = (lat, lng) => {
    setBusinessLocation({ lat, lng });
    setActiveTab('business');
    logMessage(`[BUSINESS] Map location selected: [${lat.toFixed(5)}, ${lng.toFixed(5)}]. Complete the business setup form.`, 'info');
  };

  const handlePaymentRequest = () => {
    if (!businessSetupSaved) {
      logMessage('[PAYMENT] Save business details before continuing to payment.', 'warning');
      return;
    }
    setPaymentStatus('Checkout ready');
    logMessage(`[PAYMENT] Checkout prepared for ${businessPlan} plan. Connect a payment provider to collect payment.`, 'info');
  };

  // Keep the current device visible as an explicitly consented customer.
  useEffect(() => {
    if (!customerTrackingActive || !gpsCoords) return;
    setCustomers(prev => prev.map(customer => customer.isSelf
      ? {
          ...customer,
          lat: gpsCoords.lat,
          lng: gpsCoords.lng,
          heading: gpsHeading,
          status: 'Moving',
          source: mockGpsMode ? 'Mock GPS' : 'Physical GPS',
          phone: 'Location sharing on'
        }
      : customer));
  }, [customerTrackingActive, gpsCoords, gpsHeading, mockGpsMode]);

  // Demo movement makes the multi-customer view testable before a backend is connected.
  useEffect(() => {
    const timer = setInterval(() => {
      setCustomers(prev => prev.map(customer => {
        if (customer.isSelf || customer.status !== 'Moving') return customer;
        const distance = 0.00035;
        const radians = (customer.heading * Math.PI) / 180;
        return {
          ...customer,
          lat: customer.lat + Math.cos(radians) * distance,
          lng: customer.lng + Math.sin(radians) * distance,
          heading: (customer.heading + (customer.id === 'customer_2' ? 2 : -1) + 360) % 360
        };
      }));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  
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
    if (isNavigating && customRoute && customRoute.geometry) {
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
  }, [gpsCoords, gpsActive, customRoute, dispatchRoute, bindGpsToUnit, gpsHeading, selectedResponder, isNavigating, selectedStartNode]);

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
      if (!window.confirm('Dismiss this incident? This action cannot be undone.')) return;
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
      proofImage: proof || null,
      assignedResponderId: null,
      assignedResponderName: null
    };

    try {
      if (autoAssignEnabled) {
        const compatibleTypes = type === 'medical' ? ['medical']
          : type === 'fire' ? ['fire_engine']
            : ['rescue_boat'];
        const available = responders
          .filter(responder => responder.status === 'idle' && compatibleTypes.includes(responder.type))
          .sort((a, b) => haversineDistance(newInc.lat, newInc.lng, a.lat, a.lng) -
            haversineDistance(newInc.lat, newInc.lng, b.lat, b.lng));
        const assigned = available[0];
        if (assigned) {
          newInc.assignedResponderId = assigned.id;
          newInc.assignedResponderName = assigned.name;
          await updateResponderLocal(assigned.id, { assignedIncidentId: newInc.id });
          logMessage(`[DISPATCH] Automatically assigned ${assigned.name} to new ${type} emergency.`, 'success');
        }
      }
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
    if (modelStatus !== 'ready' || !aiVerificationResult?.success) {
      logMessage('Failed to file report: Uploaded image did not pass hazard verification.', 'error');
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
        
        // Auto-center and zoom map to fit the bounds of the newly solved route
        if (mapRef.current && result.geometry && result.geometry.length > 0) {
          try {
            const bounds = L.polyline(result.geometry).getBounds();
            mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
          } catch (e) {
            console.error("Error fitting map bounds to path:", e);
          }
        }
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

  // Re-route an active tactical simulation when a newly reported blockage closes its path.
  useEffect(() => {
    const activeRoute = activeSimulationRouteRef.current;
    if (!simulationActive || !activeRoute || !customRoute) return;

    const routeBlocked = blockages.some(blockage =>
      activeRoute.edges.some(edge =>
        (blockage.fromNode === edge.from && blockage.toNode === edge.to) ||
        (blockage.fromNode === edge.to && blockage.toNode === edge.from)
      )
    );

    if (!routeBlocked) return;

    const currentPosition = getPositionAtDistance(activeRoute.geometry, simulationProgress);
    if (!currentPosition) return;

    const { id: rerouteStartNode } = findClosestNode(
      currentPosition.lat,
      currentPosition.lng,
      mapData.nodes
    );

    if (simTimerRef.current) clearInterval(simTimerRef.current);
    activeSimulationRouteRef.current = null;
    pendingCustomRerouteRef.current = {
      mode: simTransport,
      startNode: rerouteStartNode,
      endNode: selectedEndNode
    };
    setSimulationActive(false);
    setSelectedStartNode(rerouteStartNode);
    logMessage('[NAV-TACTICAL] Hazard detected on the active route. Recalculating from the current position...', 'warning');
  }, [blockages, customRoute, simulationActive, simulationProgress, simTransport, selectedEndNode]);

  // Wait for Dijkstra to produce the route from the vehicle's current node, then resume it.
  useEffect(() => {
    const pendingReroute = pendingCustomRerouteRef.current;
    if (!pendingReroute || simulationActive || !customRoute) return;
    if (
      customRoute.nodes[0] !== pendingReroute.startNode ||
      customRoute.nodes[customRoute.nodes.length - 1] !== pendingReroute.endNode
    ) return;

    pendingCustomRerouteRef.current = null;
    logMessage('[NAV-TACTICAL] Alternate route acquired. Resuming navigation.', 'success');
    startCustomSimulation(pendingReroute.mode, customRoute, pendingReroute.startNode, pendingReroute.endNode);
  }, [customRoute, simulationActive]);

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
  const startCustomSimulation = async (
    mode,
    routeOverride = customRoute,
    startNodeOverride = selectedStartNode,
    endNodeOverride = selectedEndNode
  ) => {
    const route = routeOverride;
    if (!route) return;

    activeSimulationRouteRef.current = route;
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

    logMessage(`[SIMULATION] Starting journey from ${mapData.nodes[startNodeOverride].name} to ${mapData.nodes[endNodeOverride].name} via ${mode.toUpperCase()}...`, 'system');

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

        activeSimulationRouteRef.current = null;
        logMessage(`[SIMULATION] Journey complete. Arrived at ${mapData.nodes[endNodeOverride].name}!`, 'success');
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
    activeSimulationRouteRef.current = null;
    pendingCustomRerouteRef.current = null;

    if (customSimulationMarkerRef.current) {
      customSimulationMarkerRef.current.remove();
      customSimulationMarkerRef.current = null;
    }

    logMessage('[SIMULATION] Travel simulation cancelled by operator.', 'warning');
  };

  // Auto-Find Closest Responder
  const handleAutoDispatch = () => {
    if (!selectedIncident || responders.length === 0) return;
    
    const idleResponders = responders.filter(r => r.status === 'idle');
    if (idleResponders.length === 0) {
      logMessage("No idle responders available at the moment.", "warning");
      return;
    }
    
    let closest = null;
    let minDistance = Infinity;
    
    idleResponders.forEach(r => {
      const dist = haversineDistance(selectedIncident.lat, selectedIncident.lng, r.lat, r.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = r;
      }
    });
    
    if (closest) {
      setSelectedResponder(closest);
      logMessage(`Auto-selected closest responder: ${closest.name} (${minDistance.toFixed(1)} km away)`, "info");
    }
  };

  // Relocate all idle responders to the closest city node (nearest station) to the incident when selected
  useEffect(() => {
    if (!selectedIncident || responders.length === 0) return;
    
    const { id: closestNodeId } = findClosestNode(selectedIncident.lat, selectedIncident.lng, mapData.nodes);
    const closestNode = mapData.nodes[closestNodeId];
    
    if (closestNode) {
      let relocatedAny = false;
      const promises = responders
        .filter(r => r.status === 'idle')
        .map(r => {
          const dist = haversineDistance(r.lat, r.lng, closestNode.lat, closestNode.lng);
          // Only update if it is not already at the closest node to avoid recursive state loops
          if (dist > 0.05) {
            relocatedAny = true;
            logMessage(`Stationing standby ${r.name} at nearest unit: ${closestNode.name}`, 'info');
            return updateResponderLocal(r.id, {
              lat: closestNode.lat,
              lng: closestNode.lng
            });
          }
          return Promise.resolve();
        });

      if (relocatedAny) {
        Promise.all(promises).then(() => reloadLocalData());
      }
    }
  }, [selectedIncident, responders]);

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
    const checked = e.target.checked && navigator.onLine;
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

  const handleTabToggle = (tab) => {
    setActiveTab(currentTab => currentTab === tab ? null : tab);
  };

  const weatherSeverity = weather
    ? (weather.weatherCode >= 95 || weather.rainProbability >= 80 ? 'danger'
      : weather.weatherCode >= 51 || weather.rainProbability >= 40 ? 'caution' : 'safe')
    : 'unknown';
  const activeIncidents = incidents.filter(incident => (
    incident.status !== 'resolved' &&
    (incidentTypeFilter === 'all' || incident.type === incidentTypeFilter) &&
    (incidentPriorityFilter === 'all' || incident.priority === incidentPriorityFilter)
  ));

  return (
    <div className={`app-container ${activeTab ? 'sidebar-open' : 'map-focused'}`}>
      {/* Sidebar Controls */}
      {/* 1. Tab Toolbar (Futuristic HUD Navigation) */}
      <nav className="tab-toolbar">
        <div className="brand-icon-wrapper">
          <ShieldAlert size={26} className="brand-logo" />
        </div>
        <div className="tab-buttons">
          <button
            type="button"
            className={`tab-btn ${activeTab === null ? 'active' : ''}`}
            onClick={() => setActiveTab(null)}
            title="Show full-screen map"
          >
            <MapPin size={18} />
            <span className="tab-label">Map View</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => handleTabToggle('planner')}
            title="Tactical Route Planner"
          >
            <Navigation size={18} />
            <span className="tab-label">Routing</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'bustle' ? 'active' : ''}`}
            onClick={() => handleTabToggle('bustle')}
            title="Live Bus Tracker (Bustle)"
          >
            <Bus size={18} />
            <span className="tab-label">Transit</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => handleTabToggle('customers')}
            title="Live Customer Tracker"
          >
            <Users size={18} />
            <span className="tab-label">People</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'business' ? 'active' : ''}`}
            onClick={() => handleTabToggle('business')}
            title="Business Operations Console"
          >
            <Building2 size={18} />
            <span className="tab-label">Business</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => handleTabToggle('alerts')}
            title="Emergencies & Standby"
          >
            <Flame size={18} />
            <span className="tab-label">Alerts</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'shelters' ? 'active' : ''}`}
            onClick={() => handleTabToggle('shelters')}
            title="Evacuation Shelters"
          >
            <Activity size={18} />
            <span className="tab-label">Shelters</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => handleTabToggle('sync')}
            title="Database Sync Console"
          >
            <Wifi size={18} />
            {syncQueueLength > 0 && <span className="tab-badge">{syncQueueLength}</span>}
            <span className="tab-label">Sync</span>
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => handleTabToggle('help')}
            title="User Guide & Help"
          >
            <HelpCircle size={18} />
            <span className="tab-label">Help</span>
          </button>
          <button
            type="button"
            className={`tab-btn auth-nav-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
            title={isAdminAuthenticated ? 'Open account and sync console' : 'Sign in or create an account'}
          >
            {isAdminAuthenticated ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
            <span className="tab-label">{isAdminAuthenticated ? 'Account' : 'Sign in'}</span>
          </button>
        </div>
        <div className="toolbar-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingBottom: '10px' }}>
          <button 
            type="button"
            className="tour-trigger-btn"
            onClick={startOnboardingTour}
            title="Start Onboarding Tour Guide"
            style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              transition: 'all 0.2s',
              outline: 'none',
              marginBottom: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <HelpCircle size={18} />
          </button>
          <span className={`network-dot ${isOnline ? 'online' : 'offline'}`}></span>
        </div>
      </nav>

      {/* 2. active tab sidebar panel */}
      <aside className={`sidebar ${activeTab ? 'open' : 'closed'}`}>
        <header className="sidebar-header" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h1 className="brand-title">
              {activeTab === 'planner' && 'Tactical Planner'}
              {activeTab === 'bustle' && 'Live Bus Tracker'}
              {activeTab === 'customers' && 'Live Customer Tracker'}
              {activeTab === 'business' && 'Business Operations'}
              {activeTab === 'alerts' && 'Emergency Dispatch'}
              {activeTab === 'shelters' && 'Evacuation Safe Hubs'}
              {activeTab === 'sync' && 'System Console'}
              {activeTab === 'help' && 'System Help Guide'}
            </h1>
            <div className="brand-subtitle">
              {activeTab === 'planner' && 'Multi-modal routing & mock navigation'}
              {activeTab === 'bustle' && 'Live private/KSRTC schedule monitor'}
              {activeTab === 'customers' && 'Consent-based location sharing monitor'}
              {activeTab === 'business' && 'Teams, privacy, plans & integrations'}
              {activeTab === 'alerts' && 'File incidents and coordinate response'}
              {activeTab === 'shelters' && 'Active camps capacity & relief tracking'}
              {activeTab === 'sync' && 'Offline sync logs & cluster updates'}
              {activeTab === 'help' && 'Step-by-step written system manual'}
            </div>
          </div>
          <button 
            type="button"
            className="sidebar-close-btn"
            onClick={() => setActiveTab(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'none',
              padding: '0 4px',
              fontWeight: 'bold',
              outline: 'none',
              marginLeft: '0.5rem'
            }}
            title="Collapse Sidebar"
          >
            ✕
          </button>
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

        <div id="onboarding-sidebar-content" className={`sidebar-content ${showTour && tourStep !== 0 && tourStep !== 2 ? 'onboarding-highlight' : ''}`}>
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
                              // Synchronously configure GPS coordinates to start at the selected departure node
                              if (!gpsActive) {
                                const startNode = mapData.nodes[selectedStartNode] || mapData.nodes['vadakkencherry'];
                                setGpsCoords({ lat: startNode.lat, lng: startNode.lng });
                                setGpsActive(true);
                                setMockGpsMode(true);
                              } else if (mockGpsMode) {
                                const startNode = mapData.nodes[selectedStartNode] || mapData.nodes['vadakkencherry'];
                                setGpsCoords({ lat: startNode.lat, lng: startNode.lng });
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

          {activeTab === 'customers' && (
            <>
              <section className="panel-card" style={{ borderLeft: customerTrackingActive ? '3px solid #22c55e' : '1px solid var(--border-color)' }}>
                <h2 className="section-title">
                  <span>Location Sharing</span>
                  <Radio size={14} style={{ color: customerTrackingActive ? '#22c55e' : 'var(--text-muted)' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ fontSize: '0.72rem', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                    Only this device can share its GPS after browser permission. Carrier tower data is not exposed to web apps.
                  </div>
                  <button
                    type="button"
                    onClick={handleCustomerLocationToggle}
                    className={`btn ${customerTrackingActive ? 'btn-success' : 'btn-secondary'}`}
                  >
                    <Locate size={14} />
                    {customerTrackingActive ? 'Stop Sharing This Device' : 'Share This Device Location'}
                  </button>
                  <div style={{ fontSize: '0.65rem', color: customerTrackingActive ? '#4ade80' : 'var(--text-muted)' }}>
                    {customerTrackingActive ? '● Consent active • location updates are visible to dispatch' : '○ Consent inactive • this device is not being tracked'}
                  </div>
                </div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <h2 className="section-title">
                  <span>Customer Locations ({customers.length})</span>
                  <Users size={14} style={{ color: '#f59e0b' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {customers.map(customer => (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() => {
                        setTrackedCustomerId(customer.id);
                        mapRef.current?.setView([customer.lat, customer.lng], 13);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.55rem',
                        color: 'var(--text-primary)',
                        background: trackedCustomerId === customer.id ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.03)',
                        border: trackedCustomerId === customer.id ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: 8, height: 8, flex: '0 0 auto', borderRadius: '50%', background: customer.isSelf && customerTrackingActive ? '#22c55e' : customer.status === 'Moving' ? '#f59e0b' : '#94a3b8' }}></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: '0.75rem' }}>{customer.name}</strong>
                        <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.62rem' }}>{customer.source} • {customer.status}</span>
                      </span>
                      <span style={{ color: '#fbbf24', fontSize: '0.65rem' }}>{customer.speed ? `${customer.speed} km/h` : 'Still'}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '0.65rem', paddingTop: '0.55rem', borderTop: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.62rem' }}>
                  Demo GPS records move locally for testing. Replace them with authenticated backend updates for production use.
                </div>
              </section>
            </>
          )}

          {activeTab === 'business' && (
            <>
              <section className="panel-card" style={{ borderLeft: presentationMode ? '3px solid #22c55e' : '3px solid #64748b' }}>
                <h2 className="section-title">
                  <span>Workspace Controls</span>
                  <Presentation size={14} style={{ color: presentationMode ? '#22c55e' : 'var(--text-muted)' }} />
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label><Languages size={11} style={{ verticalAlign: 'middle' }} /> Language</label>
                    <select value={interfaceLanguage} onChange={(event) => setInterfaceLanguage(event.target.value)}>
                      <option>English</option>
                      <option>Malayalam</option>
                      <option>Hindi</option>
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                    Presentation mode
                    <span className="switch"><input type="checkbox" checked={presentationMode} onChange={(event) => setPresentationMode(event.target.checked)} /><span className="slider"></span></span>
                  </label>
                </div>
                <div style={{ marginTop: '0.55rem', color: 'var(--text-muted)', fontSize: '0.62rem' }}>
                  Interface: {interfaceLanguage} • {presentationMode ? 'Demo data highlighted' : 'Operations mode'}
                </div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #ec4899' }}>
                <h2 className="section-title">
                  <span>Business Setup</span>
                  <Building2 size={14} style={{ color: '#ec4899' }} />
                </h2>
                <form onSubmit={handleBusinessSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Business name</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Enter your business name"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Business / store type</label>
                    <select value={businessStoreType} onChange={(event) => setBusinessStoreType(event.target.value)}>
                      <option>Emergency Services</option>
                      <option>Retail Store</option>
                      <option>Hospital or Clinic</option>
                      <option>School or College</option>
                      <option>Transport Company</option>
                      <option>Security Agency</option>
                      <option>Event Organizer</option>
                      <option>Government Organization</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Business location</label>
                    {businessLocation ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.65rem', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '6px', fontSize: '0.7rem' }}>
                        <span><MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />[{businessLocation.lat.toFixed(5)}, {businessLocation.lng.toFixed(5)}]</span>
                        <button type="button" onClick={() => setBusinessLocation(null)} style={{ border: 0, background: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.65rem' }}>Clear</button>
                      </div>
                    ) : (
                      <div style={{ padding: '0.55rem 0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.68rem' }}>
                        Right-click the map to choose the exact business location.
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Business logo</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleBusinessLogoUpload} />
                  </div>
                  {businessLogo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <img src={businessLogo} alt="Business logo preview" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: '5px', background: '#fff' }} />
                      <span style={{ color: '#4ade80', fontSize: '0.68rem' }}>Logo ready. It will appear beside your business name.</span>
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle2 size={14} /> {businessSetupSaved ? 'Update Business Details' : 'Save Business Details'}
                  </button>
                </form>
              </section>

              {businessSetupSaved && (
                <section className="panel-card" style={{ borderLeft: '3px solid #22c55e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    {businessLogo ? (
                      <img src={businessLogo} alt={`${businessName} logo`} style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: '7px', background: '#fff' }} />
                    ) : (
                      <div style={{ width: 52, height: 52, display: 'grid', placeItems: 'center', borderRadius: '7px', background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}><Building2 size={24} /></div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', color: '#f3f4f6', fontSize: '0.95rem' }}>{businessName}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{businessStoreType} • {businessLocation ? 'Map location saved' : 'Location pending'}</span>
                    </div>
                  </div>
                </section>
              )}

              <section className="panel-card" style={{ borderLeft: '3px solid #14b8a6' }}>
                <h2 className="section-title">
                  <span>Business Directory ({businessDirectory.length})</span>
                  <Building2 size={14} style={{ color: '#14b8a6' }} />
                </h2>
                {businessDirectory.length ? businessDirectory.map(profile => (
                  <div key={`${profile.name}-${profile.location?.lat || 'unknown'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    {profile.logo ? <img src={profile.logo} alt="" style={{ width: 32, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 4 }} /> : <Building2 size={20} style={{ color: '#14b8a6' }} />}
                    <div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: '0.72rem' }}>{profile.name}</strong><span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{profile.storeType} • {profile.location ? `${profile.location.lat.toFixed(4)}, ${profile.location.lng.toFixed(4)}` : 'Location pending'}</span></div>
                    <span style={{ color: '#4ade80', fontSize: '0.6rem' }}>Registered</span>
                  </div>
                )) : <div className="empty-state" style={{ padding: '0.45rem' }}>Save a business profile to add it here.</div>}
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #38bdf8' }}>
                <h2 className="section-title">
                  <span>Operations Overview</span>
                  <BarChart3 size={14} style={{ color: '#38bdf8' }} />
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  {[
                    ['Tracked people', customers.length, '#38bdf8'],
                    ['Sharing now', customers.filter(customer => customer.source === 'Physical GPS' || customer.source === 'Mock GPS').length, '#22c55e'],
                    ['Open geofences', geofenceEvents.length, '#f59e0b'],
                    ['Response units', responders.length, '#a78bfa']
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <strong style={{ display: 'block', color, fontSize: '1.15rem' }}>{value}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #a78bfa' }}>
                <h2 className="section-title">
                  <span>Team Access</span>
                  <ShieldCheck size={14} style={{ color: '#a78bfa' }} />
                </h2>
                <div className="form-group" style={{ marginBottom: '0.55rem' }}>
                  <label>Current workspace role</label>
                  <select value={businessRole} onChange={(event) => setBusinessRole(event.target.value)}>
                    <option>Dispatcher</option>
                    <option>Operations Manager</option>
                    <option>Read-only Analyst</option>
                    <option>Organization Admin</option>
                  </select>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Role permissions are local demo controls. Production access must be enforced by the backend on every request.
                </div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #22c55e' }}>
                <h2 className="section-title">
                  <span>Privacy & Consent</span>
                  <LockKeyhole size={14} style={{ color: '#22c55e' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Location history retention</label>
                    <select value={locationRetentionDays} onChange={(event) => setLocationRetentionDays(Number(event.target.value))}>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    Geofence alerts
                    <span className="switch"><input type="checkbox" checked={geofenceAlertsEnabled} onChange={(event) => setGeofenceAlertsEnabled(event.target.checked)} /><span className="slider"></span></span>
                  </label>
                  <div style={{ color: '#4ade80', fontSize: '0.65rem' }}>Consent log: {customerTrackingActive ? 'This device sharing' : 'No device sharing'} • retention: {locationRetentionDays} days</div>
                </div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <h2 className="section-title">
                  <span>Geofence Activity</span>
                  <Globe2 size={14} style={{ color: '#f59e0b' }} />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {geofenceAlertsEnabled ? geofenceEvents.map(event => (
                    <div key={event.id} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.68rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}><strong>{event.customer}</strong><span style={{ color: event.severity === 'warning' ? '#fbbf24' : '#4ade80' }}>{event.event}</span></div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>{event.zone} • {event.time}</div>
                    </div>
                  )) : <div className="empty-state" style={{ padding: '0.4rem' }}>Geofence alerts paused.</div>}
                </div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #38bdf8' }}>
                <h2 className="section-title">
                  <span>Reports & Data</span>
                  <FileText size={14} style={{ color: '#38bdf8' }} />
                </h2>
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Report range</label>
                    <select value={reportRange} onChange={(event) => setReportRange(event.target.value)}>
                      <option>All activity</option>
                      <option>Today</option>
                      <option>Last 7 days</option>
                      <option>Last 30 days</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={exportOperationsReport} style={{ padding: '0.5rem 0.65rem' }} title="Export operations CSV"><Download size={14} /> CSV</button>
                    <button type="button" className="btn btn-secondary" onClick={() => downloadIncidentPdf()} style={{ padding: '0.5rem 0.65rem' }} title="Export active incidents PDF"><FileText size={14} /> PDF</button>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.62rem' }}>Exports customer locations and incident activity for the current local workspace.</div>
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #ec4899' }}>
                <h2 className="section-title">
                  <span>Plan & Integrations</span>
                  <CircleDollarSign size={14} style={{ color: '#ec4899' }} />
                </h2>
                <div className="form-group" style={{ marginBottom: '0.55rem' }}>
                  <label>Workspace plan</label>
                  <select value={businessPlan} onChange={(event) => setBusinessPlan(event.target.value)}>
                    <option>Starter</option>
                    <option>Operations</option>
                    <option>Enterprise</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.65rem', padding: '0.55rem', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.22)', borderRadius: '6px' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#f9a8d4', fontSize: '0.75rem' }}>{businessPlan} plan</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>{businessPlan === 'Starter' ? '₹999 / month' : businessPlan === 'Operations' ? '₹4,999 / month' : 'Custom pricing'}</span>
                  </div>
                  <button type="button" onClick={handlePaymentRequest} className="btn btn-primary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.68rem' }}>
                    <CircleDollarSign size={12} /> {paymentStatus === 'Checkout ready' ? 'Checkout Ready' : 'Continue to Payment'}
                  </button>
                </div>
                <div style={{ color: paymentStatus === 'Checkout ready' ? '#4ade80' : 'var(--text-muted)', fontSize: '0.62rem', marginBottom: '0.55rem' }}>
                  Payment status: {paymentStatus}. Connect Razorpay, Stripe, or another provider for real payment collection.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.68rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tracked seats</span><strong style={{ color: '#38bdf8' }}>{customers.length} / {businessPlan === 'Starter' ? 25 : businessPlan === 'Operations' ? 250 : 'Unlimited'}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mobile client</span><strong style={{ color: '#fbbf24' }}>Pending</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Realtime API</span><strong style={{ color: '#fbbf24' }}>Backend required</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Carrier tower provider</span><strong style={{ color: '#fbbf24' }}>Partner required</strong></div>
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

                  {/* AI Verification Results Box */}
                  {proofImage && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      fontSize: '0.7rem',
                      marginTop: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>🤖 AI Photo Classifier</span>
                        {modelStatus === 'classifying' && <span className="pulse-dot" style={{ background: '#38bdf8' }}></span>}
                      </div>

                      {modelStatus === 'classifying' && (
                        <div style={{ color: 'var(--text-secondary)' }}>Scanning verification photo for highway hazard cues...</div>
                      )}

                      {modelStatus === 'offline' && (
                        <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                          AI classifier unavailable offline. Incident is recorded for local operator review.
                        </div>
                      )}

                      {modelStatus === 'ready' && aiVerificationResult && (
                        <div>
                          {aiVerificationResult.success ? (
                            <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span>{aiVerificationResult.threatEmoji} AI Verified:</span>
                                <span>{aiVerificationResult.threatName}</span>
                              </div>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 'normal' }}>
                                Detected cues: <strong style={{ textTransform: 'capitalize' }}>{aiVerificationResult.label}</strong> ({aiVerificationResult.confidence}% confidence)
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span>⚠️ Unverified Scene:</span>
                                <span style={{ textTransform: 'capitalize' }}>{aiVerificationResult.label} ({aiVerificationResult.confidence}%)</span>
                              </div>
                              <div style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                Submission Blocked: Uploaded image must display emergency threat cues (Flood, Landslide, Traffic, Fire, or Crash).
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {modelStatus === 'failed' && (
                        <div style={{ color: '#f87171', fontWeight: 'bold' }}>
                          This image could not be verified as a recognized hazard or emergency scene. Submission blocked.
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ marginTop: '0.5rem' }} 
                    disabled={
                      simulationActive || 
                      !proofImage || 
                      modelStatus === 'classifying' || 
                      !aiVerificationResult || 
                      !aiVerificationResult.success
                    }
                  >
                    File Incident Report
                  </button>
                </form>
              </section>

              <section className="panel-card">
                <h2 className="section-title">
                  <span>SOS Fallback Contacts</span>
                  <Phone size={14} style={{ color: '#f87171' }} />
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', margin: '0 0 0.75rem' }}>
                  Contacts are stored on this device. SMS opens the phone messaging app with the incident and location prepared.
                </p>
                <form onSubmit={addSosContact} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.4rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Contact name</label>
                    <input value={sosContactName} onChange={(e) => setSosContactName(e.target.value)} placeholder="Control room" required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Phone number</label>
                    <input value={sosContactPhone} onChange={(e) => setSosContactPhone(e.target.value)} placeholder="+91 9876543210" type="tel" required />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ height: '36px' }}>Save</button>
                </form>
                {sosContacts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.75rem' }}>
                    {sosContacts.map(contact => (
                      <div key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '5px', fontSize: '0.72rem' }}>
                        <span><strong>{contact.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>{contact.phone}</span></span>
                        <button type="button" onClick={() => removeSosContact(contact.id)} className="btn btn-secondary" style={{ color: '#f87171', padding: '0.2rem 0.4rem' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '0.5rem 0 0' }}>Add at least one SOS contact before field testing.</div>
                )}
              </section>

              <section className="panel-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <h2 className="section-title">
                  <span>Emergency call shortcuts</span>
                  <PhoneCall size={14} style={{ color: '#fbbf24' }} />
                </h2>
                <div className="emergency-call-grid">
                  {[
                    ['police', 'Police'],
                    ['fire', 'Fire'],
                    ['medical', 'Medical'],
                    ['disaster', 'Disaster']
                  ].map(([key, label]) => (
                    <a key={key} className="emergency-call-button" href={`tel:${emergencyNumbers[key] || ''}`}>
                      <Phone size={12} /> {label} <strong>{emergencyNumbers[key] || 'Not set'}</strong>
                    </a>
                  ))}
                </div>
                <div className="emergency-number-editor">
                  {[
                    ['police', 'Police number'],
                    ['fire', 'Fire number'],
                    ['medical', 'Medical number'],
                    ['disaster', 'Disaster number']
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input type="tel" value={emergencyNumbers[key] || ''} onChange={(event) => saveEmergencyNumber(key, event.target.value)} />
                    </label>
                  ))}
                </div>
                <div className="field-hint">Numbers are placeholders until your organization configures local services.</div>
              </section>

              {/* Active Incidents Registry */}
              <section className="panel-card">
                <h2 className="section-title">
                  <span>Active Emergencies ({activeIncidents.length}/{incidents.filter(i => i.status !== 'resolved').length})</span>
                  <ShieldAlert size={14} />
                </h2>
                <div className="incident-filter-row">
                  <select value={incidentTypeFilter} onChange={(event) => setIncidentTypeFilter(event.target.value)} aria-label="Filter incidents by type">
                    <option value="all">All types</option>
                    <option value="fire">Fire / landslide</option>
                    <option value="medical">Medical</option>
                    <option value="flood">Flood / rescue</option>
                  </select>
                  <select value={incidentPriorityFilter} onChange={(event) => setIncidentPriorityFilter(event.target.value)} aria-label="Filter incidents by priority">
                    <option value="all">All priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                  </select>
                </div>
                <div className="list-container">
                  {activeIncidents.length === 0 ? (
                    <div className="empty-state">No pending emergency alerts.</div>
                  ) : (
                    activeIncidents.map(inc => {
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
                            <div style={{ marginTop: '0.25rem', color: inc.assignedResponderName ? '#4ade80' : 'var(--text-muted)', fontSize: '0.65rem' }}>
                              {inc.assignedResponderName ? `Auto-assigned: ${inc.assignedResponderName}` : 'Responder: awaiting assignment'}
                            </div>
                            {isActive && (
                              <button type="button" className="btn btn-secondary" onClick={(event) => { event.stopPropagation(); downloadIncidentPdf(inc); }} style={{ marginTop: '0.4rem', padding: '0.25rem 0.4rem', fontSize: '0.62rem' }}>
                                <FileText size={11} /> Export incident PDF
                              </button>
                            )}
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
                            {isActive && sosContacts.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                                {sosContacts.map(contact => (
                                  <div key={contact.id} style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sendSosSms(inc, contact);
                                      }}
                                      className="btn btn-secondary"
                                      style={{ flex: 1, padding: '0.3rem', fontSize: '0.65rem', color: '#fca5a5', borderColor: 'rgba(248,113,113,0.35)' }}
                                      title={`Prepare SOS SMS for ${contact.name}`}
                                    >
                                      <MessageSquare size={11} /> SMS
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        callSosContact(contact);
                                      }}
                                      className="btn btn-secondary"
                                      style={{ padding: '0.3rem', color: '#fca5a5', borderColor: 'rgba(248,113,113,0.35)' }}
                                      title={`Call ${contact.name}`}
                                    >
                                      <Phone size={11} />
                                    </button>
                                  </div>
                                ))}
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
                <section className="auth-screen auth-fullscreen" aria-label="Sign in">
                  <div className="auth-visual">
                    <div className="auth-visual-grid" />
                    <div className="auth-brand"><span className="auth-brand-mark"><ShieldCheck size={18} /></span> DISPATCH<span className="auth-brand-accent">HUB</span></div>
                    <div className="auth-visual-copy">
                      <p className="auth-eyebrow">SECURE OPERATIONS CONSOLE</p>
                      <h1>Ready when<br /><span>every second</span> counts.</h1>
                      <p>Coordinate emergency response with a secure workspace built for teams that cannot afford delays.</p>
                    </div>
                    <div className="auth-status"><span /> Systems operational • Encrypted connection</div>
                  </div>
                  <div className="auth-panel">
                    <div className="auth-panel-inner">
                      <div className="auth-mobile-brand"><span className="auth-brand-mark"><ShieldCheck size={18} /></span> DISPATCH<span className="auth-brand-accent">HUB</span></div>
                      <p className="auth-eyebrow" style={{ color: '#0284c7', marginBottom: '10px' }}>OPERATOR ACCESS</p>
                      <h2>{authMode === 'reset' ? 'Reset your password' : authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
                      <p className="auth-panel-description">
                        {authMode === 'reset' ? 'Enter your work email and we will send recovery instructions.' : authMode === 'signup' ? 'Create a secure operator account for your response team.' : 'Sign in to access the emergency dispatch console.'}
                      </p>
                  <form className="auth-form" onSubmit={handleAdminLogin}>
                    {loginError && (
                      <div className="auth-error">
                        {loginError}
                      </div>
                    )}
                    {authNotice && <div className="auth-notice">{authNotice}</div>}
                    <label htmlFor="admin-email">Work email</label>
                      <input 
                        id="admin-email"
                        type="email" 
                        value={adminUser}
                        onChange={(e) => setAdminUser(e.target.value)}
                        placeholder="name@organization.org"
                        required
                        autoComplete="email"
                        disabled={authLoading}
                      />
                    {authMode !== 'reset' && <label htmlFor="admin-password">Password</label>}
                    {authMode !== 'reset' && <div className="auth-password-field">
                      <input 
                        id="admin-password"
                        type={passwordVisible ? 'text' : 'password'} 
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength="8"
                        autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                        disabled={authLoading}
                      />
                      <button type="button" className="auth-password-toggle" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} disabled={authLoading}>
                        {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>}
                    {authMode === 'signup' && <><label htmlFor="admin-password-confirmation">Confirm password</label><input id="admin-password-confirmation" type={passwordVisible ? 'text' : 'password'} value={adminPasswordConfirmation} onChange={(e) => setAdminPasswordConfirmation(e.target.value)} placeholder="Re-enter your password" required minLength="8" autoComplete="new-password" disabled={authLoading} /></>}
                    <button type="submit" className="auth-submit" disabled={authLoading}>
                      {authLoading ? <><Loader2 size={16} className="auth-spinner" /> Working...</> : authMode === 'reset' ? 'Send reset email' : authMode === 'signup' ? 'Create account' : 'Sign in'}
                    </button>
                    {authMode === 'login' && <button type="button" className="auth-link-button" onClick={() => { setAuthMode('reset'); setLoginError(''); setAuthNotice(''); }}>Forgot password?</button>}
                    <div className="auth-divider">or</div>
                    <p className="auth-switch">
                      {authMode === 'reset' ? 'Remember your password?' : authMode === 'signup' ? 'Already have an account?' : 'Need an operator account?'}{' '}
                      <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setLoginError(''); setAuthNotice(''); }}>{authMode === 'login' ? 'Create one' : 'Sign in'}</button>
                    </p>
                    <small className="auth-privacy">Access is monitored for operational security. By continuing, you agree to your organization’s access policy.</small>
                  </form>
                    </div>
                  </div>
                </section>
              ) : (
                /* Authenticated Sync Tab Content (Audits, Details, Sync Console) */
                <>
                  {/* Terminal Info Card */}
                  <section className="panel-card" style={{ marginBottom: '0.75rem' }}>
                    <h2 className="section-title">
                      <span>Terminal Access Details</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Info size={14} style={{ color: '#38bdf8' }} />
                        <button type="button" className="auth-link-button" onClick={handleAdminLogout}><LogOut size={14} /> Sign out</button>
                      </span>
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Public IP Address:</span>
                        <strong style={{ color: '#38bdf8' }}>Not collected</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Physical Location:</span>
                        <strong style={{ color: '#a855f7' }}>Not collected</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Network Carrier (ISP):</span>
                        <strong style={{ color: '#fbbf24' }}>Not collected</strong>
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
      <main id="onboarding-map" className={`map-viewport ${showTour && tourStep === 2 ? 'onboarding-highlight' : ''}`}>
        {/* Interactive Leaflet Element */}
        <div ref={mapContainerRef} className={`map-container ${mapTheme === 'dark' ? 'map-dark-theme' : 'map-light-theme'}`}></div>
        <div className={`map-search-panel ${showLocationSearch ? 'expanded' : 'collapsed'}`}>
          <button
            type="button"
            className="map-search-toggle"
            onClick={() => setShowLocationSearch(value => !value)}
            aria-expanded={showLocationSearch}
            aria-label={showLocationSearch ? 'Close location search' : 'Open location search'}
            title={showLocationSearch ? 'Close location search' : 'Search location'}
          >
            <Search size={17} />
            {showLocationSearch && <span>Close</span>}
          </button>
          {showLocationSearch && <form onSubmit={searchLocations} className="map-search-form">
            <Search size={14} />
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              placeholder="Search location or landmark"
              aria-label="Search location or landmark"
            />
            <button type="submit" aria-label="Search locations" disabled={locationSearchStatus === 'loading'}>
              {locationSearchStatus === 'loading' ? '…' : 'Go'}
            </button>
          </form>}
          {showLocationSearch && locationSearchStatus === 'offline' && <div className="map-search-message">Search needs a connection. Bundled Kerala map data remains available.</div>}
          {showLocationSearch && locationSearchStatus === 'error' && <div className="map-search-message">Location search failed. Try again.</div>}
          {showLocationSearch && locationResults.length > 0 && (
            <div className="map-search-results">
              {locationResults.map(result => (
                <button type="button" key={`${result.place_id}-${result.lat}`} onClick={() => selectLocationResult(result)}>
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="map-data-status" title="Map data availability">
          <span className={`dot ${isOnline ? 'online' : 'offline'}`}></span>
          {isOnline ? 'Live tiles • local roads ready' : 'Offline • local road data ready'}
          {mapDataStatus !== 'ready' && ` • ${mapDataStatus}`}
        </div>
        
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

        {/* Ambient Weather Particle Overlay */}
        {weatherEffect !== 'clear' && (
          <div className={`weather-overlay ${weatherEffect}`}></div>
        )}

        {/* Map Environment HUD Panel */}
        <div className="map-settings-container" style={{
          position: 'absolute',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.5rem'
        }}>
          <button
            type="button"
            className="map-settings-btn"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            title="Configure Map Environment HUD"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              transition: 'all 0.2s',
              fontSize: '16px',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = '1px solid rgba(168, 85, 247, 0.8)';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '1px solid rgba(168, 85, 247, 0.4)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            }}
          >
            ⚙️
          </button>
          
          {showSettingsPanel && (
            <div className="map-settings-panel" style={{
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              width: '200px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              animation: 'tourFadeIn 0.2s ease',
              color: '#cbd5e1'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', color: '#c084fc', letterSpacing: '0.05em', fontWeight: 800 }}>
                Environment HUD
              </h4>

              <div style={{ padding: '0.55rem', borderRadius: '6px', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#86efac', fontWeight: 700 }}>LIVE WEATHER</span>
                  <button type="button" onClick={() => setWeatherRefreshKey(value => value + 1)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '0.6rem', padding: 0 }}>
                    {weatherStatus === 'loading' ? 'Updating...' : 'Refresh'}
                  </button>
                   <span style={{ fontSize: '0.6rem', color: weatherSeverity === 'danger' ? '#f87171' : weatherSeverity === 'caution' ? '#fbbf24' : '#4ade80', fontWeight: 700 }}>
                    {weatherSeverity === 'danger' ? 'SEVERE' : weatherSeverity === 'caution' ? 'CAUTION' : weatherSeverity === 'safe' ? 'SAFE' : 'UNAVAILABLE'}
                  </span>
                </div>
                {weather ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                      <strong style={{ fontSize: '1.35rem', color: '#e0f2fe' }}>{weather.temperature}°C</strong>
                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{weather.label}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#cbd5e1' }}>
                      <span>💧 {weather.humidity}%</span>
                      <span>🌧️ {weather.rainProbability}%</span>
                      <span>💨 {weather.windSpeed} km/h</span>
                    </div>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.6rem', color: '#94a3b8' }}>
                      Updated {weather.updatedAt ? new Date(weather.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'} • {weather.severity || weatherSeverity}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Loading local conditions...</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#cbd5e1' }}>
                  <span><Volume2 size={12} style={{ verticalAlign: 'middle' }} /> New incident sound</span>
                  <span className="switch"><input type="checkbox" checked={soundAlertsEnabled} onChange={(event) => persistAlertPreference('dispatch_sound_alerts', event.target.checked, setSoundAlertsEnabled)} /><span className="slider"></span></span>
                </label>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#cbd5e1' }}>
                  <span><Vibrate size={12} style={{ verticalAlign: 'middle' }} /> Vibration alerts</span>
                  <span className="switch"><input type="checkbox" checked={vibrationAlertsEnabled} onChange={(event) => persistAlertPreference('dispatch_vibration_alerts', event.target.checked, setVibrationAlertsEnabled)} /><span className="slider"></span></span>
                </label>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#cbd5e1' }}>
                  <span>Automatic responder assignment</span>
                  <span className="switch"><input type="checkbox" checked={autoAssignEnabled} onChange={(event) => persistAlertPreference('dispatch_auto_assign', event.target.checked, setAutoAssignEnabled)} /><span className="slider"></span></span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>MAP STYLE</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                  {[
                    { id: 'dark', label: '🌙 Dark' },
                    { id: 'light', label: '☀️ Light' },
                  ].map(style => (
                    <button 
                      key={style.id}
                      type="button"
                      className="btn"
                      style={{ 
                        padding: '4px 0', 
                        fontSize: '0.7rem', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        background: mapTheme === style.id ? '#a855f7' : 'rgba(255,255,255,0.03)',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                      onClick={() => setMapTheme(style.id)}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>TRAFFIC OVERLAY</label>
                <button 
                  type="button"
                  className="btn"
                  style={{
                    padding: '6px 0',
                    fontSize: '0.7rem',
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: showTraffic ? '#10b981' : 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem'
                  }}
                  onClick={() => setShowTraffic(!showTraffic)}
                >
                  🚦 {showTraffic ? 'Live Traffic: ON' : 'Live Traffic: OFF'}
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>WEATHER EFFECTS</label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {['clear', 'rain', 'mist'].map(fx => (
                    <button 
                      key={fx}
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '4px 2px',
                        fontSize: '0.7rem',
                        textTransform: 'capitalize',
                        border: '1px solid rgba(255,255,255,0.05)',
                        background: weatherEffect === fx ? '#a855f7' : 'rgba(255,255,255,0.03)',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={() => setWeatherEffect(fx)}
                    >
                      {fx}
                    </button>
                  ))}
                </div>
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

      {/* Onboarding Tour Modal Overlay */}
      {showTour && (
        <div className="tour-overlay">
          <div className={`tour-card ${tourStep === 0 ? 'centered' : ''}`}>
            <div className="tour-header">
              <div className="tour-icon">
                {TOUR_STEPS[tourStep].icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 className="tour-title" style={{ margin: 0 }}>{TOUR_STEPS[tourStep].title}</h3>
                <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>
                  {TOUR_STEPS[tourStep].subtitle}
                </span>
              </div>
            </div>
            
            <div className="tour-body">
              {TOUR_STEPS[tourStep].body}
            </div>
            
            <div className="tour-footer">
              <span className="tour-progress">Step {tourStep + 1} of {TOUR_STEPS.length}</span>
              <div className="tour-actions">
                <button type="button" className="tour-btn skip" onClick={handleTourEnd}>
                  Skip
                </button>
                {tourStep > 0 && (
                  <button type="button" className="tour-btn prev" onClick={handleTourPrev}>
                    Back
                  </button>
                )}
                <button type="button" className="tour-btn next" onClick={handleTourNext}>
                  {tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
