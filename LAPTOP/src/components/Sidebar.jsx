import React from 'react';
import { LayoutDashboard, Users, QrCode, FileSpreadsheet, Camera, Settings } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, serverOnline }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Analytics', icon: LayoutDashboard },
    { id: 'idcards', label: 'ROTC ID Card Generator', icon: QrCode },
    { id: 'scanner', label: 'Webcam Batch Scanner', icon: Camera },
    { id: 'synclogs', label: 'Attendance & Excel Reports', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/rotc-seal-transparent.png" alt="CSU ROTC Logo" className="rotc-logo-img" style={{ width: '48px', height: '48px', objectFit: 'contain', background: 'transparent' }} />
        <div className="sidebar-title">
          <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: '1.15rem' }}>CSU ROTC Unit</h1>
          <p style={{ color: '#9ca3af', textTransform: 'none', fontWeight: 500 }}>Inventory System</p>
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

      <div className="sidebar-footer">
        <div><strong>Server Node:</strong> Port 8080</div>
        <div className="server-status-pill">
          <span className="status-dot"></span>
          <span>{serverOnline ? 'LOCAL SYNC READY' : 'OFFLINE'}</span>
        </div>
      </div>
    </aside>
  );
}
