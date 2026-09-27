import React, { useState, useEffect } from 'react';
import { 
  Waves, 
  ExternalLink, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Search, 
  MapPin, 
  Phone, 
  PhoneCall, 
  RefreshCw, 
  X,
  Droplets,
  Layers,
  Building2,
  Navigation
} from 'lucide-react';
import { 
  KSDMA_RESERVOIRS, 
  KSDMA_OFFICIAL_URLS, 
  KSDMA_EMERGENCY_CONTACTS, 
  fetchKsdmaDamStatus 
} from '../services/ksdmaLiveService';
import { KERALA_DEOC_DIRECTORY } from '../deoc';

export default function KsdmaDamMonitorModal({
  isOpen,
  onClose,
  onFocusDamOnMap
}) {
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'alerts' | 'kseb' | 'irrigation' | 'hotlines'
  const [searchQuery, setSearchQuery] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTelemetry();
    }
  }, [isOpen]);

  const loadTelemetry = async () => {
    setLoading(true);
    try {
      const data = await fetchKsdmaDamStatus();
      setTelemetry(data);
    } catch (_err) {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const allDams = telemetry?.dams || KSDMA_RESERVOIRS;
  const summary = telemetry?.summary || {
    total: allDams.length,
    normal: allDams.filter(d => d.alertLevel === 'Normal').length,
    blue: allDams.filter(d => d.alertLevel === 'Blue').length,
    orange: allDams.filter(d => d.alertLevel === 'Orange').length,
    red: allDams.filter(d => d.alertLevel === 'Red').length,
    activeAlertsTotal: allDams.filter(d => d.alertLevel !== 'Normal').length
  };

  // Filter dams based on active tab and search query
  const filteredDams = allDams.filter(dam => {
    // Tab filter
    if (filterTab === 'alerts' && dam.alertLevel === 'Normal') return false;
    if (filterTab === 'kseb' && dam.agency !== 'KSEB') return false;
    if (filterTab === 'irrigation' && dam.agency !== 'IRRIGATION') return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      dam.name.toLowerCase().includes(q) ||
      dam.malayalam.includes(q) ||
      dam.district.toLowerCase().includes(q) ||
      dam.basin.toLowerCase().includes(q) ||
      dam.agency.toLowerCase().includes(q) ||
      dam.downstreamCorridor.toLowerCase().includes(q)
    );
  });

  const getAlertBadgeClass = (level) => {
    switch (level) {
      case 'Red': return 'alert-red-pulse';
      case 'Orange': return 'alert-orange-pulse';
      case 'Blue': return 'alert-blue-stage';
      default: return 'alert-normal-stage';
    }
  };

  const getStorageColor = (pct, alertLevel) => {
    if (alertLevel === 'Red') return '#ef4444';
    if (alertLevel === 'Orange') return '#f97316';
    if (alertLevel === 'Blue') return '#38bdf8';
    if (pct > 85) return '#eab308';
    return '#10b981';
  };

  return (
    <div className="tactical-command-backdrop" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="tactical-command-dialog ksdma-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="KSDMA Reservoir and Dam Water Level Telemetry"
      >
        {/* Modal Header */}
        <div className="ksdma-modal-header">
          <div className="ksdma-header-title-group">
            <div className="ksdma-badge-icon">
              <Waves size={20} className="text-cyan-400" />
            </div>
            <div>
              <div className="ksdma-main-title">
                <span>KSDMA Dam Water Levels & Rule Curves</span>
                <span className="ksdma-live-tag">
                  <span className="ksdma-live-dot" />
                  {telemetry?.isLive ? 'SEOC Live' : 'Baseline Active'}
                </span>
              </div>
              <div className="ksdma-sub-title">
                കേരള സംസ്ഥാന ദുരന്ത നിവാരണ അതോറിറ്റി — ജലനിരപ്പും അണക്കെട്ട് മുൻകരുതലുകളും
              </div>
            </div>
          </div>

          <div className="ksdma-header-actions">
            <a 
              href={KSDMA_OFFICIAL_URLS.DAM_WATER_LEVELS} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ksdma-btn-official"
              title="Open Official KSDMA Dam Water Level Bulletin"
            >
              <span>KSDMA Portal</span>
              <ExternalLink size={12} />
            </a>
            <button 
              type="button" 
              className="ksdma-btn-refresh" 
              onClick={loadTelemetry}
              disabled={loading}
              title="Refresh Reservoir Telemetry"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
            <button 
              type="button" 
              className="command-close-btn" 
              onClick={onClose}
              aria-label="Close Reservoir Telemetry Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Telemetry Summary KPI Ribbon */}
        <div className="ksdma-kpi-ribbon">
          <div className="ksdma-kpi-item">
            <span className="ksdma-kpi-label">Monitored Reservoirs</span>
            <span className="ksdma-kpi-val text-white">{summary.total}</span>
          </div>
          <div className="ksdma-kpi-item border-l border-zinc-800">
            <span className="ksdma-kpi-label">Normal Storage</span>
            <span className="ksdma-kpi-val text-emerald-400">{summary.normal}</span>
          </div>
          <div className="ksdma-kpi-item border-l border-zinc-800">
            <span className="ksdma-kpi-label">Blue Alerts</span>
            <span className="ksdma-kpi-val text-sky-400">{summary.blue}</span>
          </div>
          <div className="ksdma-kpi-item border-l border-zinc-800">
            <span className="ksdma-kpi-label">Orange Alerts</span>
            <span className="ksdma-kpi-val text-amber-400">{summary.orange}</span>
          </div>
          <div className="ksdma-kpi-item border-l border-zinc-800">
            <span className="ksdma-kpi-label">Red Alerts</span>
            <span className="ksdma-kpi-val text-rose-400">{summary.red}</span>
          </div>
          <div className="ksdma-kpi-item border-l border-zinc-800">
            <span className="ksdma-kpi-label">SEOC Helpline</span>
            <a href="tel:1070" className="ksdma-kpi-val text-yellow-400 hover:underline">1070</a>
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
              All Dams ({allDams.length})
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'alerts' ? 'active alert-highlight' : ''}`}
              onClick={() => setFilterTab('alerts')}
            >
              Active Alerts ({summary.activeAlertsTotal})
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'kseb' ? 'active' : ''}`}
              onClick={() => setFilterTab('kseb')}
            >
              KSEB Hydro (10)
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'irrigation' ? 'active' : ''}`}
              onClick={() => setFilterTab('irrigation')}
            >
              Irrigation (14)
            </button>
            <button 
              type="button"
              className={`ksdma-tab-btn ${filterTab === 'hotlines' ? 'active' : ''}`}
              onClick={() => setFilterTab('hotlines')}
            >
              SEOC / DEOC Directory
            </button>
          </div>

          {filterTab !== 'hotlines' && (
            <div className="ksdma-search-wrapper">
              <Search size={14} className="ksdma-search-icon" />
              <input 
                type="text" 
                placeholder="Search dam, district, river basin (e.g. Idukki, Periyar)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ksdma-search-input"
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
          )}
        </div>

        {/* Content Body */}
        <div className="ksdma-modal-body">
          {filterTab === 'hotlines' ? (
            /* SEOC and 14-District DEOC Directory */
            <div className="ksdma-hotlines-container">
              {/* SEOC Main Spotlight */}
              <div className="ksdma-seoc-card">
                <div className="ksdma-seoc-header">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={20} className="text-amber-400" />
                    <div>
                      <strong className="text-white text-sm">
                        {KSDMA_EMERGENCY_CONTACTS.SEOC.name}
                      </strong>
                      <div className="text-xs text-zinc-400">
                        {KSDMA_EMERGENCY_CONTACTS.SEOC.malayalam}
                      </div>
                    </div>
                  </div>
                  <a 
                    href={`tel:${KSDMA_EMERGENCY_CONTACTS.SEOC.tollFree}`} 
                    className="ksdma-call-pill seoc"
                  >
                    <PhoneCall size={14} />
                    <span>Dial {KSDMA_EMERGENCY_CONTACTS.SEOC.tollFree} (Toll-Free)</span>
                  </a>
                </div>

                <div className="ksdma-seoc-meta">
                  <div><strong>Address:</strong> {KSDMA_EMERGENCY_CONTACTS.SEOC.address}</div>
                  <div><strong>Email:</strong> {KSDMA_EMERGENCY_CONTACTS.SEOC.email}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {KSDMA_EMERGENCY_CONTACTS.SEOC.phones.map(ph => (
                      <a key={ph} href={`tel:${ph.replace(/-/g, '')}`} className="ksdma-sub-phone">
                        <Phone size={10} /> {ph}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* 14 DEOC District Helplines */}
              <div className="text-xs font-semibold text-zinc-300 mb-2 mt-4 flex items-center justify-between">
                <span>14-District Emergency Operations Centres (Toll-Free 1077)</span>
                <span className="text-zinc-500">KSDMA District Disaster Management Authorities</span>
              </div>

              <div className="ksdma-deoc-grid">
                {KERALA_DEOC_DIRECTORY.map(deoc => (
                  <div key={deoc.id} className="ksdma-deoc-box">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <strong className="text-white text-xs">{deoc.name}</strong>
                        <span className="text-[10px] text-zinc-400">{deoc.malayalam}</span>
                      </div>
                      <span className="ksdma-badge-mini">DEOC 1077</span>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2">
                      Direct: <a href={`tel:${deoc.deocDirect.replace(/-/g, '')}`} className="text-cyan-400 font-mono hover:underline">{deoc.deocDirect}</a>
                    </div>

                    <div className="flex gap-1.5">
                      <a 
                        href="tel:1077" 
                        className="ksdma-btn-action-small flex-1"
                        title={`Call 1077 for ${deoc.name}`}
                      >
                        <Phone size={10} className="text-amber-400" /> 1077
                      </a>
                      <a 
                        href={`tel:${deoc.deocDirect.replace(/-/g, '')}`} 
                        className="ksdma-btn-action-small flex-1"
                        title={`Call Direct Line for ${deoc.name}`}
                      >
                        <PhoneCall size={10} className="text-cyan-400" /> Direct
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Reservoirs Grid */
            <>
              {filteredDams.length === 0 ? (
                <div className="ksdma-empty-state">
                  <Droplets size={32} className="text-zinc-600 mb-2" />
                  <p className="text-sm text-zinc-300">No reservoirs found matching &ldquo;{searchQuery}&rdquo;</p>
                  <span className="text-xs text-zinc-500">Try searching &ldquo;Idukki&rdquo;, &ldquo;Palakkad&rdquo;, &ldquo;Wayanad&rdquo; or &ldquo;Periyar&rdquo;</span>
                </div>
              ) : (
                <div className="ksdma-dam-grid">
                  {filteredDams.map(dam => {
                    const storageColor = getStorageColor(dam.storagePercent, dam.alertLevel);
                    return (
                      <div 
                        key={dam.id} 
                        className={`ksdma-dam-card ${dam.alertLevel !== 'Normal' ? 'has-alert' : ''}`}
                      >
                        {/* Dam Card Header */}
                        <div className="ksdma-dam-card-header">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <strong className="text-white text-sm">{dam.name}</strong>
                              <span className={`ksdma-agency-tag ${dam.agency.toLowerCase()}`}>
                                {dam.agency}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {dam.malayalam} • <span className="text-zinc-300">{dam.district} Dist</span> • {dam.basin} Basin
                            </div>
                          </div>

                          <div className={`ksdma-alert-badge ${getAlertBadgeClass(dam.alertLevel)}`}>
                            {dam.alertLevel === 'Red' && <AlertTriangle size={12} className="mr-1" />}
                            {dam.alertLevel === 'Orange' && <AlertTriangle size={12} className="mr-1" />}
                            {dam.alertLevel === 'Blue' && <Info size={12} className="mr-1" />}
                            {dam.alertLevel === 'Normal' && <CheckCircle2 size={12} className="mr-1" />}
                            <span>{dam.alertLevel} Alert</span>
                          </div>
                        </div>

                        {/* Storage Gauge Bar */}
                        <div className="ksdma-storage-block">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-zinc-400">Live Storage Capacity</span>
                            <span className="font-mono font-bold" style={{ color: storageColor }}>
                              {dam.storagePercent.toFixed(1)}% ({dam.storageMcm} MCM)
                            </span>
                          </div>
                          <div className="ksdma-progress-track">
                            <div 
                              className="ksdma-progress-fill" 
                              style={{ 
                                width: `${Math.min(dam.storagePercent, 100)}%`,
                                backgroundColor: storageColor
                              }} 
                            />
                          </div>
                        </div>

                        {/* Hydrological Metrics Grid */}
                        <div className="ksdma-metrics-grid">
                          <div className="ksdma-metric-item">
                            <span className="ksdma-metric-lbl">Current Level</span>
                            <span className="ksdma-metric-val text-white">
                              {dam.currentLevelMeters.toFixed(2)} m
                            </span>
                          </div>
                          <div className="ksdma-metric-item">
                            <span className="ksdma-metric-lbl">Full Reservoir (FRL)</span>
                            <span className="ksdma-metric-val text-zinc-300">
                              {dam.frlMeters.toFixed(2)} m {dam.frlFeet ? `(${dam.frlFeet.toFixed(0)} ft)` : ''}
                            </span>
                          </div>
                          <div className="ksdma-metric-item">
                            <span className="ksdma-metric-lbl">Rule Curve</span>
                            <span className="ksdma-metric-val text-amber-300">
                              {dam.ruleCurveMeters.toFixed(2)} m
                            </span>
                          </div>
                          <div className="ksdma-metric-item">
                            <span className="ksdma-metric-lbl">Dam Type</span>
                            <span className="ksdma-metric-val text-zinc-300 truncate" title={dam.damType}>
                              {dam.damType}
                            </span>
                          </div>
                        </div>

                        {/* Spillway and Downstream Risk Notification */}
                        <div className="ksdma-spillway-info">
                          <div className="text-[11px] text-zinc-300 mb-1 flex items-start gap-1">
                            <span className="text-amber-400 font-semibold">Spillway:</span>
                            <span className="text-zinc-300">{dam.spillwayStatus}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-start gap-1">
                            <span className="text-cyan-400 font-semibold">Downstream:</span>
                            <span className="text-zinc-400">{dam.downstreamCorridor}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="ksdma-card-actions">
                          <button 
                            type="button"
                            className="ksdma-card-btn primary"
                            onClick={() => {
                              if (onFocusDamOnMap) {
                                onFocusDamOnMap(dam);
                                onClose();
                              }
                            }}
                            title="Plot and focus this reservoir on the tactical Leaflet map"
                          >
                            <MapPin size={12} />
                            <span>Plot on Map</span>
                          </button>

                          <a 
                            href="tel:1077"
                            className="ksdma-card-btn secondary"
                            title={`Call DEOC 1077 for ${dam.district}`}
                          >
                            <Phone size={12} />
                            <span>DEOC 1077</span>
                          </a>

                          <a 
                            href={KSDMA_OFFICIAL_URLS.DAM_WATER_LEVELS}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ksdma-card-btn secondary"
                            title="Open official KSDMA daily bulletin PDF link"
                          >
                            <ExternalLink size={12} />
                            <span>Bulletin</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with KSDMA Reference & Official Notice */}
        <div className="ksdma-modal-footer">
          <div className="ksdma-footer-note">
            <Info size={13} className="text-cyan-400 shrink-0" />
            <span>
              Telemetry monitored under Kerala State Disaster Management Authority (KSDMA) & Central Water Commission (CWC) Rule Curve Framework. Refer to{' '}
              <a href={KSDMA_OFFICIAL_URLS.DAM_WATER_LEVELS} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
                sdma.kerala.gov.in/dam-water-level
              </a>{' '}
              for daily verified engineering bulletins.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
