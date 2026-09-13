import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Dispatch Hub Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleClearAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        });
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#05070a',
          color: '#f8fafc',
          padding: '2rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div>
                <h2 style={{ fontSize: '1.2rem', color: '#f87171', margin: 0 }}>Kerala Dispatch Hub — Recovery Mode</h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>An unexpected error interrupted the client interface.</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: '#fca5a5',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '140px',
              overflowY: 'auto',
              marginBottom: '1.2rem'
            }}>
              {this.state.error?.toString() || 'Unknown UI Error'}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleClearAndReload}
                style={{
                  padding: '0.5rem 1.2rem',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                Clear Cache & Restart App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
