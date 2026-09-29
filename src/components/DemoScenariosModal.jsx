import React from 'react';
import { Zap, Mountain, Waves, CloudRain, RotateCcw, X, Play, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const DEMO_SCENARIOS = [
  {
    id: 'wayanad_landslide',
    title: 'Wayanad Landslide Ridge Rescue',
    subtitle: 'Chooralmala to Meppadi Emergency Camp',
    badge: 'Landslide Reroute',
    badgeColor: '#ef4444',
    icon: Mountain,
    iconColor: '#f87171',
    description: 'Simulates the washed-out bridge at Chooralmala. Drops a 5.0 KM hazard perimeter blockage, calculates an alternate mountain ridge route, speaks Malayalam voice warning, and starts vehicle traversal.',
    route: {
      start: { name: 'Chooralmala', lat: 11.5369, lng: 76.1772, district: 'Wayanad' },
      end: { name: 'Meppadi Emergency Camp', lat: 11.5516, lng: 76.1264, district: 'Wayanad' },
      blockage: { lat: 11.5420, lng: 76.1550, name: 'Chooralmala Bridge Washout' }
    },
    voiceTextMl: 'അടിയന്തര മുന്നറിയിപ്പ്! മുന്നിൽ ഉരുൾപൊട്ടൽ സാധ്യത. ബദൽ റൂട്ട് കണക്കാക്കുന്നു.',
    voiceTextEn: 'Emergency alert! Landslide hazard ahead. Calculating alternate mountain ridge bypass.',
    talkingPoint: 'Demonstrates offline real-road routing, 5.0 KM hazard detour, elevation slope warning, and hands-free Malayalam voice guidance.'
  },
  {
    id: 'dam_spill_basin',
    title: 'Banasurasagar Dam Spilling Emergency',
    subtitle: 'KSDMA Rule Curve & Downstream Basin Warning',
    badge: 'Dam & Flood Corridor',
    badgeColor: '#f97316',
    icon: Waves,
    iconColor: '#fb923c',
    description: 'Triggers Orange Alert state for Banasurasagar reservoir. Opens live KSDMA telemetry modal, focuses on the Kabini downstream flood basin, and intercepts active dispatch paths.',
    focusCoords: [11.6667, 75.9556],
    focusZoom: 12,
    openDamModal: true,
    voiceTextMl: 'ശ്രദ്ധിക്കുക! ബാണാസുരസാഗർ ഡാം ഓറഞ്ച് അലർട്ട്. നദീതീരങ്ങളിൽ ഉള്ളവർ ജാഗ്രത പാലിക്കുക.',
    voiceTextEn: 'Warning! Banasurasagar Dam Orange Alert. Downstream river corridor flood warning active.',
    talkingPoint: 'Demonstrates live state dam monitoring, Central Water Commission Rule Curves, and downstream river flood intercept.'
  },
  {
    id: 'kuttanad_flood',
    title: 'Kuttanad Monsoon Inundation Corridor',
    subtitle: 'Alappuzha MCH to Changanassery Relief Hub',
    badge: 'Monsoon Flood Bypass',
    badgeColor: '#38bdf8',
    icon: CloudRain,
    iconColor: '#38bdf8',
    description: 'Simulates the submerged AC Road in Kuttanad. Bypasses the flooded corridor, activates the 14-District IMD weather warning matrix, and starts high-ground emergency transit.',
    route: {
      start: { name: 'Alappuzha Medical College', lat: 9.4981, lng: 76.3388, district: 'Alappuzha' },
      end: { name: 'Changanassery Relief Center', lat: 9.4449, lng: 76.5398, district: 'Kottayam' },
      blockage: { lat: 9.4750, lng: 76.4400, name: 'AC Road Submerged Inundation' }
    },
    voiceTextMl: 'മുന്നറിയിപ്പ്! റോഡിൽ കനത്ത വെള്ളക്കെട്ട്. ഉയർന്ന റൂട്ടിലൂടെയുള്ള വഴി തിരഞ്ഞെടുത്തു.',
    voiceTextEn: 'Warning! Severe road waterlogging. Elevated high-ground bypass active.',
    talkingPoint: 'Demonstrates multi-district weather matrix, spatial route threat interception, and safe high-ground navigation.'
  }
];

export default function DemoScenariosModal({
  isOpen,
  onClose,
  onLaunchScenario,
  onResetScenario,
  activeScenarioId
}) {
  if (!isOpen) return null;

  return (
    <div className="tactical-command-backdrop" onClick={onClose} style={{ zIndex: 10500 }}>
      <div
        className="tactical-command-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="1-Click Live Presentation Demo Scenarios"
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
          background: 'rgba(8, 14, 24, 0.95)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.2))',
              border: '1px solid rgba(234, 179, 8, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#facc15'
            }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  1-Click Presentation Demo Scenarios
                </h2>
                <span style={{
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  color: '#fde047',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  PRESENTER MODE
                </span>
              </div>
              <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0 }}>
                Instant emergency simulation triggers for hackathon & panel evaluations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.72rem',
            color: '#cbd5e1',
            lineHeight: 1.45
          }}>
            💡 <strong>Presenter Tip:</strong> Click any scenario below during your presentation. Resylix will automatically set the origin/destination, apply the hazard blockages, trigger Malayalam voice alerts, and start the live vehicle simulation!
          </div>

          {/* Scenario Cards */}
          {DEMO_SCENARIOS.map((scen) => {
            const Icon = scen.icon;
            const isActive = activeScenarioId === scen.id;

            return (
              <div
                key={scen.id}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.12))'
                    : 'rgba(11, 20, 36, 0.8)',
                  border: `1px solid ${isActive ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}`,
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  position: 'relative',
                  boxShadow: isActive ? '0 0 16px rgba(56, 189, 248, 0.25)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: `1px solid ${scen.badgeColor}55`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: scen.iconColor
                    }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                          {scen.title}
                        </span>
                        <span style={{
                          background: `${scen.badgeColor}22`,
                          border: `1px solid ${scen.badgeColor}66`,
                          color: scen.badgeColor,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {scen.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {scen.subtitle}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="scenario-launch-btn"
                    onClick={() => onLaunchScenario(scen)}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #0284c7, #2563eb)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '0.42rem 0.85rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    {isActive ? <CheckCircle2 size={14} /> : <Play size={14} />}
                    {isActive ? 'Running' : 'Launch 1-Click'}
                  </button>
                </div>

                <p style={{ fontSize: '0.72rem', color: '#cbd5e1', margin: 0, lineHeight: 1.45 }}>
                  {scen.description}
                </p>

                <div style={{
                  background: 'rgba(8, 14, 24, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.65rem',
                  color: '#94a3b8'
                }}>
                  <strong style={{ color: '#38bdf8' }}>Demo Talking Point:</strong> {scen.talkingPoint}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid rgba(56, 189, 248, 0.2)',
          background: 'rgba(8, 14, 24, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={onResetScenario}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <RotateCcw size={14} /> Reset Map to Standby
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
