import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Zap, Navigation, Shield, Compass, CloudRain, Database, ArrowRight, CornerDownLeft, X, Play } from 'lucide-react';
import { searchKeralaPlacesAI } from '../aiPlaceMatcher.js';

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectPlace,
  onExecuteAction,
  onNavigateTab
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const defaultActions = [
    { id: 'recenter', label: 'Recenter Map to Kerala Bounds', icon: Compass, category: 'Map Controls', badge: 'R' },
    { id: 'simulate', label: 'Start Route Drive Simulation', icon: Play, category: 'Navigation', badge: 'Drive' },
    { id: 'sos', label: 'Trigger SOS Emergency Beacon', icon: Shield, category: 'Emergency', badge: 'SOS' },
    { id: 'radar', label: 'Toggle Live Weather & Rain Radar', icon: CloudRain, category: 'Tactical Overlays', badge: 'Radar' },
    { id: 'theme', label: 'Cycle Spectrum Theme (Obsidian / NVG / Solar)', icon: Zap, category: 'Display', badge: 'T' },
    { id: 'nearest_hospital', label: 'Route to Nearest Medical College / Hospital', icon: Navigation, category: 'Emergency', badge: 'MCH' },
    { id: 'storage', label: 'Open Offline Storage & Corridor Pre-Cacher', icon: Database, category: 'Resilience', badge: 'Offline' },
    { id: 'tab_planner', label: 'Switch to Tactical Route Planner', icon: Navigation, category: 'Navigation', badge: '2' },
    { id: 'tab_map', label: 'Switch to Full Map View', icon: MapPin, category: 'Navigation', badge: '1' },
    { id: 'tab_transit', label: 'Switch to Public Transit Network', icon: Zap, category: 'Navigation', badge: '3' },
    { id: 'tab_alerts', label: 'Switch to Alerts & Disaster Hotspots', icon: Shield, category: 'Navigation', badge: '5' }
  ];

  // Search results calculation
  const placeResults = query.trim().length > 0 ? searchKeralaPlacesAI(query, 5) : [];
  const actionResults = query.trim().length > 0
    ? defaultActions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()))
    : defaultActions;

  // Flattened results for keyboard navigation
  const combinedItems = [
    ...placeResults.map(p => ({ type: 'place', data: p, key: `p-${p.id || p.name}` })),
    ...actionResults.map(a => ({ type: 'action', data: a, key: `a-${a.id}` }))
  ];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation within the palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (combinedItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + combinedItems.length) % (combinedItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = combinedItems[selectedIndex];
      if (current) {
        if (current.type === 'place') {
          onSelectPlace(current.data);
        } else if (current.type === 'action') {
          onExecuteAction(current.data.id);
        }
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tactical-command-backdrop" onClick={onClose}>
      <div
        className="tactical-command-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tactical Command Palette"
      >
        {/* Search Header */}
        <div className="command-search-header">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="Type a town, disaster zone, or command (e.g. Chooralmala, Recenter, Radar)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="command-close-btn"
            onClick={onClose}
            aria-label="Close Command Palette"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results Stream */}
        <div className="command-results-container">
          {combinedItems.length === 0 ? (
            <div className="command-empty-state">
              <p>No locations or commands matching &ldquo;{query}&rdquo;</p>
              <span>Try &ldquo;Wayanad&rdquo;, &ldquo;Munnar&rdquo;, &ldquo;Kochi&rdquo; or &ldquo;Radar&rdquo;</span>
            </div>
          ) : (
            <div className="command-results-list">
              {placeResults.length > 0 && (
                <div className="command-section-label">Kerala Locations & Hotspots</div>
              )}
              {placeResults.map((place, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={`p-${place.id || place.name}`}
                    type="button"
                    className={`command-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectPlace(place);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="command-item-icon place">
                      <MapPin size={15} />
                    </div>
                    <div className="command-item-info">
                      <div className="command-item-title">
                        {place.name}
                        {place.district && <span className="command-item-sub">[{place.district}]</span>}
                      </div>
                      <div className="command-item-desc">
                        {place.type === 'disaster_hotspot' ? '🚨 High Hazard Zone' : place.desc || 'Kerala Locality'}
                      </div>
                    </div>
                    <span className="command-enter-badge">
                      <CornerDownLeft size={12} />
                    </span>
                  </button>
                );
              })}

              {actionResults.length > 0 && (
                <div className="command-section-label">
                  {placeResults.length > 0 ? 'Tactical Actions' : 'Quick Actions & Commands'}
                </div>
              )}
              {actionResults.map((action, aIdx) => {
                const globalIdx = placeResults.length + aIdx;
                const isSelected = selectedIndex === globalIdx;
                const ActionIcon = action.icon;
                return (
                  <button
                    key={`a-${action.id}`}
                    type="button"
                    className={`command-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onExecuteAction(action.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="command-item-icon action">
                      <ActionIcon size={15} />
                    </div>
                    <div className="command-item-info">
                      <div className="command-item-title">{action.label}</div>
                      <div className="command-item-desc">{action.category}</div>
                    </div>
                    {action.badge && (
                      <span className="command-action-badge">{action.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tactical Footer Cheatsheet */}
        <div className="command-palette-footer">
          <div className="command-keys-hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
          <div className="command-hotkeys-hint">
            <span><kbd>Ctrl+K</kbd> Palette</span>
            <span><kbd>R</kbd> Recenter</span>
            <span><kbd>T</kbd> Theme</span>
            <span><kbd>1-5</kbd> Tabs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
