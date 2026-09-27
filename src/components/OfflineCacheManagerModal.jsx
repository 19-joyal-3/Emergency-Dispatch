import React, { useState, useEffect } from 'react';
import { Database, HardDrive, DownloadCloud, CheckCircle2, AlertTriangle, Trash2, X, RefreshCw, Layers } from 'lucide-react';
import { getStorageMetrics, preCacheCorridor, purgeCorridorCache, PRIORITY_CORRIDORS } from '../services/offlineTileService.js';

export default function OfflineCacheManagerModal({
  isOpen,
  onClose,
  onNotify = () => {},
  onInstallPwa,
  canInstallPwa = false,
  isPwaInstalled = false
}) {
  const [metrics, setMetrics] = useState({
    usageMB: 0,
    quotaMB: 0,
    percentUsed: 0,
    cachedTilesCount: 0,
    supported: true
  });
  const [loading, setLoading] = useState(false);
  const [cachingStatus, setCachingStatus] = useState({}); // { [corridorId]: { percent: 0, status: 'idle' } }

  const refreshMetrics = async () => {
    setLoading(true);
    try {
      const data = await getStorageMetrics();
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshMetrics();
    }
  }, [isOpen]);

  const handleStartCache = async (corridor) => {
    setCachingStatus(prev => ({
      ...prev,
      [corridor.id]: { percent: 0, status: 'downloading', text: 'Initializing...' }
    }));

    try {
      await preCacheCorridor(corridor.id, (prog) => {
        setCachingStatus(prev => ({
          ...prev,
          [corridor.id]: {
            percent: prog.percent,
            status: prog.status,
            text: `${prog.cached} / ${prog.total} tiles (${prog.percent}%)`
          }
        }));
      });

      onNotify(`Cached ${corridor.name} successfully for zero-connectivity ops.`, 'success');
      await refreshMetrics();
    } catch (err) {
      setCachingStatus(prev => ({
        ...prev,
        [corridor.id]: { percent: 0, status: 'error', text: err.message }
      }));
      onNotify(`Error caching corridor: ${err.message}`, 'error');
    }
  };

  const handlePurge = async () => {
    if (!window.confirm('Purge all offline cached corridor tiles? You will need internet to re-download.')) return;
    await purgeCorridorCache();
    setCachingStatus({});
    await refreshMetrics();
    onNotify('Offline tile cache purged.', 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="tactical-modal-backdrop" onClick={onClose}>
      <div
        className="offline-cache-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Offline Storage & Corridor Pre-Cacher"
      >
        {/* Header */}
        <div className="offline-modal-header">
          <div className="modal-title-group">
            <div className="modal-title-icon">
              <Database size={18} />
            </div>
            <div>
              <h3>Offline Storage & Corridor Pre-Cacher</h3>
              <p>Download critical Kerala disaster corridors to run with 100% autonomy during telecom collapse.</p>
            </div>
          </div>
          <button type="button" className="command-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Storage Metrics Gauge */}
        <div className="storage-meter-card">
          <div className="storage-meter-top">
            <div className="storage-stat">
              <HardDrive size={15} className="storage-icon" />
              <span>Storage Used: <strong>{metrics.usageMB} MB</strong></span>
            </div>
            <div className="storage-stat">
              <Layers size={15} className="storage-icon" />
              <span>Cached Tiles: <strong>{metrics.cachedTilesCount}</strong></span>
            </div>
            <button
              type="button"
              className="refresh-storage-btn"
              onClick={refreshMetrics}
              title="Refresh device storage metrics"
            >
              <RefreshCw size={12} className={loading ? 'spinning' : ''} />
            </button>
          </div>

          {/* Quota Progress Bar */}
          <div className="storage-progress-bar-bg">
            <div
              className="storage-progress-bar-fill"
              style={{ width: `${Math.max(2, Math.min(100, metrics.percentUsed * 10))}%` }}
            />
          </div>
          <div className="storage-meter-footer">
            <span>Allocated Quota: {metrics.quotaMB} MB</span>
            <span className="offline-status-badge">
              <CheckCircle2 size={11} /> Offline Resilient
            </span>
          </div>
        </div>

        {/* PWA Standalone Hardening Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '9px',
          padding: '0.65rem 0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '0.65rem 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📲</span>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
                Progressive Web App (PWA) Standalone Shell
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                {isPwaInstalled 
                  ? 'Running in standalone native shell with zero-connectivity precache' 
                  : 'Install to desktop or home screen for instantaneous offline launch'}
              </div>
            </div>
          </div>
          {onInstallPwa && !isPwaInstalled && (
            <button
              type="button"
              onClick={onInstallPwa}
              className="btn btn-secondary"
              style={{
                fontSize: '0.68rem',
                padding: '0.35rem 0.7rem',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                whiteSpace: 'nowrap',
                fontWeight: 600
              }}
            >
              Install App
            </button>
          )}
          {isPwaInstalled && (
            <span style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
              <CheckCircle2 size={12} /> Active Shell
            </span>
          )}
        </div>

        {/* Priority Corridors List */}
        <div className="corridor-list-section">
          <div className="section-label">Priority Emergency Corridors</div>
          <div className="corridor-cards-grid">
            {PRIORITY_CORRIDORS.map((corridor) => {
              const status = cachingStatus[corridor.id] || { status: 'idle', percent: 0, text: '' };
              const isDownloading = status.status === 'downloading' || status.status === 'caching';
              const isCompleted = status.status === 'completed';

              return (
                <div key={corridor.id} className="corridor-card">
                  <div className="corridor-card-header">
                    <div>
                      <h4 className="corridor-name">{corridor.name}</h4>
                      <span className="corridor-zone">{corridor.zone}</span>
                    </div>
                    {isCompleted ? (
                      <span className="corridor-badge-cached">
                        <CheckCircle2 size={13} /> Cached
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="corridor-download-btn"
                        onClick={() => handleStartCache(corridor)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <>
                            <RefreshCw size={12} className="spinning" /> Caching...
                          </>
                        ) : (
                          <>
                            <DownloadCloud size={13} /> Pre-Cache
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <p className="corridor-hubs">
                    <strong>Key Hubs:</strong> {corridor.hubs.join(' • ')}
                  </p>

                  {/* Progress Bar during download */}
                  {isDownloading && (
                    <div className="corridor-download-progress">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${status.percent}%` }}
                        />
                      </div>
                      <span className="progress-text">{status.text}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="offline-modal-footer">
          <button
            type="button"
            className="purge-cache-btn"
            onClick={handlePurge}
            title="Clear all stored corridor tiles"
          >
            <Trash2 size={13} /> Clear Offline Cache
          </button>
          <button
            type="button"
            className="modal-done-btn"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
