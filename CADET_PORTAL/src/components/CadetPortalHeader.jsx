import React from 'react';
import { Sun, Moon, LogOut, FileText, FileEdit } from 'lucide-react';

/**
 * CadetPortalHeader - Sticky Top Navigation Bar for Cadet Portal
 *
 * Includes:
 * - ROTC Seal & Portal Branding
 * - Dedicated "File Absence Excuse" Action Button (📝)
 * - Dark / Light Mode Theme Toggle
 * - Cadet Identity Tag (Name & ID)
 * - Secure Sign Out Button
 */
export default function CadetPortalHeader({
  t = {},
  isLight = false,
  toggleTheme,
  fullName = 'CADET',
  cadetId = '',
  isLoggingOut = false,
  handleLogoutClick,
  onOpenFileExcuse
}) {
  return (
    <header
      style={{
        backgroundColor: t.headerBg || '#002814',
        borderBottom: '2px solid #e5a900',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
      }}
    >
      {/* Header Left: Seal & Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#043820',
            border: '2px solid #e5a900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px',
            flexShrink: 0
          }}
        >
          <img
            src="/rotc-seal-transparent.png"
            alt="CSU ROTC"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1.15rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              color: '#facc15',
              lineHeight: 1.2,
              whiteSpace: 'nowrap'
            }}
          >
            CADET PORTAL
          </div>
        </div>
      </div>

      {/* Header Right: File Excuse Button, Theme Toggle, Cadet Profile & Sign Out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Dedicated File Absence Excuse Button (Icon-Only Square Button) */}
        <button
          type="button"
          onClick={onOpenFileExcuse}
          className="p-2 rounded-xl"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: isLight ? 'rgba(217, 119, 6, 0.14)' : 'rgba(245, 158, 11, 0.15)',
            border: isLight ? '1.5px solid #d97706' : '1.5px solid rgba(251, 191, 36, 0.55)',
            color: isLight ? '#92400e' : '#fef08a',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isLight ? 'rgba(217, 119, 6, 0.25)' : 'rgba(245, 158, 11, 0.28)';
            e.currentTarget.style.borderColor = '#facc15';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isLight ? 'rgba(217, 119, 6, 0.14)' : 'rgba(245, 158, 11, 0.15)';
            e.currentTarget.style.borderColor = isLight ? '#d97706' : 'rgba(251, 191, 36, 0.55)';
          }}
          title="File Absence Excuse"
          aria-label="File Absence Excuse"
        >
          <FileText size={17} color={isLight ? '#92400e' : '#facc15'} />
        </button>

        {/* Theme Toggle Button (Dark / Light Mode) */}
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {isLight ? <Moon size={17} color="#facc15" /> : <Sun size={17} color="#facc15" />}
        </button>

        {/* Cadet Profile Info (Desktop) */}
        <div
          style={{
            display: 'none',
            textAlign: 'right',
            fontSize: '0.82rem'
          }}
          className="md:block"
        >
          <div style={{ fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>{fullName}</div>
          <div style={{ fontSize: '0.72rem', color: '#f1f5f9', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{cadetId}</div>
        </div>

        {/* Sign Out Button (Icon-Only Action) */}
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={handleLogoutClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: 'rgba(239, 68, 68, 0.18)',
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            color: '#fecdd3',
            borderRadius: '8px',
            cursor: isLoggingOut ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; }}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
