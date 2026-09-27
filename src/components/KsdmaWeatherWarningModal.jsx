import React, { useState } from 'react';
import { 
  CloudRain, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Phone, 
  ExternalLink, 
  X, 
  Search, 
  Compass, 
  Info,
  Droplets,
  PhoneCall
} from 'lucide-react';
import { 
  KSDMA_ALERT_TYPES, 
  KERALA_DISTRICTS_DATA, 
  getDistrictWarningSummary 
} from '../services/ksdmaWeatherWarningService.js';

export default function KsdmaWeatherWarningModal({
  isOpen,
  onClose,
  onFocusDistrictOnMap,
  activeRouteWeatherAlerts = []
}) {
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN'
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const summary = getDistrictWarningSummary();

  const filteredDistricts = KERALA_DISTRICTS_DATA.filter(district => {
    // Tab filter
    if (filterTab !== 'all' && district.alert !== filterTab) return false;
    
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = district.name.toLowerCase().includes(q);
      const matchMl = district.malayalam.toLowerCase().includes(q);
      const matchThreat = district.primaryThreat.toLowerCase().includes(q);
      const matchHotspot = district.vulnerableHotspots.some(h => h.toLowerCase().includes(q));
      if (!matchName && !matchMl && !matchThreat && !matchHotspot) return false;
    }
    return true;
  });

  const getAlertColor = (alert) => {
    switch (alert) {
      case 'RED': return '#ef4444';
      case 'ORANGE': return '#f97316';
      case 'YELLOW': return '#eab308';
      default: return '#10b981';
    }
  };

  return (
    <div className="tactical-command-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="tactical-command-dialog ksdma-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="KSDMA Weather Warning Matrix"
      >
        {/* Modal Header */}
        <div className="ksdma-modal-header">
          <div className="ksdma-header-title-group">
            <div className="ksdma-badge-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
              <CloudRain size={20} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div className="ksdma-main-title">
                <span>KSDMA & IMD Weather Warning Matrix</span>
                <span className="ksdma-live-tag" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
                  <span className="ksdma-live-dot" style={{ background: '#ef4444' }} />
                  Official Bulletin
                </span>
              </div>
              <div className="ksdma-sub-title">
                കേരള സംസ്ഥാന ദുരന്ത നിവാരണ അതോറിറ്റി — 14 ജില്ലകളിലെ കാലാവസ്ഥാ മുന്നറിയിപ്പുകൾ • {summary.bulletinDate}
              </div>
            </div>
          </div>

          <div className="ksdma-header-actions">
            <a 
              href="https://sdma.kerala.gov.in/weather-warning/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ksdma-btn-official"
              title="Open Official KSDMA Weather Warning Bulletin"
            >
              <span>KSDMA Portal</span>
              <ExternalLink size={12} />
            </a>
            <button 
              type="button" 
              className="command-close-btn" 
              onClick={onClose}
              aria-label="Close Weather Warning Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Active Route Weather Interception Banner */}
        {activeRouteWeatherAlerts.length > 0 && (
          <div style={{
            background: 'rgba(127, 29, 29, 0.35)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '0.6rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.75rem'
          }}>
            <ShieldAlert size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Route Traverses Hazard Zones ({activeRouteWeatherAlerts.length} District Warnings):
              </strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                {activeRouteWeatherAlerts.map(a => (
                  <span 
                    key={a.districtId} 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(153, 27, 27, 0.6)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      color: '#fee2e2'
                    }}
                  >
                    <strong>{a.districtName}</strong>: {a.alertLevel} Alert ({a.threat})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Telemetry Summary KPI Ribbon */}
        <div className="ksdma-kpi-ribbon">
          <div className="ksdma-kpi-item" onClick={() => setFilterTab('all')} style={{ cursor: 'pointer' }}>
            <span className="ksdma-kpi-label">Districts</span>
            <span className="ksdma-kpi-val text-white">{summary.totalDistricts}</span>
          </div>
          <div className="ksdma-kpi-item" onClick={() => setFilterTab('RED')} style={{ cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="ksdma-kpi-label">Red Alert</span>
            <span className="ksdma-kpi-val" style={{ color: '#ef4444' }}>{summary.counts.RED}</span>
          </div>
          <div className="ksdma-kpi-item" onClick={() => setFilterTab('ORANGE')} style={{ cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="ksdma-kpi-label">Orange Alert</span>
            <span className="ksdma-kpi-val" style={{ color: '#f97316' }}>{summary.counts.ORANGE}</span>
          </div>
          <div className="ksdma-kpi-item" onClick={() => setFilterTab('YELLOW')} style={{ cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="ksdma-kpi-label">Yellow Alert</span>
            <span className="ksdma-kpi-val" style={{ color: '#eab308' }}>{summary.counts.YELLOW}</span>
          </div>
          <div className="ksdma-kpi-item" onClick={() => setFilterTab('GREEN')} style={{ cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="ksdma-kpi-label">Normal</span>
            <span className="ksdma-kpi-val" style={{ color: '#10b981' }}>{summary.counts.GREEN}</span>
          </div>
          <div className="ksdma-kpi-item" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="ksdma-kpi-label">SEOC Helpline</span>
            <a href="tel:1070" className="ksdma-kpi-val" style={{ color: '#facc15', textDecoration: 'none' }}>1070</a>
          </div>
        </div>

        {/* Filter Tabs & Search Controls */}
        <div className="ksdma-control-bar">
          <div className="ksdma-tabs">
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All 14 Districts
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'RED' ? 'active alert-highlight' : ''}`}
              onClick={() => setFilterTab('RED')}
              style={filterTab === 'RED' ? { borderColor: '#ef4444', color: '#f87171' } : {}}
            >
              Red Alerts ({summary.counts.RED})
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'ORANGE' ? 'active alert-highlight' : ''}`}
              onClick={() => setFilterTab('ORANGE')}
              style={filterTab === 'ORANGE' ? { borderColor: '#f97316', color: '#fb923c' } : {}}
            >
              Orange ({summary.counts.ORANGE})
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'YELLOW' ? 'active alert-highlight' : ''}`}
              onClick={() => setFilterTab('YELLOW')}
              style={filterTab === 'YELLOW' ? { borderColor: '#eab308', color: '#facc15' } : {}}
            >
              Yellow ({summary.counts.YELLOW})
            </button>
          </div>

          <div className="ksdma-search-wrap">
            <Search size={14} className="ksdma-search-icon" />
            <input 
              type="text" 
              className="ksdma-search-input"
              placeholder="Search district, threat, hotspot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="ksdma-search-clear" 
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Content Body: District Cards Grid */}
        <div className="ksdma-modal-body">
          {filteredDistricts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '0.85rem' }}>
              No districts match your filter or search criteria.
            </div>
          ) : (
            <div className="ksdma-grid">
              {filteredDistricts.map(district => {
                const alertColor = getAlertColor(district.alert);
                const isRed = district.alert === 'RED';
                const isOrange = district.alert === 'ORANGE';

                return (
                  <div 
                    key={district.id} 
                    className="ksdma-dam-card"
                    style={{
                      borderColor: (isRed || isOrange) ? `${alertColor}55` : 'rgba(255,255,255,0.08)',
                      background: (isRed || isOrange) ? 'rgba(15, 23, 42, 0.8)' : 'rgba(15, 23, 42, 0.5)'
                    }}
                  >
                    {/* Top Row: Name and Alert Pill */}
                    <div className="ksdma-dam-top">
                      <div className="ksdma-dam-meta">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-white" style={{ fontSize: '0.9rem' }}>{district.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({district.malayalam})</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={10} style={{ color: '#38bdf8' }} />
                          {district.centroid[0].toFixed(3)}°N, {district.centroid[1].toFixed(3)}°E
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: `${alertColor}22`,
                            color: alertColor,
                            border: `1px solid ${alertColor}66`
                          }}
                        >
                          {district.alert} ALERT
                        </span>
                        <span 
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Droplets size={10} />
                          {district.rainfallMm} mm
                        </span>
                      </div>
                    </div>

                    {/* Threat Details */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      margin: '0.5rem 0',
                      fontSize: '0.72rem',
                      lineHeight: '1.4'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', fontWeight: 600, marginBottom: '2px' }}>
                        <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
                        Primary Threat: <span style={{ color: alertColor }}>{district.primaryThreat}</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                        {district.primaryThreatMl}
                      </div>
                    </div>

                    {/* Advisory */}
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      lineHeight: '1.35',
                      marginBottom: '0.5rem',
                      paddingLeft: '0.2rem'
                    }}>
                      <strong style={{ color: '#e2e8f0' }}>KSDMA Advisory: </strong>
                      {district.advisory}
                    </div>

                    {/* Hotspots */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '0.6rem' }}>
                      {district.vulnerableHotspots.map((spot, i) => (
                        <span 
                          key={i}
                          style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#94a3b8',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                        >
                          {spot}
                        </span>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                      <a 
                        href={`tel:${district.deocPhone}`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#34d399',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <Phone size={11} />
                        <span>DEOC {district.deocPhone}</span>
                      </a>

                      <button 
                        type="button"
                        onClick={() => {
                          onFocusDistrictOnMap?.(district);
                          onClose();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: 'rgba(56, 189, 248, 0.18)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <Compass size={11} />
                        <span>Focus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: '#64748b',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
              <PhoneCall size={12} style={{ color: '#facc15' }} />
              State SEOC Helpline: <strong style={{ color: '#fff' }}>1070</strong>
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
              District DEOC Helpline: <strong style={{ color: '#fff' }}>1077</strong>
            </span>
          </div>

          <div>
            <a 
              href="https://sdma.kerala.gov.in/weather-warning/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <span>KSDMA Official Weather Hazard Documentation</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
