import React, { useState, useMemo } from 'react';
import { Mountain, TrendingUp, ArrowUpRight, ArrowDownRight, Compass } from 'lucide-react';
import { calculateRouteElevation } from '../services/elevationService.js';

export default function RouteElevationChart({
  geometry,
  onHoverPoint = () => {},
  onLeavePoint = () => {}
}) {
  const [activeSample, setActiveSample] = useState(null);

  const profile = useMemo(() => {
    return calculateRouteElevation(geometry, 50);
  }, [geometry]);

  if (!profile || profile.samples.length < 2) {
    return null;
  }

  const { samples, minElevation, maxElevation, totalClimb, totalDescent, maxGradient, totalDistanceKm } = profile;

  // SVG Chart Dimensions
  const svgWidth = 420;
  const svgHeight = 90;
  const paddingX = 10;
  const paddingY = 12;

  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const altRange = Math.max(25, maxElevation - minElevation);

  // Generate SVG Points
  const points = samples.map((s, idx) => {
    const x = paddingX + (s.distanceKm / (totalDistanceKm || 1)) * chartW;
    const y = paddingY + chartH - ((s.elevationM - minElevation) / altRange) * chartH;
    return { ...s, x, y };
  });

  const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPathStr = `M ${points[0].x},${paddingY + chartH} ` +
    points.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${points[points.length - 1].x},${paddingY + chartH} Z`;

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const scaleX = svgWidth / rect.width;
    const currentX = clickX * scaleX;

    // Find closest sample
    let closest = points[0];
    let minDiff = Infinity;
    points.forEach(p => {
      const diff = Math.abs(p.x - currentX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    });

    setActiveSample(closest);
    onHoverPoint(closest);
  };

  const handleMouseLeave = () => {
    setActiveSample(null);
    onLeavePoint();
  };

  const isHighRange = maxElevation >= 600;

  return (
    <div className="route-elevation-card">
      {/* Header with Topographic Indicators */}
      <div className="elevation-header">
        <div className="elevation-title">
          <Mountain size={14} className={isHighRange ? 'highland-icon' : 'lowland-icon'} />
          <span>Topographic Elevation & Gradient</span>
          {isHighRange && (
            <span className="elevation-badge warning">Ghats High Range</span>
          )}
        </div>
        <div className="elevation-metrics">
          <span title="Total Ascending Climb" className="metric-pill climb">
            <ArrowUpRight size={11} /> +{totalClimb}m
          </span>
          <span title="Total Descent" className="metric-pill descent">
            <ArrowDownRight size={11} /> -{totalDescent}m
          </span>
          <span title="Peak Altitude" className="metric-pill peak">
            ▲ {maxElevation}m
          </span>
          <span title="Max Slope Incline" className="metric-pill gradient">
            {maxGradient}% slope
          </span>
        </div>
      </div>

      {/* SVG Interactive Waveform */}
      <div
        className="elevation-chart-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="elevation-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="elevationAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isHighRange ? '#38bdf8' : '#34d399'} stopOpacity="0.45" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#090b10" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="elevationLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor={isHighRange ? '#f59e0b' : '#60a5fa'} />
            </linearGradient>
          </defs>

          {/* Baseline Gridlines */}
          <line
            x1={paddingX}
            y1={paddingY + chartH}
            x2={svgWidth - paddingX}
            y2={paddingY + chartH}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={paddingY + chartH / 2}
            x2={svgWidth - paddingX}
            y2={paddingY + chartH / 2}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="2 2"
          />

          {/* Area Fill */}
          <path d={areaPathStr} fill="url(#elevationAreaGrad)" />

          {/* Stroke Line */}
          <path
            d={`M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke="url(#elevationLineGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Scrubber Cursor */}
          {activeSample && (
            <g>
              <line
                x1={activeSample.x}
                y1={paddingY}
                x2={activeSample.x}
                y2={paddingY + chartH}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              <circle
                cx={activeSample.x}
                cy={activeSample.y}
                r="4.5"
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Live Hover Tooltip */}
        {activeSample && (
          <div
            className="elevation-tooltip"
            style={{
              left: `${(activeSample.x / svgWidth) * 100}%`
            }}
          >
            <strong>{activeSample.elevationM}m</strong> alt
            <span className="tooltip-sub">({activeSample.distanceKm} km)</span>
          </div>
        )}
      </div>

      {/* Axis Footer */}
      <div className="elevation-axis-footer">
        <span>0 km (Start: {minElevation}m)</span>
        <span>Elevation Profile (Kerala Hypsometric Model)</span>
        <span>{totalDistanceKm} km ({maxElevation}m peak)</span>
      </div>
    </div>
  );
}
