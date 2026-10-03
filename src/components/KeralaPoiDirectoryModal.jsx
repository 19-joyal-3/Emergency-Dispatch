import React, { useState, useMemo } from 'react';
import { haversineDistance } from '../routing';

const KERALA_DISTRICTS_LIST = [
  'Thiruvananthapuram',
  'Kollam',
  'Pathanamthitta',
  'Alappuzha',
  'Kottayam',
  'Idukki',
  'Ernakulam',
  'Thrissur',
  'Palakkad',
  'Malappuram',
  'Kozhikode',
  'Wayanad',
  'Kannur',
  'Kasaragod'
];

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
  onRouteTo,
  onTriggerProximityScan
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [only24x7, setOnly24x7] = useState(false);

  // Compute facility count per district
  const districtCounts = useMemo(() => {
    const counts = {};
    (keralaPois || []).forEach(p => {
      if (p.district) {
        counts[p.district] = (counts[p.district] || 0) + 1;
      }
    });
    return counts;
  }, [keralaPois]);

  // Count 24/7 facilities
  const total24x7Count = useMemo(() => {
    return (keralaPois || []).filter(p => p.is24x7).length;
  }, [keralaPois]);

  // Filter facilities by active category, district, 24/7 status, and search text
  const filteredPois = useMemo(() => {
    let list = keralaPois || [];

    // Category filter
    if (activePoiCategory && activePoiCategory !== 'all') {
      list = list.filter(p => p.category === activePoiCategory);
    }

    // District filter
    if (selectedDistrict && selectedDistrict !== 'all') {
      list = list.filter(p => p.district === selectedDistrict);
    }

    // 24/7 filter
    if (only24x7) {
      list = list.filter(p => p.is24x7);
    }

    // Search query filter
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
  }, [keralaPois, activePoiCategory, selectedDistrict, only24x7, searchQuery]);

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
        <div className="mobile-bottom-sheet-handle" aria-hidden="true">
          <span className="bottom-sheet-drag-pill" />
        </div>
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

        {/* Tactical Filters Sub-Bar: 14-District Selector + 24/7 Switch */}
        <div className="poi-modal-filters-subbar">
          {/* District Selector */}
          <div className="poi-filter-group district-filter">
            <span className="filter-label">📍 District:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="poi-district-select"
              aria-label="Filter by Kerala District"
            >
              <option value="all">All 14 Districts ({keralaPois.length})</option>
              {KERALA_DISTRICTS_LIST.map(dist => (
                <option key={`opt-dist-${dist}`} value={dist}>
                  {dist} ({districtCounts[dist] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* 24/7 Emergency Facilities Only Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={only24x7}
            className={`poi-247-filter-toggle ${only24x7 ? 'active' : ''}`}
            onClick={() => setOnly24x7(prev => !prev)}
            title="Filter to 24/7 emergency facilities (trauma care, emergency pumps, all-night pharmacies)"
          >
            <span className="pulse-indicator">🟢</span>
            <span className="toggle-text">24/7 Emergency Only ({total24x7Count})</span>
            <span className={`mini-toggle-pill ${only24x7 ? 'on' : ''}`}>
              <span className="mini-toggle-knob" />
            </span>
          </button>

          {/* 1-Click 5.0 KM Proximity Scan */}
          {onTriggerProximityScan && (
            <button
              type="button"
              className="poi-247-filter-toggle"
              onClick={() => {
                onClose();
                onTriggerProximityScan();
              }}
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
              title="Launch 5.0 km tactical radius proximity scan around current location"
            >
              <span>🎯</span>
              <span className="toggle-text">5.0 km Tactical Scan</span>
            </button>
          )}
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
              placeholder="Search by facility name, town, or specialty (e.g. Medical College, Taj, IOCL, Trauma Care)..."
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
            {selectedDistrict !== 'all' && <span> in {selectedDistrict}</span>}
            {only24x7 && <span> (24/7 Only)</span>}
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
                      🗺️ Show
                    </button>
                    <button
                      type="button"
                      className="poi-action-btn route-btn"
                      onClick={() => onRouteTo(poi)}
                      title="Plan emergency route to this destination"
                    >
                      🧭 Route
                    </button>
                    {onTriggerProximityScan && (
                      <button
                        type="button"
                        className="poi-action-btn"
                        onClick={() => {
                          onClose();
                          onTriggerProximityScan({ lat: poi.lat, lng: poi.lng }, poi.name);
                        }}
                        style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                        title="Scan 5.0 km radius around this facility for nearest emergency amenities"
                      >
                        🎯 5km Scan
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="poi-dir-empty-state">
              <span style={{ fontSize: '2.5rem' }}>🔍</span>
              <h4>No facilities match your active filters</h4>
              <p>Try resetting the district filter, disabling "24/7 Only", or searching for a different term.</p>
              <button
                type="button"
                className="poi-modal-reset-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDistrict('all');
                  setOnly24x7(false);
                  onSelectCategory('all');
                }}
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
