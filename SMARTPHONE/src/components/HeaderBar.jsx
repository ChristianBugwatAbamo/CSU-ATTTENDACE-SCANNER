import React from 'react';
import { Zap, Database, RefreshCw } from 'lucide-react';

export default function HeaderBar({
  sessionSetup,
  isSessionActive,
  onToggleScanMode,
  onEditSetup,
  onOpenLanding,
  serverConnected,
  queueCount = 0,
  onOpenBatchSync,
  isTorchOn = false,
  onToggleTorch,
  cameraFacingMode = 'environment',
  onSwitchCamera,
  isOfflineStorageActive = true,
  activeTab = 'scanner'
}) {
  const isScannerTab = isSessionActive && activeTab === 'scanner';

  return (
    <header className="mobile-header">
      {/* Top Main Row */}
      <div className="header-main-row">
        {/* Left: Unit Seal Logo & Title */}
        <div
          className="header-left"
          onClick={onOpenLanding}
          style={{ cursor: onOpenLanding ? 'pointer' : 'default' }}
          title={onOpenLanding ? 'Return to Home / Landing Portal' : undefined}
        >
          <img
            src="./rotc-seal-transparent.png"
            alt="CSU ROTC Logo"
            className="mobile-logo-img"
            style={{ width: '36px', height: '36px', objectFit: 'contain', background: 'transparent' }}
          />
          <div className="header-title">
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, letterSpacing: '0.3px', lineHeight: 1.15 }}>
              CSU ROTC UNIT
            </h1>

          </div>
        </div>

        {/* Right Controls Group (Only active on Scanner tab) */}
        <div className="header-right-controls">
          {isScannerTab && (
            <>
              {/* Scan Mode Toggle Button (Time-In <-> Time-Out) */}
              {onToggleScanMode && (
                <button
                  type="button"
                  className={`header-tool-btn ${sessionSetup?.scanMode === 'Time-Out' ? 'tool-active' : ''}`}
                  style={{
                    width: 'auto',
                    padding: '0 8px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    gap: '4px',
                    background: sessionSetup?.scanMode === 'Time-Out' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                    borderColor: sessionSetup?.scanMode === 'Time-Out' ? '#fbbf24' : '#34d399',
                    color: sessionSetup?.scanMode === 'Time-Out' ? '#fbbf24' : '#34d399'
                  }}
                  onClick={() => onToggleScanMode(sessionSetup?.scanMode === 'Time-Out' ? 'Time-In' : 'Time-Out')}
                  title={`Current: ${sessionSetup?.scanMode || 'Time-In'}. Tap to switch to ${sessionSetup?.scanMode === 'Time-Out' ? 'Time-In' : 'Time-Out'}`}
                  aria-label="Toggle Scan Mode"
                >
                  <span>{sessionSetup?.scanMode === 'Time-Out' ? '🟡 TIME-OUT' : '🟢 TIME-IN'}</span>
                </button>
              )}

              {/* Flashlight / Torch Toggle */}
              {onToggleTorch && (
                <button
                  type="button"
                  className={`header-tool-btn ${isTorchOn ? 'tool-active' : ''}`}
                  onClick={onToggleTorch}
                  title={isTorchOn ? 'Turn Flashlight OFF' : 'Turn Flashlight ON'}
                  aria-label="Toggle Flashlight"
                >
                  <Zap size={16} fill={isTorchOn ? '#e5a900' : 'none'} color={isTorchOn ? '#e5a900' : '#ffffff'} />
                </button>
              )}

              {/* Camera Switcher */}
              {onSwitchCamera && (
                <button
                  type="button"
                  className="header-tool-btn"
                  onClick={onSwitchCamera}
                  title={`Switch Camera (${cameraFacingMode === 'user' ? 'Front' : 'Back'})`}
                  aria-label="Switch Camera"
                >
                  <RefreshCw size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Unsynced Record Counter Banner Strip (Only on Scanner Tab) */}
      {isScannerTab && queueCount > 0 && (
        <div className="header-sync-strip">
          <button
            type="button"
            className="header-sync-pill"
            onClick={onOpenBatchSync}
            title="Click to open Batch Sync QR export modal"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="sync-pulse-dot"></span>
              <span className="sync-count-number">{queueCount}</span>
              <span style={{ fontWeight: 700 }}>
                {sessionSetup?.scanMode === 'Time-Out' ? 'Time-Out' : 'Time-In'} Record{queueCount !== 1 ? 's' : ''} Pending Sync
              </span>
            </div>
            <span className="sync-export-arrow">Export QR ⚡</span>
          </button>
        </div>
      )}
    </header>
  );
}
