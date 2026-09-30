import React, { useState } from 'react';

const HAZARD_TYPES = [
  { id: 'landslide', label: 'Landslide & Debris', icon: '🪨', severity: 'critical' },
  { id: 'flood', label: 'Flash Flood / Road Inundated', icon: '🌊', severity: 'critical' },
  { id: 'tree', label: 'Fallen Tree / Power Cables', icon: '🌲', severity: 'warning' },
  { id: 'bridge', label: 'Bridge / Culvert Submerged', icon: '🌉', severity: 'critical' },
  { id: 'road_damage', label: 'Road Caved In / Mudslip', icon: '🚧', severity: 'warning' }
];

export default function ReportHazardModal({
  isOpen,
  onClose,
  onSubmit,
  currentCoords
}) {
  const [selectedType, setSelectedType] = useState('landslide');
  const [notes, setNotes] = useState('');
  const [sectorName, setSectorName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const hazard = HAZARD_TYPES.find(h => h.id === selectedType) || HAZARD_TYPES[0];
    const coords = currentCoords && currentCoords.lat
      ? currentCoords
      : { lat: 11.5369, lng: 76.1772 }; // Default Wayanad hotspot if no GPS

    onSubmit({
      type: hazard.id,
      label: hazard.label,
      icon: hazard.icon,
      severity: hazard.severity,
      name: sectorName.trim() || `${hazard.label} Hazard Spot`,
      notes: notes.trim(),
      coords
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-hazard-title"
      className="poi-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="poi-modal-content" style={{ maxWidth: '540px' }}>
        <div className="poi-modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div className="poi-modal-title-wrap">
            <span className="poi-modal-icon">🚧</span>
            <div>
              <h3 id="report-hazard-title" className="poi-modal-title" style={{ color: '#f87171' }}>
                Report Field Road Blockage / Hazard
              </h3>
              <p className="poi-modal-subtitle">
                Immediately places barrier and triggers automatic safe detour routing for field squads
              </p>
            </div>
          </div>
          <button type="button" className="poi-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Hazard Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Hazard Classification
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
              {HAZARD_TYPES.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedType(h.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: selectedType === h.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${selectedType === h.id ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: selectedType === h.id ? '#fca5a5' : '#cbd5e1',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{h.icon}</span>
                  <span>{h.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location & Sector Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Road / Sector Location Name
            </label>
            <input
              type="text"
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
              placeholder="e.g. NH-766 Ghat Section, Meppadi-Chooralmala Causeway..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
          </div>

          {/* GPS Location readout */}
          <div style={{
            fontSize: '0.74rem',
            color: '#94a3b8',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>📍 Target GPS Coordinates:</span>
            <code style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
              {currentCoords && currentCoords.lat
                ? `${currentCoords.lat.toFixed(4)}°N, ${currentCoords.lng.toFixed(4)}°E`
                : '11.5369°N, 76.1772°E (Standby Hotspot)'}
            </code>
          </div>

          {/* Field Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Situation Details / Passability
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 meters flood water over road, completely impassable for four-wheelers..."
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '10px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
              }}
            >
              🚧 Place Hazard Barrier & Detour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
