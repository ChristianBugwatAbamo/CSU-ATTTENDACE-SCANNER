import React from 'react';
import { Settings } from 'lucide-react';

export default function HeaderBar({ sessionSetup, isSessionActive, onToggleScanMode, onEditSetup }) {
  return (
    <header className="mobile-header">
      {/* Left: Unit Seal Logo & Title (No subtext) */}
      <div className="header-left">
        <img
          src="./rotc-seal-transparent.png"
          alt="CSU ROTC Logo"
          className="mobile-logo-img"
          style={{ width: '38px', height: '38px', objectFit: 'contain', background: 'transparent' }}
        />
        <div className="header-title">
          <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.3px' }}>
            CSU ROTC Unit Scanner
          </h1>
        </div>
      </div>

      {/* Right: [ IN / OUT Mode Toggle ] -> [ Settings Icon Button ] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {/* Quick Mode Toggle if session is active */}
        {isSessionActive && (
          <button
            onClick={() => onToggleScanMode(sessionSetup.scanMode === 'Time-In' ? 'Time-Out' : 'Time-In')}
            style={{
              background: sessionSetup.scanMode === 'Time-In' ? '#059669' : '#d97706',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '4px 11px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s ease'
            }}
            title="Tap to switch Time-In / Time-Out"
          >
            {sessionSetup.scanMode === 'Time-In' ? '🟢 IN' : '🟡 OUT'}
          </button>
        )}

        {/* Clean Settings Gear Button (replaces text [ Setup ]) */}
        <button
          onClick={onEditSetup}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '7px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease, transform 0.15s ease'
          }}
          title="Duty Session Setup & Parameters"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
