import React, { useMemo } from 'react';
import { haversineDistance } from '../routing';

export default function ProximityScanModal({
  isOpen,
  onClose,
  centerCoords,
  centerName = 'Incident Scene',
  keralaPois = [],
  onRouteTo,
  onShowOnMap
}) {
  // Find all facilities within 5.0 km of centerCoords
  const scanResults = useMemo(() => {
    if (!centerCoords || !centerCoords.lat || !centerCoords.lng) return { hospitals: [], fuel: [], shelters: [], total: 0 };

    const within5km = (keralaPois || [])
      .map(p => {
        const d = haversineDistance(centerCoords.lat, centerCoords.lng, p.lat, p.lng);
        return { ...p, distanceKm: d };
      })
      .filter(p => p.distanceKm <= 5.0)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      hospitals: within5km.filter(p => p.category === 'hospital'),
      fuel: within5km.filter(p => p.category === 'fuel'),
      shelters: within5km.filter(p => p.category === 'shelter' || p.category === 'hotel'),
      all: within5km,
      total: within5km.length
    };
  }, [centerCoords, keralaPois]);

  if (!isOpen || !centerCoords) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proximity-scan-title"
      className="poi-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="poi-modal-content" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="poi-modal-header" style={{ borderBottomColor: 'rgba(56, 189, 248, 0.3)' }}>
          <div className="poi-modal-title-wrap">
            <span className="poi-modal-icon">🎯</span>
            <div>
              <h3 id="proximity-scan-title" className="poi-modal-title" style={{ color: '#38bdf8' }}>
                5.0 KM Tactical Proximity Scan
              </h3>
              <p className="poi-modal-subtitle">
                Center: <strong>{centerName}</strong> ({centerCoords.lat.toFixed(4)}°N, {centerCoords.lng.toFixed(4)}°E)
              </p>
            </div>
          </div>
          <button type="button" className="poi-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Scan Summary Banner */}
        <div style={{
          background: 'rgba(14, 165, 233, 0.12)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#e0f2fe' }}>
            Found <strong>{scanResults.total}</strong> verified facilities within the 5.0 km emergency radius:
          </div>
          <div style={{ display: 'flex', gap: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
            <span style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', padding: '2px 8px', borderRadius: '4px' }}>
              🏥 {scanResults.hospitals.length} Hospitals
            </span>
            <span style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', padding: '2px 8px', borderRadius: '4px' }}>
              ⛽ {scanResults.fuel.length} Fuel
            </span>
            <span style={{ background: 'rgba(139, 92, 246, 0.25)', color: '#ddd6fe', padding: '2px 8px', borderRadius: '4px' }}>
              🛡️ {scanResults.shelters.length} Shelters
            </span>
          </div>
        </div>

        {/* Results List */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {scanResults.all.length > 0 ? (
            scanResults.all.map(poi => (
              <div
                key={`prox-${poi.id}`}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8' }}>
                      ⚡ {poi.distanceKm < 1 ? Math.round(poi.distanceKm * 1000) + ' m' : poi.distanceKm.toFixed(2) + ' km'} away
                    </span>
                    <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: poi.is24x7 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)', color: poi.is24x7 ? '#34d399' : '#94a3b8' }}>
                      {poi.is24x7 ? '🟢 24/7' : 'Standard Hours'}
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                    {poi.category === 'hospital' ? '🏥' : poi.category === 'fuel' ? '⛽' : '🛡️'} {poi.name}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                    📍 {poi.address || poi.district} • {poi.phone && poi.phone !== 'N/A' ? `📞 ${poi.phone}` : 'Verified SEOC Node'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onShowOnMap(poi);
                      onClose();
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#cbd5e1',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🗺️ Show
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRouteTo(poi);
                      onClose();
                    }}
                    style={{
                      background: '#2563eb',
                      border: '1px solid #3b82f6',
                      color: '#ffffff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
                    }}
                  >
                    🧭 Route
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
              <span style={{ fontSize: '2.5rem' }}>📡</span>
              <h4 style={{ color: '#f8fafc', margin: '0.5rem 0 0' }}>No facilities inside 5.0 km radius</h4>
              <p style={{ fontSize: '0.75rem', margin: '4px 0 0' }}>Expand your route or check broader district amenities in the Facilities Directory.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
