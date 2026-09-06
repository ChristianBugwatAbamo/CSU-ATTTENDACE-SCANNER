import React, { useState } from 'react';
import {
  Shield,
  Clock,
  Calendar,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Award,
  HelpCircle,
  AlertOctagon,
  ArrowRight,
  FileCheck,
  Building,
  Users,
  QrCode,
  LogIn,
  Info,
  FileText,
  MapPin
} from 'lucide-react';

export default function CadetLandingPage({ onOpenLogin }) {
  const currentYear = new Date().getFullYear();
  const [activeFaq, setActiveFaq] = useState(null);

  const faqs = [
    {
      q: 'What is the minimum attendance required to pass CSU ROTC?',
      a: 'Cadets must complete at least 80% attendance rate from the scheduled formation drills. Accumulating four (4) unexcused absences results in being officially Dropped from the Roll (DRP).'
    },
    {
      q: 'How does the morning formation cut-off time work?',
      a: 'Saturday/Sunday morning formation calls begin promptly at 0700H (07:00 AM). Scans completed after the configured cut-off time (e.g., 07:15 AM or 07:30 AM as designated by the Admin) are marked as Late / Tardy with amber badges and incur demerit points.'
    },
    {
      q: 'How can I submit an excuse letter or medical certificate?',
      a: 'Excused absences must be filed within 5 calendar days after the formation date to the Platoon Leader / S1 Personnel. Medical receipt must be verified.'
    },
    {
      q: 'How do I present my digital Cadet ID during Saturday/Sunday formation?',
      a: 'Log into this portal with your Cadet ID, navigate to the Digital ID Card tab, and present the high-density QR code on your mobile phone screen for immediate optical scanning by duty officers.'
    }
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f8fafc',
        color: '#1e293b',
        fontFamily: "'Inter', -apple-system, sans-serif",
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* Embedded Mobile-Responsive Media Query Styles */}
      <style>{`
        .min-h-screen {
          min-height: 100vh;
          min-height: 100dvh;
        }
        .cadet-hero-section {
          min-height: calc(100vh - 68px) !important;
          min-height: calc(100dvh - 68px) !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
        }
        @media (max-width: 640px) {
          .cadet-landing-header {
            padding: 0.75rem 1rem !important;
          }
          .cadet-brand-title {
            font-size: 1.05rem !important;
          }
          .cadet-hero-section {
            min-height: calc(100vh - 60px) !important;
            min-height: calc(100dvh - 60px) !important;
            padding: 2.25rem 1rem 2.75rem 1rem !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .cadet-hero-seal {
            width: 140px !important;
            height: 140px !important;
            margin-bottom: 1rem !important;
          }
          .cadet-hero-title {
            font-size: 1.6rem !important;
            line-height: 1.22 !important;
          }
          .cadet-hero-sub {
            font-size: 0.86rem !important;
            margin-bottom: 1.35rem !important;
          }
          .cadet-cta-btn {
            width: 100% !important;
            max-width: 320px !important;
            justify-content: center !important;
            padding: 0.95rem 1.5rem !important;
          }
          .cadet-section-container {
            padding: 2.25rem 1rem !important;
          }
          .cadet-policy-card-wrapper {
            padding: 1.15rem 1rem !important;
          }
          .cadet-policy-grid {
            grid-template-columns: 1fr !important;
          }
          .cadet-faq-btn {
            padding: 0.95rem 1rem !important;
            font-size: 0.88rem !important;
          }
          .cadet-faq-answer {
            padding: 0 1rem 1rem 1.5rem !important;
            font-size: 0.82rem !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* TOP NAVIGATION BAR (Adaptive & Mobile-Friendly)                           */}
      {/* ========================================================================= */}
      <header
        className="cadet-landing-header"
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
          boxSizing: 'border-box'
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
              src="/rotc-seal-transparent.png"
              alt="CSU ROTC Unit Seal"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                className="cadet-brand-title"
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: 'clamp(1.05rem, 3.5vw, 1.25rem)',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  color: '#ffffff',
                  lineHeight: 1.2
                }}
              >
                CARAGA STATE UNIVERSITY
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
                CADET PORTAL
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
      </header>

      {/* ========================================================================= */}
      {/* HERO SECTION (Fluid Typography & Adaptive Spacing)                       */}
      {/* ========================================================================= */}
      <section
        className="cadet-hero-section min-h-screen"
        style={{
          background: 'radial-gradient(circle at 50% 20%, #064e2e 0%, #043820 60%, #021a0f 100%)',
          color: '#ffffff',
          minHeight: 'calc(100vh - 68px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.25rem 3.5rem 1.25rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          width: '100%'
        }}
      >
        {/* Subtle Camo Grid Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(229, 169, 0, 0.1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none'
          }}
        />

        <div style={{ maxWidth: '860px', margin: '0 auto', position: 'relative', zIndex: 1, padding: '0 0.5rem' }}>
          {/* 5-Logo Row Banner: RCDG → CDC → ROTC (Featured Center) → NSTP → CSU */}
          <div
            className="cadet-logos-banner-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'safe center',
              gap: 'clamp(0.25rem, 1.4vw, 1.4rem)',
              margin: '0 auto 1.5rem auto',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              maxWidth: '100%',
              width: '100%',
              padding: '6px 8px 12px 8px',
              boxSizing: 'border-box'
            }}
          >
            {/* 1. Far Left: RCDG Logo */}
            <div
              title="15th Regional Community Defense Group (15RCDG)"
              style={{
                width: 'clamp(42px, 7vw, 100px)',
                height: 'clamp(42px, 7vw, 100px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(6, 78, 46, 0.6) 0%, rgba(3, 43, 25, 0.8) 100%)',
                border: 'clamp(1.5px, 0.25vw, 2.5px) solid rgba(229, 169, 0, 0.6)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 15px rgba(229, 169, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'clamp(3px, 0.6vw, 6px)',
                flexShrink: 0,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              <img
                src="/rcdg-logo.png"
                alt="15th Regional Community Defense Group"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '50%',
                  filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* 2. Left Center: CDC Logo */}
            <div
              title="1501st Community Defense Center (1501st CDC)"
              style={{
                width: 'clamp(50px, 8.5vw, 116px)',
                height: 'clamp(50px, 8.5vw, 116px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(6, 78, 46, 0.6) 0%, rgba(3, 43, 25, 0.8) 100%)',
                border: 'clamp(1.5px, 0.25vw, 2.5px) solid rgba(229, 169, 0, 0.7)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 18px rgba(229, 169, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'clamp(4px, 0.7vw, 7px)',
                flexShrink: 0,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              <img
                src="/cdc-logo.png"
                alt="1501st Community Defense Center"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '50%',
                  filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* 3. Center: Featured Main ROTC Emblem (Significantly Enlarged) */}
            <div
              className="cadet-hero-seal"
              title="Caraga State University ROTC Unit"
              style={{
                width: 'clamp(95px, 17vw, 235px)',
                height: 'clamp(95px, 17vw, 235px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
                border: 'clamp(2.5px, 0.4vw, 4.5px) solid #e5a900',
                boxShadow: '0 18px 52px rgba(0, 0, 0, 0.7), 0 0 48px rgba(229, 169, 0, 0.6), 0 0 90px rgba(250, 204, 21, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'clamp(6px, 1.2vw, 12px)',
                flexShrink: 0,
                zIndex: 2,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              <img
                src="/rotc-seal-transparent.png"
                alt="Caraga State University Reserve Officers' Training Corps"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 24px rgba(229, 169, 0, 0.65)) drop-shadow(0 8px 18px rgba(0, 0, 0, 0.5))'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* 4. Right Center: NSTP Logo */}
            <div
              title="National Service Training Program (NSTP CSU)"
              style={{
                width: 'clamp(50px, 8.5vw, 116px)',
                height: 'clamp(50px, 8.5vw, 116px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(6, 78, 46, 0.6) 0%, rgba(3, 43, 25, 0.8) 100%)',
                border: 'clamp(1.5px, 0.25vw, 2.5px) solid rgba(229, 169, 0, 0.7)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 18px rgba(229, 169, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'clamp(4px, 0.7vw, 7px)',
                flexShrink: 0,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              <img
                src="/nstp-logo.png"
                alt="National Service Training Program"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '50%',
                  filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* 5. Far Right: CSU Logo */}
            <div
              title="Caraga State University (CSU Main)"
              style={{
                width: 'clamp(42px, 7vw, 100px)',
                height: 'clamp(42px, 7vw, 100px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(6, 78, 46, 0.6) 0%, rgba(3, 43, 25, 0.8) 100%)',
                border: 'clamp(1.5px, 0.25vw, 2.5px) solid rgba(229, 169, 0, 0.6)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 15px rgba(229, 169, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'clamp(3px, 0.6vw, 6px)',
                flexShrink: 0,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              <img
                src="/csu-logo.png"
                alt="Caraga State University"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '50%',
                  filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          </div>

          {/* Official Badge Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(229, 169, 0, 0.4)',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: 'clamp(0.7rem, 2.2vw, 0.78rem)',
              fontWeight: 700,
              color: '#e5a900',
              marginBottom: '1.15rem',
              textTransform: 'uppercase',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            <Shield size={13} style={{ flexShrink: 0 }} />
            <span>HONOR • PATRIOTISM • DUTY</span>
          </div>

          {/* Main Hero Title - Fluid Breakpoint Scaling */}
          <h1
            className="cadet-hero-title"
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
            <span style={{ color: '#e5a900' }}>Cadet Attendance Portal</span>
          </h1>

          <p
            className="cadet-hero-sub"
            style={{
              fontSize: 'clamp(0.88rem, 2.6vw, 1.1rem)',
              color: '#e2e8f0',
              maxWidth: '680px',
              margin: '0 auto 2rem auto',
              lineHeight: 1.6,
              fontWeight: 400
            }}
          >
            Check your formation drill logs, monitor cut-off times, inspect merits and demerits,
            and access your official digital cadet identification pass.
          </p>

          {/* Primary Action Button - Touch Friendly */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="cadet-cta-btn"
              onClick={onOpenLogin}
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
                e.currentTarget.style.boxShadow = '0 6px 25px rgba(229, 169, 0, 0.55)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(229, 169, 0, 0.45)';
              }}
            >
              <Shield size={20} style={{ flexShrink: 0 }} /> Cadet Sign In <ArrowRight size={20} style={{ flexShrink: 0 }} />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FORMATION HOURS, EXCUSES & COMMAND OFFICE INFO BAR (3-Column Info Bar)    */}
      {/* ========================================================================= */}
      <section
        className="cadet-section-container"
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '2.5rem clamp(1rem, 3.5vw, 1.5rem) 1.5rem clamp(1rem, 3.5vw, 1.5rem)',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <Clock size={20} color="#e5a900" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#064e2e' }}>Drill Formation Hours</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', lineHeight: 1.45 }}>
                Time-In starts at 07:00 AM. Scans past 07:30 AM are tagged as Tardy/Late. Dismissal time-out starts at 12:00 PM or 5:00 PM.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <FileText size={20} color="#e5a900" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#064e2e' }}>Official Excuse Justifications</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', lineHeight: 1.45 }}>
                Submit medical certificates or university official duty excuse letters to your Platoon Leader or S1 within 5 school days.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <MapPin size={20} color="#e5a900" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#064e2e' }}>Unit Command Office</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', lineHeight: 1.45 }}>
                Caraga State University Main ROTC Unit, Main Campus, Ampayon, Butuan City.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ATTENDANCE POLICIES & 4-ABSENCE DROP NOTICE                               */}
      {/* ========================================================================= */}
      <section
        style={{
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          padding: '3rem clamp(1rem, 3.5vw, 1.5rem)',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              justifyContent: 'space-between',
              gap: '2rem'
            }}
          >
            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#fee2e2',
                  border: '1px solid #ef4444',
                  color: '#b91c1c',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem'
                }}
              >
                <AlertOctagon size={14} style={{ flexShrink: 0 }} /> Mandatory Policy Notice
              </div>
              <h2
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
                  fontWeight: 800,
                  color: '#064e2e',
                  margin: '0 0 0.75rem 0',
                  lineHeight: 1.25
                }}
              >
                The 4-Absence Drop Rule & Clearance Protocols
              </h2>
              <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                ROTC cadets must attend at least 80% of all scheduled formation drills. Any cadet who accumulates
                four (4) unexcused absences is officially classified as <strong>Dropped from the Roll (DRP)</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem', color: '#334155' }}>
                  <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span><strong>Valid Medical Excuses:</strong> State that valid medical excuses require attached proof (e.g., medical receipts) submitted within 5 days.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem', color: '#334155' }}>
                  <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span><strong>Official School Business:</strong> Academic competitions, research conventions, varsity meets or etc, requires a memorandum or dean endorsement.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem', color: '#334155' }}>
                  <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span><strong>Remedial Clearing:</strong> Consult your Platoon Leader or Duty Officer to clear demerit deductions via campus service.</span>
                </div>
              </div>
            </div>

            <div
              style={{
                flex: '1 1 280px',
                maxWidth: '380px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '16px',
                padding: 'clamp(1.25rem, 3vw, 1.75rem)',
                textAlign: 'center',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
                margin: '0 auto'
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
                  border: '2px solid #e5a900',
                  margin: '0 auto 0.85rem auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e5a900',
                  flexShrink: 0
                }}
              >
                <Shield size={26} />
              </div>
              <h3
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  fontFamily: "'Oswald', sans-serif",
                  margin: '0 0 0.4rem 0',
                  color: '#064e2e'
                }}
              >
                Need Assistance?
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                If you have an unrecorded time-in or attendance discrepancy, sign in to view your complete audit trail.
              </p>
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  width: '100%',
                  padding: '0.85rem 1.25rem',
                  minHeight: '46px',
                  background: 'linear-gradient(135deg, #e5a900 0%, #d97706 100%)',
                  color: '#064e2e',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(229, 169, 0, 0.3)',
                  boxSizing: 'border-box'
                }}
              >
                Proceed to Cadet Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FREQUENTLY ASKED QUESTIONS (FAQ) (Mobile-Clean Accordion)                 */}
      {/* ========================================================================= */}
      <section
        style={{
          padding: '3rem clamp(1rem, 3.5vw, 1.5rem)',
          maxWidth: '850px',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: 'clamp(1.4rem, 4vw, 1.9rem)',
              fontWeight: 800,
              margin: '0 0 0.4rem 0',
              color: '#064e2e',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Cadet FAQs & Guidelines
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
            Frequently asked questions about formation cut-off times, late badges, and excuse filing.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  boxSizing: 'border-box'
                }}
              >
                <button
                  type="button"
                  className="cadet-faq-btn"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '1.05rem 1.15rem',
                    minHeight: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    gap: '10px'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <HelpCircle size={18} color="#064e2e" style={{ flexShrink: 0 }} />
                    <span style={{ lineHeight: 1.35 }}>{faq.q}</span>
                  </span>
                  <ChevronRight
                    size={18}
                    style={{
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      flexShrink: 0,
                      color: '#94a3b8'
                    }}
                  />
                </button>
                {isOpen && (
                  <div
                    className="cadet-faq-answer"
                    style={{
                      padding: '0 1.15rem 1.15rem 2.75rem',
                      fontSize: '0.85rem',
                      color: '#475569',
                      lineHeight: 1.6,
                      boxSizing: 'border-box'
                    }}
                  >
                    {faq.a}
                  </div>
                )}
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
          boxSizing: 'border-box'
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
            Caraga State University Main ROTCU
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
            <span style={{ color: '#e5a900', fontWeight: 700 }}>HONOR • PATRIOTISM • DUTY</span>


          </div>
        </div>
      </footer>
    </div>
  );
}
