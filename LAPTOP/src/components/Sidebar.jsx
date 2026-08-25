import React, { useState, useEffect } from 'react';
import { LayoutDashboard, History, Users, QrCode, FileSpreadsheet, Camera, Settings, Database, Cloud, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAttendanceData } from '../hooks/useAttendanceData';
import { getSupabaseConfig } from '../utils/supabaseClient';

export default function Sidebar({ activeTab, setActiveTab, serverOnline, currentUser, onLogout }) {
  const { settings } = useAttendanceData();
  const [supabaseConfig, setSupabaseConfig] = useState(() => getSupabaseConfig());

  useEffect(() => {
    const handleConfigChange = () => {
      setSupabaseConfig(getSupabaseConfig());
    };
    window.addEventListener('csu_supabase_config_updated', handleConfigChange);
    return () => window.removeEventListener('csu_supabase_config_updated', handleConfigChange);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Analytics', icon: LayoutDashboard },
    { id: 'cadets', label: 'Cadets Roster', icon: Users },
    { id: 'history', label: 'Attendance History', icon: History },
    { id: 'idcards', label: 'ROTC ID Card Generator', icon: QrCode },
    { id: 'scanner', label: 'Webcam Batch Scanner', icon: Camera },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const logoSrc = settings?.rotcSealUrl || '/rotc-seal-transparent.png';

  return (
    <aside className="sidebar">
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
          const isActive = activeTab === item.id;
          return (
            <li
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '1rem 1.15rem' }}>
        {/* Admin Session Indicator */}
        {currentUser && (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(229, 169, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#34d399',
                  flexShrink: 0,
                  boxShadow: '0 0 5px rgba(52, 211, 153, 0.6)'
                }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.3px' }}>
                Admin HQ Session Active
              </span>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
                title="Sign Out of Command Center"
              >
                <LogOut size={11} /> Logout
              </button>
            )}
          </div>
        )}

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
  );
}
