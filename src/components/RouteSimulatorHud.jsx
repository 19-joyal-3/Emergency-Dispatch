import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Volume2, 
  VolumeX, 
  Crosshair, 
  FastForward, 
  ChevronRight, 
  ChevronLeft, 
  Navigation2, 
  Compass, 
  Mountain, 
  Gauge, 
  Clock, 
  MapPin,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { estimateKeralaAltitude } from '../services/elevationService';
import { tacticalVoiceNav } from '../services/tacticalVoiceNavigationService';

/**
 * ==============================================================================
 * ROUTE SIMULATOR & TACTICAL DRIVE REPLAY HUD
 * ==============================================================================
 * Provides an interactive turn-by-turn simulation drive mode along calculated
 * emergency routes across Kerala.
 * 
 * Features:
 *  - Real-time maneuver progression with distance countdown
 *  - Speeds: 1x, 2x, 5x, 10x, 20x
 *  - Interactive scrubber slider to jump to any segment of the route
 *  - Next/Previous turn jumping
 *  - Live elevation & incline gradient reading at vehicle position
 *  - Dynamic voice synthesis turn cues (Web Speech API)
 *  - Smooth map auto-follow panning toggle
 * ==============================================================================
 */

export default function RouteSimulatorHud({
  active,
  route,
  progress = 0, // km
  onSeek,
  isPlaying = true,
  onTogglePlay,
  speedMultiplier = 5,
  onChangeSpeed,
  onStep,
  onReplay,
  onStop,
  autoPan = true,
  onToggleAutoPan,
  transportMode = 'car',
  vehicleHeading = 0,
  vehicleCoords = null,
  startName = 'Origin',
  endName = 'Destination'
}) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLang, setVoiceLang] = useState('en'); // 'en' | 'ml'
  const lastSpokenManeuverRef = useRef('');

  useEffect(() => {
    tacticalVoiceNav.setEnabled(voiceEnabled);
    tacticalVoiceNav.setLanguage(voiceLang);
  }, [voiceEnabled, voiceLang]);

  const totalDistance = route?.distance || 0;
  const progressPercent = totalDistance > 0 ? Math.min(100, Math.max(0, (progress / totalDistance) * 100)) : 0;

  // Compute live altitude at vehicle position
  const currentAltitude = useMemo(() => {
    if (!vehicleCoords || !vehicleCoords.lat) return 25;
    return estimateKeralaAltitude(vehicleCoords.lat, vehicleCoords.lng);
  }, [vehicleCoords]);

  // Maneuvers calculation with step boundaries
  const maneuvers = useMemo(() => {
    if (!route?.steps || route.steps.length === 0) {
      return [
        {
          instruction: `Proceed toward ${endName}`,
          street: 'Main Road Corridor',
          startKm: 0,
          endKm: totalDistance,
          distanceKm: totalDistance,
          type: 'straight'
        }
      ];
    }

    let accumulated = 0;
    return route.steps.map((step, idx) => {
      const stepDist = Number(step.distanceKm) || 0.1;
      const startKm = accumulated;
      const endKm = accumulated + stepDist;
      accumulated = endKm;

      const instLower = (step.instruction || '').toLowerCase();
      let type = 'straight';
      if (instLower.includes('left')) type = instLower.includes('slight') ? 'slight-left' : 'left';
      else if (instLower.includes('right')) type = instLower.includes('slight') ? 'slight-right' : 'right';
      else if (instLower.includes('u-turn') || instLower.includes('uturn')) type = 'uturn';
      else if (instLower.includes('arrive') || instLower.includes('destination') || idx === route.steps.length - 1) type = 'arrive';

      return {
        instruction: step.instruction || 'Continue on route',
        street: step.name || 'Emergency Corridor',
        startKm,
        endKm,
        distanceKm: stepDist,
        type,
        stepIndex: idx
      };
    });
  }, [route, endName, totalDistance]);

  // Determine current active maneuver step
  const activeManeuver = useMemo(() => {
    if (!maneuvers || maneuvers.length === 0) return null;
    const found = maneuvers.find(m => progress >= m.startKm && progress < m.endKm);
    return found || maneuvers[maneuvers.length - 1];
  }, [maneuvers, progress]);

  // Distance remaining to the next turn/maneuver
  const distanceToNextTurnKm = useMemo(() => {
    if (!activeManeuver) return 0;
    return Math.max(0, activeManeuver.endKm - progress);
  }, [activeManeuver, progress]);

  // Next upcoming maneuver after the current one
  const nextUpcomingManeuver = useMemo(() => {
    if (!activeManeuver || !maneuvers) return null;
    const currentIdx = maneuvers.indexOf(activeManeuver);
    if (currentIdx >= 0 && currentIdx + 1 < maneuvers.length) {
      return maneuvers[currentIdx + 1];
    }
    return null;
  }, [activeManeuver, maneuvers]);

  // Dynamic voice synthesizer for upcoming maneuver
  useEffect(() => {
    if (!voiceEnabled || !active || !activeManeuver) return;

    // Trigger voice cue when approaching next turn (<= 350m) or at arrival
    const distMeters = Math.round(distanceToNextTurnKm * 1000);
    const key = `${activeManeuver.stepIndex}_${distMeters < 300 ? 'close' : 'far'}`;

    if (distMeters <= 350 && distMeters > 0 && lastSpokenManeuverRef.current !== key) {
      lastSpokenManeuverRef.current = key;
      const phrase = nextUpcomingManeuver ? nextUpcomingManeuver.instruction : activeManeuver.instruction;
      tacticalVoiceNav.announceManeuver(phrase, distMeters);
    }
  }, [voiceEnabled, active, activeManeuver, distanceToNextTurnKm, nextUpcomingManeuver]);

  if (!active || !route) return null;

  // Jump to specific maneuver index
  const handleJumpToManeuver = (stepIdx) => {
    if (!maneuvers || stepIdx < 0 || stepIdx >= maneuvers.length) return;
    const target = maneuvers[stepIdx];
    if (onSeek) onSeek(target.startKm);
  };

  // Speed calculation for telemetry
  const baseSpeedKmh = transportMode === 'walk' ? 12 : transportMode === 'bus' ? 55 : 75;
  const currentSpeedKmh = Math.round(baseSpeedKmh * (speedMultiplier / 3));

  // Remaining simulated time
  const remainingKm = Math.max(0, totalDistance - progress);
  const remainingMins = currentSpeedKmh > 0 ? Math.ceil((remainingKm / currentSpeedKmh) * 60) : 0;

  // Direction icon helper
  const getTurnIcon = (type) => {
    switch (type) {
      case 'left': return '⬅️';
      case 'slight-left': return '↖️';
      case 'right': return '➡️';
      case 'slight-right': return '↗️';
      case 'uturn': return '🔄';
      case 'arrive': return '🏁';
      default: return '⬆️';
    }
  };

  return (
    <div className="route-simulator-tactical-hud" role="region" aria-label="Tactical Route Simulator Controls">
      {/* Top Banner: Status, Transport Mode & Header */}
      <div className="hud-top-bar">
        <div className="hud-status-badge">
          <span className={`hud-beacon-dot ${isPlaying ? 'running' : 'paused'}`}></span>
          <span className="hud-beacon-label">
            {isPlaying ? 'TACTICAL MISSION SIMULATION' : 'SIMULATION PAUSED'}
          </span>
          <span className="hud-mode-tag">
            {transportMode === 'ambulance' ? '🚑 AMBULANCE' :
             transportMode === 'bus' ? '🚌 BUS CONVOY' :
             transportMode === 'walk' ? '🚶 FOOT PATROL' : '🚗 DISPATCH UNIT'}
          </span>
        </div>

        <div className="hud-top-actions">
          {/* Voice toggle */}
          <button
            type="button"
            className={`hud-icon-btn ${voiceEnabled ? 'active' : ''}`}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? 'Mute Turn Voice Prompts' : 'Enable Voice Prompts'}
          >
            {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          {/* Voice Language Toggle (English / Malayalam) */}
          {voiceEnabled && (
            <button
              type="button"
              className="hud-icon-btn active"
              onClick={() => setVoiceLang(voiceLang === 'en' ? 'ml' : 'en')}
              title={voiceLang === 'en' ? 'Switch to Malayalam (മലയാളം)' : 'Switch to English'}
              style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0 6px', minWidth: '28px' }}
            >
              {voiceLang === 'en' ? 'EN' : 'മല'}
            </button>
          )}

          {/* Auto-Pan follow toggle */}
          <button
            type="button"
            className={`hud-icon-btn ${autoPan ? 'active' : ''}`}
            onClick={onToggleAutoPan}
            title={autoPan ? 'Camera Auto-Following Vehicle' : 'Auto-Pan Disabled'}
          >
            <Crosshair size={13} />
            <span style={{ fontSize: '0.62rem', marginLeft: '3px' }}>FOLLOW</span>
          </button>

          {/* Abort/Exit */}
          <button
            type="button"
            className="hud-exit-btn"
            onClick={onStop}
            title="Exit Simulator"
          >
            <Square size={11} />
            <span>ABORT</span>
          </button>
        </div>
      </div>

      {/* Maneuver Card: Current Street & Turn Guidance */}
      <div className="hud-maneuver-card">
        <div className="hud-turn-icon-box">
          <span className="hud-turn-emoji">
            {getTurnIcon(activeManeuver?.type)}
          </span>
        </div>

        <div className="hud-maneuver-content">
          <div className="hud-maneuver-distance">
            {distanceToNextTurnKm < 1 
              ? `In ${Math.round(distanceToNextTurnKm * 1000)} m` 
              : `In ${distanceToNextTurnKm.toFixed(1)} km`}
          </div>
          <div className="hud-maneuver-instruction">
            {activeManeuver?.instruction || 'Proceed along designated corridor'}
          </div>
          {activeManeuver?.street && activeManeuver.street !== 'Emergency Corridor' && (
            <div className="hud-maneuver-street">
              <MapPin size={10} style={{ display: 'inline', marginRight: '3px' }} />
              {activeManeuver.street}
            </div>
          )}
        </div>

        {/* Telemetry Capsule */}
        <div className="hud-telemetry-capsule">
          <div className="hud-telemetry-item" title="Simulated Vehicle Speed">
            <Gauge size={11} className="hud-tele-icon" />
            <span className="hud-tele-val">{currentSpeedKmh}</span>
            <span className="hud-tele-unit">km/h</span>
          </div>

          <div className="hud-telemetry-item" title="Vehicle Heading">
            <Compass size={11} className="hud-tele-icon" />
            <span className="hud-tele-val">{Math.round(vehicleHeading)}°</span>
          </div>

          <div className="hud-telemetry-item" title="Topographic Altitude">
            <Mountain size={11} className="hud-tele-icon" />
            <span className="hud-tele-val">{currentAltitude}</span>
            <span className="hud-tele-unit">m</span>
          </div>
        </div>
      </div>

      {/* Interactive Route Scrubber */}
      <div className="hud-scrubber-section">
        <div className="hud-scrubber-labels">
          <span className="hud-scrub-label origin" title={startName}>
            📍 {startName.length > 18 ? startName.slice(0, 18) + '...' : startName}
          </span>
          <span className="hud-scrub-metric">
            <strong style={{ color: '#38bdf8' }}>{progress.toFixed(1)} km</strong> / {totalDistance.toFixed(1)} km ({Math.round(progressPercent)}%)
          </span>
          <span className="hud-scrub-label dest" title={endName}>
            🏁 {endName.length > 18 ? endName.slice(0, 18) + '...' : endName}
          </span>
        </div>

        <div className="hud-slider-track-wrap">
          <input
            type="range"
            min={0}
            max={totalDistance}
            step={0.1}
            value={progress}
            onChange={(e) => onSeek && onSeek(parseFloat(e.target.value))}
            className="hud-slider-range"
            aria-label="Route progress scrubber"
          />
          <div 
            className="hud-slider-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Bottom Playback & Speed Controls */}
      <div className="hud-controls-row">
        <div className="hud-playback-btns">
          {/* Replay */}
          <button
            type="button"
            className="hud-ctrl-btn"
            onClick={onReplay}
            title="Restart Journey from Origin"
          >
            <RotateCcw size={13} />
          </button>

          {/* Step Back (Prev Maneuver) */}
          <button
            type="button"
            className="hud-ctrl-btn"
            onClick={() => {
              if (activeManeuver && activeManeuver.stepIndex > 0) {
                handleJumpToManeuver(activeManeuver.stepIndex - 1);
              } else if (onStep) {
                onStep(-1.0);
              }
            }}
            title="Jump to Previous Turn (-1 km)"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Play / Pause Primary Action */}
          <button
            type="button"
            className={`hud-ctrl-btn hud-play-pause-btn ${isPlaying ? 'playing' : 'paused'}`}
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: '2px' }} />}
          </button>

          {/* Step Forward (Next Maneuver) */}
          <button
            type="button"
            className="hud-ctrl-btn"
            onClick={() => {
              if (activeManeuver && activeManeuver.stepIndex < maneuvers.length - 1) {
                handleJumpToManeuver(activeManeuver.stepIndex + 1);
              } else if (onStep) {
                onStep(1.0);
              }
            }}
            title="Jump to Next Turn (+1 km)"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Speed Multipliers */}
        <div className="hud-speed-selector" role="radiogroup" aria-label="Simulation Speed">
          {[1, 2, 5, 10, 20].map((spd) => (
            <button
              key={spd}
              type="button"
              className={`hud-speed-pill ${speedMultiplier === spd ? 'active' : ''}`}
              onClick={() => onChangeSpeed && onChangeSpeed(spd)}
              title={`${spd}x Real-time Drive Speed`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Time ETA remaining */}
        <div className="hud-eta-badge">
          <Clock size={11} style={{ marginRight: '4px', color: '#10b981' }} />
          <span>~{remainingMins} min ETA</span>
        </div>
      </div>
    </div>
  );
}
