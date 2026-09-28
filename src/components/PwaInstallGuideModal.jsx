import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, CheckCircle2, AlertCircle, Copy, ExternalLink, X, Monitor, Shield, Sparkles, Info, ArrowRight } from 'lucide-react';

export default function PwaInstallGuideModal({
  isOpen,
  onClose,
  canPrompt = false,
  onTriggerPrompt,
  isInstalled = false,
  onNotify = () => {}
}) {
  const [activePlatform, setActivePlatform] = useState('android');
  const [copied, setCopied] = useState(false);

  // Auto-detect user platform on mount or when opened
  useEffect(() => {
    if (isOpen) {
      const ua = navigator.userAgent || '';
      if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
        setActivePlatform('ios');
      } else if (/Android/.test(ua)) {
        setActivePlatform('android');
      } else {
        setActivePlatform('desktop');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      onNotify('[PWA] Platform URL copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify('[PWA] Could not copy URL automatically.', 'warning');
    }
  };

  return (
    <div className="tactical-command-backdrop" onClick={onClose} style={{ zIndex: 10500 }}>
      <div
        className="tactical-command-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Install Resylix Mobile & Desktop App"
        style={{
          maxWidth: '560px',
          width: '94%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
          background: 'rgba(8, 14, 24, 0.95)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Smartphone size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.02em' }}>
                Install Resylix Geo App
              </h2>
              <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0 }}>
                Zero-Connectivity Standalone PWA • Kerala Disaster Coordination
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            aria-label="Close installation guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* Status Banner */}
          {isInstalled ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1rem'
            }}>
              <CheckCircle2 size={20} color="#10b981" />
              <div>
                <strong style={{ fontSize: '0.78rem', color: '#34d399', display: 'block' }}>
                  Resylix is Already Installed
                </strong>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  You are running in full standalone app mode with zero-connectivity offline caches active.
                </span>
              </div>
            </div>
          ) : canPrompt ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              borderRadius: '10px',
              padding: '0.85rem',
              textAlign: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginBottom: '0.6rem', fontWeight: 600 }}>
                ⚡ Native Browser Install Prompt Ready
              </div>
              <button
                type="button"
                onClick={onTriggerPrompt}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                }}
              >
                <Download size={16} /> Install App with 1-Tap Now
              </button>
            </div>
          ) : (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1rem',
              fontSize: '0.7rem',
              color: '#fcd34d'
            }}>
              <Info size={16} style={{ flexShrink: 0 }} />
              <span>
                To install on your phone, use your browser&apos;s native &ldquo;Add to Home Screen&rdquo; button as detailed below.
              </span>
            </div>
          )}

          {/* Platform Selector Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            marginBottom: '1rem'
          }}>
            <button
              type="button"
              onClick={() => setActivePlatform('android')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                background: activePlatform === 'android' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: activePlatform === 'android' ? '#38bdf8' : '#94a3b8',
                fontWeight: activePlatform === 'android' ? 700 : 500,
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <Smartphone size={14} /> Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('ios')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                background: activePlatform === 'ios' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: activePlatform === 'ios' ? '#38bdf8' : '#94a3b8',
                fontWeight: activePlatform === 'ios' ? 700 : 500,
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <Share size={14} /> iPhone / iOS (Safari)
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('desktop')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                background: activePlatform === 'desktop' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                color: activePlatform === 'desktop' ? '#38bdf8' : '#94a3b8',
                fontWeight: activePlatform === 'desktop' ? 700 : 500,
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <Monitor size={14} /> Desktop (PC/Mac)
            </button>
          </div>

          {/* Step-by-Step Instructions based on activePlatform */}
          {activePlatform === 'android' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>1</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Open this link in <strong style={{ color: '#fff' }}>Google Chrome</strong> or <strong style={{ color: '#fff' }}>Samsung Internet</strong> on your Android phone.
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>2</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Tap the <strong style={{ color: '#38bdf8' }}>three dots (⋮)</strong> menu icon in the top-right corner of Chrome.
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>3</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Tap <strong style={{ color: '#10b981' }}>&ldquo;Install app&rdquo;</strong> (or <strong style={{ color: '#10b981' }}>&ldquo;Add to Home screen&rdquo;</strong>).
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>4</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Tap <strong style={{ color: '#fff' }}>Install</strong>. Resylix will be added to your home screen and app drawer with the offline icon!
                </div>
              </div>
            </div>
          )}

          {activePlatform === 'ios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>1</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Open this link in <strong style={{ color: '#fff' }}>Apple Safari</strong> (iOS only supports PWA home screen installation via Safari).
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>2</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Tap the <strong style={{ color: '#38bdf8' }}>Share button</strong> (<Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> square with arrow pointing up) at the bottom toolbar.
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>3</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Scroll down the share sheet and tap <strong style={{ color: '#10b981' }}>&ldquo;Add to Home Screen&rdquo;</strong> (⊞).
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>4</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Tap <strong style={{ color: '#fff' }}>Add</strong> in the top-right corner. The Resylix app icon appears on your iPhone/iPad home screen!
                </div>
              </div>
            </div>
          )}

          {activePlatform === 'desktop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>1</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  In <strong style={{ color: '#fff' }}>Google Chrome</strong> or <strong style={{ color: '#fff' }}>Microsoft Edge</strong>, look at the right side of the address bar.
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>2</div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Click the <strong style={{ color: '#38bdf8' }}>Install icon (⊕)</strong> in the address bar, or click Menu (⋮) &rarr; <strong style={{ color: '#10b981' }}>&ldquo;Install Resylix Geo&rdquo;</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Benefits Grid */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              Why Install Resylix Geo as a Standalone App?
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem'
            }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                borderRadius: '6px',
                padding: '0.5rem 0.65rem'
              }}>
                <strong style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'block' }}>⚡ Zero Network Launch</strong>
                <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Launches instantly even with 0 cellular bars or airplane mode.</span>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                borderRadius: '6px',
                padding: '0.5rem 0.65rem'
              }}>
                <strong style={{ fontSize: '0.72rem', color: '#34d399', display: 'block' }}>🗺️ Full Screen Map</strong>
                <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Removes browser URL search bars for max tactical screen area.</span>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: '6px',
                padding: '0.5rem 0.65rem'
              }}>
                <strong style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'block' }}>📍 Continuous GNSS</strong>
                <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Higher priority sensor polling and spoken turn announcements.</span>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(168, 85, 247, 0.15)',
                borderRadius: '6px',
                padding: '0.5rem 0.65rem'
              }}>
                <strong style={{ fontSize: '0.72rem', color: '#c084fc', display: 'block' }}>🗄️ Local Corridor Cache</strong>
                <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>KSDMA dams & offline vector maps stored safely in IndexedDB.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid rgba(56, 189, 248, 0.2)',
          background: 'rgba(8, 14, 24, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={handleCopyUrl}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#cbd5e1',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? 'Link Copied!' : 'Copy Link for Phone'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(59, 130, 246, 0.25))',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
