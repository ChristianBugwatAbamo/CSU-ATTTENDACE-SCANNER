import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Smartphone Scanner Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050d09',
          color: '#ffffff',
          padding: '1.5rem',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: '#0c1a12',
            border: '2px solid #065f46',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '380px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ background: '#fee2e2', color: '#dc2626', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Oswald, sans-serif', color: '#fef3c7' }}>
              SCANNER RECOVERY
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem' }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #e5a900 0%, #b48400 100%)',
                color: '#03140c',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={16} /> Restart Scanner
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
