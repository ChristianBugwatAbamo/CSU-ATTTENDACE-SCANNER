import React from 'react';
import { LayoutDashboard, QrCode, FileSpreadsheet, Camera, Plus, ScanLine } from 'lucide-react';

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenScanner }) {
  const leftNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'idcards', label: 'ID Cards', icon: QrCode },
  ];

  const rightNavItems = [
    { id: 'scanner', label: 'Scanner', icon: Camera },
    { id: 'synclogs', label: 'Sync & Logs', icon: FileSpreadsheet },
  ];

  return (
    <nav className="mobile-bottom-nav no-print" aria-label="Mobile Navigation">
      <div className="mobile-nav-container">
        {/* Left Navigation Group */}
        <div className="mobile-nav-group left-group">
          {leftNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
              >
                <div className="mobile-nav-icon-wrapper">
                  <Icon size={20} className="mobile-nav-icon" />
                  {isActive && <span className="active-dot" />}
                </div>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center Floating Action Button (FAB) for Instant Webcam Batch QR Scanner */}
        <div className="mobile-fab-container">
          <button
            type="button"
            className="mobile-scanner-fab"
            onClick={onOpenScanner}
            title="Instant Webcam QR Scanner"
            aria-label="Instant Webcam QR Scanner"
          >
            <div className="fab-glow-effect"></div>
            <div className="fab-inner-icon">
              <ScanLine size={24} strokeWidth={2.4} />
            </div>
            <div className="fab-plus-badge">
              <Plus size={12} strokeWidth={3} />
            </div>
          </button>
          <span className="mobile-fab-label">Quick Scan</span>
        </div>

        {/* Right Navigation Group */}
        <div className="mobile-nav-group right-group">
          {rightNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
              >
                <div className="mobile-nav-icon-wrapper">
                  <Icon size={20} className="mobile-nav-icon" />
                  {isActive && <span className="active-dot" />}
                </div>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
