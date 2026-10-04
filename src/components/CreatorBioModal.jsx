import React from 'react';
import { X, ExternalLink, ShieldCheck, Cpu, MapPin, Mail, Globe, Award } from 'lucide-react';

export default function CreatorBioModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-bio-title"
      className="poi-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="poi-modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0b1329',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(56, 189, 248, 0.1), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}
            >
              👨‍💻
            </div>
            <div>
              <h2 id="creator-bio-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Joyal Thomas Francis
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 500 }}>
                Creator, Lead Architect &amp; Systems Engineer
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Identity & Origin Card */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
              <ShieldCheck size={16} />
              <span>OFFICIAL AUTHOR &amp; CREATOR VERIFICATION</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
              <strong>Joyal Thomas Francis</strong> is the sole creator, software architect, and lead engineer of <strong>Resylix</strong> (formerly known as <em>Vanguard Geo</em>).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} style={{ color: '#38bdf8' }} /> Kerala, India
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={13} style={{ color: '#a78bfa' }} /> Geospatial Systems Architecture
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Award size={13} style={{ color: '#fbbf24' }} /> Open-Source Public Safety
              </span>
            </div>
          </div>

          {/* Mission & Background */}
          <div>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Engineering Rationale
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Joyal conceived and engineered Resylix as an independent tactical response to severe monsoon flooding and landslide catastrophes across Kerala (notably Wayanad Meppadi and Chooralmala). Traditional navigation tools fail completely during severe weather when telecom towers lose power and cellular data collapses. Resylix guarantees zero-connectivity routing, offline topographic indexing, and Bluetooth mesh dispatch.
            </p>
          </div>

          {/* Technical Pillars Architected by Joyal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Key Systems Architected
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>Zero-Data Vector Dijkstra Routing:</strong> Offline turn-by-turn navigation across all 14 Kerala districts.</li>
              <li><strong>5.0 KM Proximity Radar:</strong> Sub-second spatial queries for trauma centers, fuel, and relief camps.</li>
              <li><strong>KSDMA Matrix &amp; Dam Rule Curves:</strong> 24 live reservoir monitors and 14-district IMD alert tracking.</li>
              <li><strong>V2V Hazard Mesh &amp; BLE Gossip:</strong> Decentralized multi-hop hazard relay during total network blackout.</li>
              <li><strong>60 FPS Mobile GPU Acceleration:</strong> Canvas-backed vector rendering and minimal battery drain.</li>
            </ul>
          </div>

          {/* Links & Profiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Verified Profiles &amp; Repository
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
              <a
                href="/creator.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  textDecoration: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={15} /> Official Creator Page
                </span>
                <ExternalLink size={14} />
              </a>

              <a
                href="https://github.com/19-joyal-3/Emergency-Dispatch"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  textDecoration: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>GitHub: @19-joyal-3</span>
                </span>
                <ExternalLink size={14} />
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              <Mail size={13} style={{ color: '#38bdf8' }} />
              <span>Direct Inquiries: </span>
              <a href="mailto:joyalthomasfrancis3@gmail.com" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                joyalthomasfrancis3@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Resylix • Independent Public Safety Technology
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
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
