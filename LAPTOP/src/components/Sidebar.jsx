import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, TrendingUp, BarChart3, History, Users, QrCode, Camera, Settings, LogOut, ClipboardList } from 'lucide-react';
import { useAttendanceData } from '../hooks/useAttendanceData';
import { getSupabaseConfig } from '../utils/supabaseClient';
import MilitaryLoader from './MilitaryLoader';

const TAB_PHRASES = {
  dashboard: 'Loading Command Dashboard...',
  'attendance-history': 'Loading Attendance History...',
  history: 'Loading Attendance History...',
  'cadets-roster': 'Loading Roster Data...',
  cadets: 'Loading Roster Data...',
  analytics: 'Loading Analytics & Reports...',
  registration: 'Loading Cadet Registration...',
  'qr-generator': 'Loading QR Code Generator...',
  qrgenerator: 'Loading QR Code Generator...',
  scanner: 'Activating Webcam Scanner...',
  settings: 'Loading System Settings...',
  logout: 'Logging Out...',
};

export default function Sidebar({ activeTab, setActiveTab, serverOnline, currentUser, onLogout }) {
  const { settings } = useAttendanceData();
  const [supabaseConfig, setSupabaseConfig] = useState(() => getSupabaseConfig());

  // Navigation overlay state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPhrase, setNavPhrase] = useState('');
  const navCallbackRef = useRef(null);

  const navigateWithLoader = useCallback((phrase, callback, delay = 650) => {
    setNavPhrase(phrase);
    setIsNavigating(true);
    navCallbackRef.current = callback;
    setTimeout(() => {
      setIsNavigating(false);
      if (navCallbackRef.current) navCallbackRef.current();
    }, delay);
  }, []);

  useEffect(() => {
    const handleConfigChange = () => {
      setSupabaseConfig(getSupabaseConfig());
    };
    window.addEventListener('csu_supabase_config_updated', handleConfigChange);
    return () => window.removeEventListener('csu_supabase_config_updated', handleConfigChange);
  }, []);

  const navItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Command Dashboard', icon: LayoutDashboard },
    { id: 'attendance-history', path: '/attendance-history', label: 'Attendance History', icon: History },
    { id: 'cadets-roster', path: '/cadets-roster', label: 'Cadets Roster', icon: Users },
    { id: 'analytics', path: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'registration', path: '/registration', label: 'Cadet Registration', icon: ClipboardList },
    { id: 'qr-generator', path: '/qr-generator', label: 'QR Code Generator', icon: QrCode },
    { id: 'scanner', path: '/scanner', label: 'Webcam Batch Scanner', icon: Camera },
    { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
    { id: 'logout', path: '/logout', label: 'Log Out', icon: LogOut, isLogout: true }
  ];

  const logoSrc = settings?.rotcSealUrl || '/rotc-seal-transparent.png';

  const isItemActive = (item) => {
    if (item.isLogout || item.id === 'logout') return false;
    if (activeTab === item.id) return true;
    if (item.path && (activeTab === item.path || activeTab === item.path.replace('/', ''))) return true;
    if (item.id === 'attendance-history' && activeTab === 'history') return true;
    if (item.id === 'cadets-roster' && activeTab === 'cadets') return true;
    if (item.id === 'qr-generator' && activeTab === 'qrgenerator') return true;
    return false;
  };

  const handleLogoutClick = () => {
    navigateWithLoader('Logging Out...', () => { if (onLogout) onLogout(); }, 500);
  };

  const handleNavClick = (target) => {
    const item = typeof target === 'string'
      ? navItems.find((n) => n.id === target || n.path === target || n.path === `/${target}`) || { id: target }
      : target;

    if (item.id === 'logout' || item.isLogout) {
      handleLogoutClick();
      return;
    }

    if (isItemActive(item)) return; // already on this tab, skip loader
    const phrase = TAB_PHRASES[item.id] || (item.label ? `Loading ${item.label}...` : 'Loading...');
    navigateWithLoader(phrase, () => setActiveTab(item.id), 600);
  };

  return (
    <>
      {/* Tactical Radar Overlay for sidebar nav transitions */}
      {isNavigating && (
        <MilitaryLoader
          mode="admin"
          variant="fullscreen"
          staticPhrase={navPhrase}
        />
      )}
      <aside className="sidebar print:hidden">
        <div className="sidebar-header">
          <img
            src={logoSrc}
            alt="CSU ROTC Logo"
            className="rotc-logo-img"
            style={{ width: '48px', height: '48px', objectFit: 'contain', background: 'transparent' }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/rotc-seal-transparent.png';
            }}
          />
          <div className="sidebar-title">
            <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: '1.15rem' }}>CSU MAIN ROTCU</h1>
            <p style={{ color: '#9ca3af', textTransform: 'none', fontWeight: 500 }}>Attendance System</p>
          </div>
        </div>

        <ul className="sidebar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isLogout = item.id === 'logout' || item.isLogout;
            if (isLogout && !onLogout) return null;

            if (isLogout) {
              return (
                <li
                  key={item.id}
                  className="sidebar-item sidebar-logout-item"
                  onClick={handleLogoutClick}
                  style={{
                    marginTop: '0.25rem',
                    color: '#f87171',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                    e.currentTarget.style.color = '#fca5a5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#f87171';
                  }}
                >
                  <Icon size={20} color="#f87171" />
                  <span style={{ fontWeight: 600 }}>{item.label}</span>
                </li>
              );
            }

            const isActive = isItemActive(item);
            return (
              <li
                key={item.id}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '1rem 1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
            <span><strong>Local Server:</strong></span>
            <span className="server-status-pill" style={{ margin: 0, padding: '2px 8px', fontSize: '0.68rem' }}>
              <span className="status-dot"></span>
              <span>{serverOnline ? 'READY' : 'OFFLINE'}</span>
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
            <span><strong>Cloud DB:</strong></span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: supabaseConfig.isConfigured ? 'rgba(5, 150, 105, 0.2)' : 'rgba(234, 88, 12, 0.2)',
                color: supabaseConfig.isConfigured ? '#34d399' : '#fb923c',
                border: `1px solid ${supabaseConfig.isConfigured ? '#059669' : '#ea580c'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={supabaseConfig.isConfigured ? `Connected to ${supabaseConfig.url}` : 'Configure Anon Key in Settings or .env'}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: supabaseConfig.isConfigured ? '#34d399' : '#fb923c' }}></span>
              <span>{supabaseConfig.isConfigured ? 'SUPABASE LIVE' : 'SUPABASE READY'}</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
