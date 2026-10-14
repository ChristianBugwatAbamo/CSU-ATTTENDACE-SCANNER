import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  LogIn,
  Users,
  QrCode,
  FileSpreadsheet,
  Camera,
  Activity,
  Award,
  Building,
  CheckCircle2,
  Lock,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Database
} from 'lucide-react';
import { fetchSettingsFromSupabase, fetchCadetCountFromSupabase } from '../utils/supabaseClient';
import MilitaryLoader from './MilitaryLoader';

const CADET_PORTAL_URL = import.meta.env.VITE_CADET_PORTAL_URL || 'https://cadet-portal-domain.com';

export default function PublicLandingPage({
  onNavigateToLogin,
  onNavigateToDashboard,
  isAuthenticated,
  currentUser
}) {
  const currentYear = new Date().getFullYear();

  // Navigation overlay state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPhrase, setNavPhrase] = useState('');
  const navCallbackRef = useRef(null);

  const navigateWithLoader = useCallback((phrase, callback, delay = 700) => {
    setNavPhrase(phrase);
    setIsNavigating(true);
    navCallbackRef.current = callback;
    setTimeout(() => {
      setIsNavigating(false);
      if (navCallbackRef.current) navCallbackRef.current();
    }, delay);
  }, []);

  const [commandant, setCommandant] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.commandingOfficer) return parsed.commandingOfficer;
      }
    } catch (_) { }
    return 'LTC CHRISTIAN B ABAMO INF (GSC) PA';
  });

  const [hostInstitution, setHostInstitution] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.hostInstitution) return parsed.hostInstitution;
      }
    } catch (_) { }
    return 'Caraga State University';
  });

  const [unitName, setUnitName] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.unitName) return parsed.unitName;
      }
    } catch (_) { }
    return 'CSU MAIN ROTC UNIT';
  });

  const [corpsStrength, setCorpsStrength] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_cadets_roster');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      }
    } catch (_) { }
    return 1194;
  });

  // Dynamic Hero Emblems List (JSONB from system_settings)
  const [heroEmblems, setHeroEmblems] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.hero_emblems) && parsed.hero_emblems.length > 0) {
          return parsed.hero_emblems;
        }
      }
    } catch (_) { }
    return [
      { id: '1', label: '15th Regional Community Defense Group (15RCDG)', url: '/rcdg-logo.png', is_center: false, active: true },
      { id: '2', label: '1501st Community Defense Center (1501st CDC)', url: '/cdc-logo.png', is_center: false, active: true },
      { id: '3', label: 'Official ROTC Unit Seal (Center)', url: '/rotc-seal-transparent.png', is_center: true, active: true },
      { id: '4', label: 'National Service Training Program (NSTP CSU)', url: '/nstp-logo.png', is_center: false, active: true },
      { id: '5', label: 'Caraga State University (CSU Main)', url: '/csu-logo.png', is_center: false, active: true }
    ];
  });

  const centerEmblem = heroEmblems.find(e => e.is_center) || heroEmblems[Math.floor(heroEmblems.length / 2)] || { url: '/rotc-seal-transparent.png' };
  const visibleEmblems = heroEmblems.filter(e => e.active !== false);

  useEffect(() => {
    let isMounted = true;

    async function loadBrandingSettings() {
      try {
        const data = await fetchSettingsFromSupabase();
        if (isMounted && data) {
          if (data.commandant || data.commanding_officer) setCommandant(data.commandant || data.commanding_officer);
          if (data.school_name || data.host_institution) setHostInstitution(data.school_name || data.host_institution);
          if (data.unit_name) setUnitName(data.unit_name);

          let loadedEmblems = null;
          if (Array.isArray(data.hero_emblems) && data.hero_emblems.length > 0) {
            loadedEmblems = data.hero_emblems;
          } else if (typeof data.hero_emblems === 'string') {
            try {
              const parsed = JSON.parse(data.hero_emblems);
              if (Array.isArray(parsed) && parsed.length > 0) loadedEmblems = parsed;
            } catch (_) { }
          } else if (data.rcdg_seal_url || data.cdc_seal_url || data.rotc_seal_url) {
            loadedEmblems = [
              { id: '1', label: '15th Regional Community Defense Group (15RCDG)', url: data.rcdg_seal_url || '/rcdg-logo.png', is_center: false, active: true },
              { id: '2', label: '1501st Community Defense Center (1501st CDC)', url: data.cdc_seal_url || '/cdc-logo.png', is_center: false, active: true },
              { id: '3', label: 'Official ROTC Unit Seal (Center)', url: data.rotc_seal_url || '/rotc-seal-transparent.png', is_center: true, active: true },
              { id: '4', label: 'National Service Training Program (NSTP CSU)', url: data.nstp_logo_url || '/nstp-logo.png', is_center: false, active: true },
              { id: '5', label: 'Caraga State University (CSU Main)', url: data.university_logo_url || '/csu-logo.png', is_center: false, active: true }
            ];
          }
          if (loadedEmblems) setHeroEmblems(loadedEmblems);
        }

        const count = await fetchCadetCountFromSupabase();
        if (isMounted && typeof count === 'number' && count > 0) {
          setCorpsStrength(count);
        }
      } catch (err) {
        console.error('Error fetching settings for public landing page:', err);
      }
    }

    loadBrandingSettings();

    const handleSettingsUpdate = (e) => {
      if (!isMounted) return;
      if (e?.detail) {
        const d = e.detail;
        if (d.commandant || d.commanding_officer || d.commandingOfficer) setCommandant(d.commandant || d.commanding_officer || d.commandingOfficer);
        if (d.school_name || d.host_institution || d.hostInstitution) setHostInstitution(d.school_name || d.host_institution || d.hostInstitution);
        if (d.unit_name || d.unitName) setUnitName(d.unit_name || d.unitName);
        if (Array.isArray(d.hero_emblems) && d.hero_emblems.length > 0) {
          setHeroEmblems(d.hero_emblems);
        } else if (Array.isArray(d.heroEmblems) && d.heroEmblems.length > 0) {
          setHeroEmblems(d.heroEmblems);
        }
      } else {
        loadBrandingSettings();
      }
    };

    window.addEventListener('csu_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('csu_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  const features = [
    {
      icon: Users,
      title: 'Master Cadet Roster',
      desc: 'Complete corps strength organized into Battalions, Companies, and Platoons with real-time echelon tracking.'
    },
    {
      icon: Camera,
      title: 'Offline Field Scanners',
      desc: 'Smartphones operate 100% offline during formation drills, syncing via high-density QR batches when in range.'
    },
    {
      icon: Database,
      title: 'Supabase Cloud Database',
      desc: 'PostgreSQL-backed live cloud database ensuring immutable historical logs, automated backups, and real-time syncing.'
    },
    {
      icon: FileSpreadsheet,
      title: 'Automated Excel Reports',
      desc: 'Generate multi-sheet official muster spreadsheets formatted by Battalion and Company with official PA letterheads.'
    },
    {
      icon: QrCode,
      title: 'ROTC ID Card Generator',
      desc: 'Instant batch generation of 2-sided printable laminated ID cards with high-density encrypted QR codes.'
    },
    {
      icon: Activity,
      title: 'Attendance Analytics',
      desc: 'Real-time formation turnout rates, tardiness tracking, and date-specific absence inspection matrices.'
    }
  ];

  return (
    <>
      {/* Tactical Radar Overlay for Navigation Transitions */}
      {isNavigating && (
        <MilitaryLoader
          mode="admin"
          variant="fullscreen"
          staticPhrase={navPhrase}
        />
      )}
      <div
        style={{
          height: '100vh',
          width: '100%',
          maxWidth: '100%',
          background: '#f8fafc',
          color: '#1e293b',
          fontFamily: 'Inter, system-ui, sans-serif',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Public Navigation Bar */}
        <header
          style={{
            background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
            color: '#ffffff',
            padding: '1rem clamp(1rem, 3vw, 2rem)',
            borderBottom: '2px solid #e5a900',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%'
          }}
        >
          {/* Unit Branding Container */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '100%', minWidth: 0 }}>
            <div
              style={{
                width: 'clamp(36px, 8vw, 42px)',
                height: 'clamp(36px, 8vw, 42px)',
                borderRadius: '50%',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <img
                src={centerEmblem.url || "/rotc-seal-transparent.png"}
                alt="CSU ROTC Unit Seal"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  if (e.target.src !== window.location.origin + '/rotc-seal-transparent.png') {
                    e.target.src = '/rotc-seal-transparent.png';
                  } else {
                    e.target.style.display = 'none';
                  }
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: 'clamp(1.05rem, 3.5vw, 1.25rem)',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    color: '#ffffff',
                    lineHeight: 1.2
                  }}
                >
                  {unitName || "CSU MAIN ROTC UNIT"}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: 'rgba(229, 169, 0, 0.2)',
                    color: '#facc15',
                    border: '1px solid rgba(229, 169, 0, 0.5)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ADMIN
                </span>
              </div>
              <div
                style={{
                  fontSize: 'clamp(0.66rem, 2.2vw, 0.74rem)',
                  color: '#cbd5e1',
                  fontWeight: 500,
                  lineHeight: 1.3,
                  marginTop: '1px'
                }}
              >
                1501st CDC • 15th RCDG • ARESCOM • PHILIPPINE ARMY
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href={CADET_PORTAL_URL}
              style={{
                background: 'rgba(229, 169, 0, 0.15)',
                border: '1.5px solid #e5a900',
                color: '#facc15',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Users size={15} /> Cadet Portal
            </a>
          </div>
        </header>

        {/* Embedded Responsive Media Query Styles */}
        <style>{`
        .min-h-screen {
          min-height: 100vh;
          min-height: 100dvh;
        }
        .admin-hero-section {
          min-height: calc(100vh - 68px) !important;
          min-height: calc(100dvh - 68px) !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: space-between !important;
        }
        .admin-seal-side {
          width: 3.5rem !important;  /* w-14 (56px) */
          height: 3.5rem !important; /* h-14 (56px) */
          padding: 5px !important;
          flex-shrink: 0 !important;
        }
        .admin-seal-center {
          width: 8rem !important;    /* w-32 (128px) */
          height: 8rem !important;   /* h-32 (128px) */
          padding: 10px !important;
          flex-shrink: 0 !important;
        }
        @media (min-width: 768px) {
          .admin-seal-side {
            width: 5rem !important;   /* md:w-20 (80px) */
            height: 5rem !important;  /* md:h-20 (80px) */
            padding: 7px !important;
          }
          .admin-seal-center {
            width: 11rem !important;  /* md:w-44 (176px) */
            height: 11rem !important; /* md:h-44 (176px) */
            padding: 12px !important;
          }
        }
        @media (max-width: 648px) {
          .admin-hero-section {
            min-height: calc(100vh - 60px) !important;
            min-height: calc(100dvh - 60px) !important;
            padding: 1.25rem 0.75rem !important;
          }
          .admin-seal-side {
            width: 2.25rem !important;
            height: 2.25rem !important;
            padding: 2px !important;
          }
          .admin-seal-center {
            width: 7rem !important;
            height: 7rem !important;
            padding: 8px !important;
          }
        }
      `}</style>

        {/* Hero Section */}
        <section
          className="admin-hero-section min-h-screen flex-1 flex flex-col items-center justify-between"
          style={{
            background: 'radial-gradient(circle at 50% 20%, #064e2e 0%, #043820 60%, #021a0f 100%)',
            color: '#ffffff',
            minHeight: 'calc(100vh - 68px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2rem 1.25rem 2.5rem 1.25rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'visible',
            boxSizing: 'border-box',
            width: '100%'
          }}
        >
          {/* Subtle Background Camo Grid Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(229, 169, 0, 0.1) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              pointerEvents: 'none'
            }}
          />

          <div className="flex-1 flex flex-col items-center justify-between" style={{ maxWidth: '840px', margin: 'auto', position: 'relative', zIndex: 1, width: '100%' }}>
            {/* Dynamic Connected Military & Academic Seals / Badges Banner */}
            <div
              className="admin-seals-cluster mb-6 md:mb-8"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(0.45rem, 1.8vw, 1.4rem)',
                margin: '1.5rem auto',
                flexWrap: 'nowrap',
                maxWidth: '920px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {visibleEmblems.map((emblem, idx) => {
                const isCenter = !!emblem.is_center;
                return (
                  <div
                    key={emblem.id || `emblem-${idx}`}
                    title={emblem.label}
                    className={isCenter ? 'admin-seal-center' : 'admin-seal-side'}
                    style={
                      isCenter
                        ? {
                          width: 'clamp(8rem, 15vw, 11rem)',
                          height: 'clamp(8rem, 15vw, 11rem)',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
                          border: '4.5px solid #e5a900',
                          boxShadow: '0 18px 52px rgba(0, 0, 0, 0.7), 0 0 48px rgba(229, 169, 0, 0.6), 0 0 90px rgba(250, 204, 21, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px',
                          flexShrink: 0,
                          zIndex: 2,
                          overflow: 'visible',
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                        }
                        : {
                          width: 'clamp(3.5rem, 6.5vw, 5rem)',
                          height: 'clamp(3.5rem, 6.5vw, 5rem)',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(6, 78, 46, 0.6) 0%, rgba(3, 43, 25, 0.8) 100%)',
                          border: '2.5px solid rgba(229, 169, 0, 0.65)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 15px rgba(229, 169, 0, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          flexShrink: 0,
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                        }
                    }
                  >
                    <img
                      src={emblem.url || '/rotc-seal-transparent.png'}
                      alt={emblem.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        borderRadius: isCenter ? '0%' : '50%',
                        filter: isCenter
                          ? 'drop-shadow(0 0 24px rgba(229, 169, 0, 0.65)) drop-shadow(0 8px 18px rgba(0, 0, 0, 0.5))'
                          : 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))'
                      }}
                      onError={(e) => {
                        if (e.target.src !== window.location.origin + '/rotc-seal-transparent.png') {
                          e.target.src = '/rotc-seal-transparent.png';
                        } else {
                          e.target.style.display = 'none';
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Official Badge Pill */}
            <div
              className="admin-badge-pill mb-6"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(229, 169, 0, 0.4)',
                padding: '5px 14px',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#e5a900',
                marginBottom: '1.5rem',
                textTransform: 'uppercase'
              }}
            >
              <Shield size={14} style={{ flexShrink: 0 }} />
              <span>HONOR • PATRIOTISM • DUTY</span>
            </div>

            <h1
              className="admin-hero-title"
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: 'clamp(1.65rem, 5.5vw, 3.1rem)',
                fontWeight: 800,
                letterSpacing: '0.5px',
                lineHeight: 1.18,
                margin: '0 0 1rem 0',
                textTransform: 'uppercase',
                wordBreak: 'break-word'
              }}
            >
              Caraga State University<br />Reserve Officers' Training Corps<br />
              <span style={{ color: '#e5a900' }}>Corps of Cadets</span>
            </h1>

            <p
              className="admin-hero-sub mt-4 mb-8"
              style={{
                fontSize: 'clamp(0.88rem, 2.6vw, 1.1rem)',
                color: '#e2e8f0',
                maxWidth: '680px',
                margin: '1rem auto 2rem auto',
                lineHeight: 1.6,
                fontWeight: 400
              }}
            >
              The official centralized digital muster system for CSU Main ROTCU. Built for real-time attendance scanning, automated multi-sheet military exports, and master roster management.
            </p>

            {/* Call to Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              {isAuthenticated ? (
                <button
                  type="button"
                  className="admin-cta-btn"
                  onClick={() => navigateWithLoader('Initializing Command Center...', onNavigateToDashboard)}
                  style={{
                    background: 'linear-gradient(135deg, #e5a900 0%, #b45309 100%)',
                    color: '#064e2e',
                    border: 'none',
                    padding: '0.95rem 2.4rem',
                    minHeight: '48px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: 'clamp(0.98rem, 2.8vw, 1.08rem)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 20px rgba(229, 169, 0, 0.45)',
                    transition: 'all 0.15s ease',
                    letterSpacing: '0.3px',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(229, 169, 0, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(229, 169, 0, 0.45)';
                  }}
                >
                  <Shield size={20} style={{ flexShrink: 0 }} /> Open Command Center Dashboard <ChevronRight size={20} style={{ flexShrink: 0 }} />
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-cta-btn"
                  onClick={() => navigateWithLoader('Initializing Command Center...', onNavigateToLogin)}
                  style={{
                    background: 'linear-gradient(135deg, #e5a900 0%, #d97706 100%)',
                    color: '#064e2e',
                    border: 'none',
                    padding: '0.95rem 2.4rem',
                    minHeight: '48px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: 'clamp(0.98rem, 2.8vw, 1.08rem)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 20px rgba(229, 169, 0, 0.45)',
                    transition: 'all 0.15s ease',
                    letterSpacing: '0.3px',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(229, 169, 0, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(229, 169, 0, 0.45)';
                  }}
                >
                  <LogIn size={20} style={{ flexShrink: 0 }} /> Access Command Center <ChevronRight size={20} style={{ flexShrink: 0 }} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Quick Unit Command Overview Bar */}
        <section
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '1.5rem 1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              width: '100%',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#064e2e' }}>
                <Building size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Host Institution</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{hostInstitution}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#064e2e' }}>
                <Award size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Unit Commandant</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{commandant}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#064e2e' }}>
                <Users size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Corps Strength</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{corpsStrength.toLocaleString()} Cadets & Officers</div>
              </div>
            </div>
          </div>
        </section>

        {/* Core System Capabilities Feature Grid */}
        <section style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '3.5rem 1.5rem', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.85rem', color: '#064e2e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Military-Grade Attendance Architecture
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px', maxWidth: '600px', margin: '6px auto 0 auto' }}>
              Designed for high-throughput weekend formations, offline drill field muster, and instant cloud reconciliation.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #064e2e 0%, #043820 100%)',
                      color: '#e5a900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem'
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FOOTER (Mobile-Wrapped Layout)                                            */}
        {/* ========================================================================= */}
        <footer
          style={{
            background: '#0f172a',
            color: '#94a3b8',
            padding: '2.25rem clamp(1rem, 3vw, 1.5rem)',
            borderTop: '2px solid #e5a900',
            textAlign: 'center',
            fontSize: '0.8rem',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%'
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
            <div
              style={{
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 'clamp(0.88rem, 2.5vw, 0.95rem)',
                marginBottom: '4px',
                lineHeight: 1.3
              }}
            >
              Caraga State University Main
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', lineHeight: 1.5 }}>
              Department of Military Science & Tactics (DMST) <br /> Ampayon, Butuan City, Agusan del Norte, Philippines
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.85rem',
                flexWrap: 'wrap',
                fontSize: '0.75rem',
                color: '#64748b'
              }}
            >
              <span style={{ color: '#e5a900', fontWeight: 700 }}>Cpl Christian B Abamo PA (Res) </span>


            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
