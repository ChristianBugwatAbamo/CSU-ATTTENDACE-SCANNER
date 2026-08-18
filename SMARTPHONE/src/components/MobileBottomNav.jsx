import React from 'react';
import { Camera, BarChart3, QrCode, Info, Settings, ScanLine, Layers } from 'lucide-react';

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  onPresentBatchSync,
  queueCount = 0
}) {
  const rightTabs = [
    { id: 'about', label: 'About Us', icon: Info },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isScannerActive = activeTab === 'scanner';

  return (
    <nav className="mobile-bottom-nav no-print" aria-label="Mobile Bottom Navigation">
      <div className="mobile-nav-container">
        {/* Left Navigation Group: Batch Sync & Dashboard */}
        <div className="mobile-nav-group left-group">
          {/* Tab 1: Batch Sync */}
          <button
            type="button"
            className="mobile-nav-item batch-sync-tab"
            onClick={onPresentBatchSync}
            aria-label="Batch Sync"
          >
            <div className="mobile-nav-icon-wrapper">
              <QrCode size={20} className="mobile-nav-icon" />
              {queueCount > 0 && (
                <span className="nav-tab-badge">
                  {queueCount > 99 ? '99+' : queueCount}
                </span>
              )}
            </div>
            <span className="mobile-nav-label">Batch Sync</span>
          </button>

          {/* Tab 2: Dashboard & Reports */}
          <button
            type="button"
            className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            aria-label="Dashboard"
          >
            <div className="mobile-nav-icon-wrapper">
              <BarChart3 size={20} className="mobile-nav-icon" />
              {activeTab === 'dashboard' && <span className="active-dot" />}
            </div>
            <span className="mobile-nav-label">Dashboard</span>
          </button>
        </div>

        {/* Center Floating Action Button (FAB): Prominent Field Scanner Button */}
        <div className="mobile-fab-container">
          <button
            type="button"
            className={`mobile-scanner-fab ${isScannerActive ? 'fab-active' : ''}`}
            onClick={() => setActiveTab('scanner')}
            aria-label="Field Scanner"
          >
            <div className="fab-glow-effect"></div>
            <div className="fab-inner-icon">
              <Camera size={26} strokeWidth={2.4} />
            </div>
          </button>
          <span className={`mobile-fab-label ${isScannerActive ? 'active-fab-label' : ''}`}>
            Scanner
          </span>
        </div>

        {/* Right Navigation Group: ID Cards & Settings */}
        <div className="mobile-nav-group right-group">
          {rightTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
              >
                <div className="mobile-nav-icon-wrapper">
                  <Icon size={20} className="mobile-nav-icon" />
                  {isActive && <span className="active-dot" />}
                </div>
                <span className="mobile-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export { MobileBottomNav as BottomNavbar };
