import React, { useState, useRef, useCallback } from 'react';
import { LayoutDashboard, QrCode, History, Camera, Plus, ScanLine, ClipboardList } from 'lucide-react';
import MilitaryLoader from './MilitaryLoader';

const TAB_PHRASES = {
  dashboard: 'Loading Command Dashboard...',
  history: 'Loading Attendance History...',
  scanner: 'Activating Webcam Scanner...',
  registration: 'Loading Cadet Registration...',
};

export default function MobileBottomNav({ activeTab, setActiveTab, onOpenScanner }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPhrase, setNavPhrase] = useState('');
  const navCallbackRef = useRef(null);

  const navigateWithLoader = useCallback((phrase, callback, delay = 600) => {
    setNavPhrase(phrase);
    setIsNavigating(true);
    navCallbackRef.current = callback;
    setTimeout(() => {
      setIsNavigating(false);
      if (navCallbackRef.current) navCallbackRef.current();
    }, delay);
  }, []);

  const handleNavClick = (id) => {
    if (id === activeTab) return;
    const phrase = TAB_PHRASES[id] || 'Loading...';
    navigateWithLoader(phrase, () => setActiveTab(id), 600);
  };

  const leftNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'History', icon: History },
  ];

  const rightNavItems = [
    { id: 'scanner', label: 'Scanner', icon: Camera },
    { id: 'registration', label: 'Register', icon: ClipboardList },
  ];

  return (
    <>
      {isNavigating && (
        <MilitaryLoader
          mode="admin"
          variant="fullscreen"
          staticPhrase={navPhrase}
        />
      )}
      <nav className="mobile-bottom-nav no-print print:hidden" aria-label="Mobile Navigation">
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
                  onClick={() => handleNavClick(item.id)}
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
                  onClick={() => handleNavClick(item.id)}
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
    </>
  );
}
