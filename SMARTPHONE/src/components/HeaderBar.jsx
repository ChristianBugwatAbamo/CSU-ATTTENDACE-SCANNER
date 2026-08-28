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
              <span style={{ fontWeight: 700 }}>Unsynced Record{queueCount !== 1 ? 's' : ''} Pending Sync</span>
            </div>
            <span className="sync-export-arrow">Export QR ⚡</span>
          </button>
        </div>
      )}
    </header>
  );
}
