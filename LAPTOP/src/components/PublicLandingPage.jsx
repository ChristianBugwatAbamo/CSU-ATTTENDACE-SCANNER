import React, { useState, useEffect } from 'react';
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

export default function PublicLandingPage({
  onNavigateToLogin,
  onNavigateToDashboard,
  isAuthenticated,
  currentUser
}) {
  const currentYear = new Date().getFullYear();

  const [commandant, setCommandant] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.commandingOfficer) return parsed.commandingOfficer;
      }
    } catch (_) {}
    return 'LTC CHRISTIAN B ABAMO INF (GSC) PA';
  });

  const [hostInstitution, setHostInstitution] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.hostInstitution) return parsed.hostInstitution;
      }
    } catch (_) {}
    return 'Caraga State University';
  });

  const [unitName, setUnitName] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.unitName) return parsed.unitName;
      }
    } catch (_) {}
    return 'CSU MAIN ROTC UNIT';
  });

  const [corpsStrength, setCorpsStrength] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_cadets_roster');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      }
    } catch (_) {}
    return 1194;
  });

  useEffect(() => {
    let isMounted = true;

    async function loadBrandingSettings() {
      try {
        const data = await fetchSettingsFromSupabase();
        if (isMounted && data) {
          if (data.commanding_officer) setCommandant(data.commanding_officer);
          if (data.host_institution) setHostInstitution(data.host_institution);
          if (data.unit_name) setUnitName(data.unit_name);
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

    return () => {
      isMounted = false;
    };
  }, []);

  const features = [
    {
      icon: Users,
      title: 'Master Cadet Roster',
      desc: 'Complete 1,194 cadet ledger organized into Battalions, Companies, and Platoons with real-time echelon tracking.'
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
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#f8fafc',
        color: '#1e293b',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflowX: 'hidden'
      }}
    >
      {/* Top Public Navigation Bar */}
      <header
        style={{
          background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
          color: '#ffffff',
          padding: '1rem 2rem',
          borderBottom: '2px solid #e5a900',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        {/* Unit Title */}
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.5px', color: '#ffffff' }}>
            {unitName}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 500 }}>
            Attendance & Corps Roster Management System
          </div>
        </div>


      </header>

      {/* Hero Section */}
      <section
        style={{
          background: 'radial-gradient(circle at 50% 20%, #064e2e 0%, #043820 60%, #021a0f 100%)',
          color: '#ffffff',
          padding: '4.5rem 1.5rem 5rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
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

        <div style={{ maxWidth: '840px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* CSU ROTC Official Logo / Seal (Significantly Enlarged) */}
          <div
            style={{
              width: 'clamp(140px, 18vw, 180px)',
              height: 'clamp(140px, 18vw, 180px)',
              margin: '0 auto 1.5rem auto',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
              border: '4px solid #e5a900',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.55), 0 0 30px rgba(229, 169, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              transition: 'transform 0.3s ease'
            }}
          >
            <img
              src="/rotc-seal-transparent.png"
              alt="CSU ROTC Official Seal"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>

          {/* Official Badge Pill */}
          <div
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
            <Shield size={14} />
            <span>1501st CDC • 15th RCDG • ARESCOM • PHILIPPINE ARMY</span>
          </div>

          <h1
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              fontWeight: 800,
              letterSpacing: '1px',
              lineHeight: 1.15,
              margin: '0 0 1.25rem 0',
              textTransform: 'uppercase'
            }}
          >
            Caraga State University<br />
            <span style={{ color: '#e5a900' }}>ROTC Corps of Cadets</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
              color: '#e2e8f0',
              maxWidth: '680px',
              margin: '0 auto 2.25rem auto',
              lineHeight: 1.6,
              fontWeight: 400
            }}
          >
            The official centralized digital muster system for CSU Main Campus. Built for real-time echelon attendance scanning, automated multi-sheet military exports, and master roster management.
          </p>

          {/* Call to Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                style={{
                  background: 'linear-gradient(135deg, #e5a900 0%, #b45309 100%)',
                  color: '#064e2e',
                  border: 'none',
                  padding: '0.85rem 1.85rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(229, 169, 0, 0.4)'
                }}
              >
                <Shield size={18} /> Open Command Center Dashboard <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToLogin}
                style={{
                  background: 'linear-gradient(135deg, #e5a900 0%, #d97706 100%)',
                  color: '#064e2e',
                  border: 'none',
                  padding: '0.85rem 1.85rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(229, 169, 0, 0.4)',
                  transition: 'all 0.15s ease'
                }}
              >
                <LogIn size={18} /> Access Command Center <ChevronRight size={18} />
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
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
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
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '3.5rem 1.5rem' }}>
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

      {/* Public Footer */}
      <footer
        style={{
          background: '#0f172a',
          color: '#94a3b8',
          padding: '2.5rem 1.5rem',
          borderTop: '1px solid #1e293b',
          textAlign: 'center',
          fontSize: '0.8rem'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
            Caraga State University Main ROTC Unit
          </div>
          <p style={{ margin: '0 0 1rem 0' }}>
            Ampayon, Butuan City, Agusan del Norte, Philippines
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b' }}>
            <span>© {currentYear} CSU ROTC Unit. All Rights Reserved.</span>

          </div>
        </div>
      </footer>
    </div>
  );
}
