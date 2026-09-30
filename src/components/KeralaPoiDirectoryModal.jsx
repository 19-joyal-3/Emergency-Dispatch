import React, { useState, useMemo } from 'react';
import { haversineDistance } from '../routing';

export default function KeralaPoiDirectoryModal({
  isOpen,
  onClose,
  keralaPois = [],
  poiCategories = [],
  showPoiLayer = true,
  onTogglePoiLayer,
  activePoiCategory = 'all',
  onSelectCategory,
  userCoords,
  onShowOnMap,
  onRouteTo
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter facilities by active category and search text
  const filteredPois = useMemo(() => {
    let list = keralaPois || [];
    if (activePoiCategory && activePoiCategory !== 'all') {
      list = list.filter(p => p.category === activePoiCategory);
    }
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p => {
        const name = (p.name || '').toLowerCase();
        const dist = (p.district || '').toLowerCase();
        const addr = (p.address || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return name.includes(q) || dist.includes(q) || addr.includes(q) || cat.includes(q);
      });
    }
    return list;
  }, [keralaPois, activePoiCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="poi-directory-modal-title"
      className="poi-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="poi-modal-content">
        {/* Modal Header */}
        <div className="poi-modal-header">
          <div className="poi-modal-title-wrap">
            <span className="poi-modal-icon">🏥</span>
            <div>
              <h3 id="poi-directory-modal-title" className="poi-modal-title">
                Kerala Amenities & Facilities Directory
              </h3>
              <p className="poi-modal-subtitle">
                210 Verified Locations Across All 14 Districts • Hospitals, Hotels, Pharmacies, Fuel, Shelters & Safety
              </p>
            </div>
          </div>

          <div className="poi-modal-header-actions">
            {/* Master Toggle Switch for Map Layer */}
            <div className="poi-modal-master-toggle-wrap">
              <span className="poi-modal-toggle-label">Map Pins:</span>
              <button
                type="button"
                role="switch"
                aria-checked={showPoiLayer}
                className="poi-modal-master-toggle"
                onClick={onTogglePoiLayer}
                title="Toggle POI pins visibility on main map"
              >
                <span>{showPoiLayer ? 'VISIBLE' : 'HIDDEN'}</span>
                <span className={`modern-toggle-switch ${showPoiLayer ? 'on' : ''}`} style={{ width: '32px', height: '18px', padding: '1px' }}>
                  <span className="toggle-thumb" style={{ width: '14px', height: '14px', transform: showPoiLayer ? 'translateX(14px)' : 'translateX(0)' }} />
                </span>
              </button>
            </div>

            <button
              type="button"
              className="poi-modal-close-btn"
              onClick={onClose}
              aria-label="Close facilities directory"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="poi-modal-categories-bar" role="toolbar" aria-label="Facility Categories">
          {poiCategories.map(cat => {
            const isSelected = activePoiCategory === cat.id;
            return (
              <button
                key={`modal-poi-cat-${cat.id}`}
                type="button"
                className={`poi-modal-cat-pill poi-chip-${cat.id} ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectCategory(cat.id)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
                <span className="cat-count">{cat.count}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Results Sub-Bar */}
        <div className="poi-modal-search-bar">
          <div className="poi-modal-search-box">
            <span className="search-glass">🔍</span>
            <input
              type="text"
              className="poi-modal-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by facility name, town, or district (e.g. Medical College, Taj, IOCL)..."
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="poi-modal-stats-badge">
            Showing <strong>{filteredPois.length}</strong> of {keralaPois.length} facilities
          </div>
        </div>

        {/* Facility Cards Grid */}
        <div className="poi-modal-cards-grid">
          {filteredPois.length > 0 ? (
            filteredPois.map(poi => {
              // Calculate distance if GPS available
              let distText = null;
              if (userCoords && userCoords.lat && userCoords.lng) {
                const d = haversineDistance(userCoords.lat, userCoords.lng, poi.lat, poi.lng);
                distText = d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
              }

              return (
                <div key={`dir-card-${poi.id}`} className="poi-dir-card">
                  <div className="poi-dir-card-header">
                    <div className="poi-dir-badge-group">
                      <span className={`poi-dir-cat-badge cat-${poi.category}`}>
                        {poi.category === 'hospital' ? '🏥 Hospital' :
                         poi.category === 'hotel' ? '🏨 Hotel / Lodging' :
                         poi.category === 'pharmacy' ? '💊 Pharmacy' :
                         poi.category === 'fuel' ? '⛽ Fuel Station' :
                         poi.category === 'police' ? '👮 Police & Safety' :
                         poi.category === 'shelter' ? '🛡️ Shelter' :
                         poi.category === 'food' ? '🍽️ Food & Dining' :
                         poi.category === 'bank' ? '🏦 Bank / ATM' : '📍 Facility'}
                      </span>
                      <span className={`poi-dir-hours-badge ${poi.is24x7 ? 'live-24' : ''}`}>
                        {poi.is24x7 ? '🟢 24/7 OPEN' : (poi.openingHours || 'Standard Hours')}
                      </span>
                    </div>
                    {distText && (
                      <span className="poi-dir-dist-badge">
                        ⚡ {distText}
                      </span>
                    )}
                  </div>

                  <h4 className="poi-dir-card-title">{poi.name}</h4>
                  <div className="poi-dir-card-location">
                    📍 {poi.address || poi.district} <strong style={{ color: '#cbd5e1' }}>({poi.district} Dist.)</strong>
                  </div>
                  <div className="poi-dir-card-desc">
                    {poi.desc}
                  </div>

                  <div className="poi-dir-card-meta">
                    {poi.phone && poi.phone !== 'N/A' && (
                      <div className="poi-dir-phone">
                        <span>📞 Phone:</span>
                        <a href={`tel:${poi.phone}`} className="phone-link">{poi.phone}</a>
                      </div>
                    )}
                    <div className="poi-dir-coords">
                      <span>🌐 GPS:</span>
                      <code>{poi.lat.toFixed(4)}°N, {poi.lng.toFixed(4)}°E</code>
                    </div>
                    <div className="poi-dir-verified">
                      🛡️ Verified: {poi.verifiedBy || 'Kerala State GIS / OSM'}
                    </div>
                  </div>

                  <div className="poi-dir-card-actions">
                    <button
                      type="button"
                      className="poi-action-btn map-btn"
                      onClick={() => onShowOnMap(poi)}
                      title="Center map on this facility"
                    >
                      🗺️ Show on Map
                    </button>
                    <button
                      type="button"
                      className="poi-action-btn route-btn"
                      onClick={() => onRouteTo(poi)}
                      title="Plan emergency route to this destination"
                    >
                      🧭 Route Directly
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="poi-dir-empty-state">
              <span style={{ fontSize: '2.5rem' }}>🔍</span>
              <h4>No facilities match your search</h4>
              <p>Try searching for a different town, district, or switch category filter.</p>
              <button
                type="button"
                className="poi-modal-reset-btn"
                onClick={() => {
                  setSearchQuery('');
                  onSelectCategory('all');
                }}
              >
                Reset Category & Search
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
