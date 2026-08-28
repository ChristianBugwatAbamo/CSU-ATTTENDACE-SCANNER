import React from 'react';
import { 
  QrCode, 
  ShieldCheck, 
  ArrowRight, 
  Wifi, 
  WifiOff 
} from 'lucide-react';

export default function ScannerLandingView({ 
  onStartScanning, 
  isOffline = true
}) {
  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto relative overflow-hidden font-sans"
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b1329',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.5rem 1.25rem',
        maxWidth: '480px',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      {/* Background Subtle Glowing Gradients */}
      <div 
        className="absolute -top-20 -left-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" 
        style={{
          position: 'absolute',
          top: '-80px',
          left: '-80px',
          width: '260px',
          height: '260px',
          backgroundColor: 'rgba(245, 158, 11, 0.14)',
          borderRadius: '9999px',
          filter: 'blur(52px)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div 
        className="absolute -bottom-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" 
        style={{
          position: 'absolute',
          bottom: '-80px',
          right: '-80px',
          width: '260px',
          height: '260px',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          borderRadius: '9999px',
          filter: 'blur(52px)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* TOP BAR / SYSTEM STATUS */}
      <div 
        className="flex items-center justify-between pt-2 pb-4 z-10"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.5rem',
          paddingBottom: '1rem',
          zIndex: 10,
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.18)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24'
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 
              style={{
                fontSize: '0.8rem',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: '#ffffff',
                textTransform: 'uppercase',
                margin: 0,
                lineHeight: 1.2
              }}
            >
              CSU ROTCU
            </h1>
            <p 
              style={{
                fontSize: '0.625rem',
                color: '#94a3b8',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: 0
              }}
            >
              Unit Scanner App
            </p>
          </div>
        </div>

        {/* Network / Storage Status Badge */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.3rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            border: isOffline ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
            backgroundColor: isOffline ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: isOffline ? '#fbbf24' : '#34d399'
          }}
        >
          {isOffline ? <WifiOff size={12} /> : <Wifi size={12} />}
          <span>{isOffline ? 'OFFLINE DB ACTIVE' : 'ONLINE SYNC'}</span>
        </div>
      </div>

      {/* HERO / CENTER SECTION */}
      <div 
        style={{
          margin: 'auto 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          zIndex: 10,
          padding: '0.75rem 0',
          position: 'relative'
        }}
      >
        {/* Enlarged CSU ROTC Unit Logo */}
        <div 
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            style={{
              position: 'absolute',
              width: '200px',
              height: '200px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(245, 158, 11, 0.28)',
              filter: 'blur(36px)',
              pointerEvents: 'none'
            }}
          />
          <img
            src="./rotc-seal-transparent.png"
            alt="CSU ROTC Unit Logo"
            className="w-44 h-44 sm:w-48 sm:h-48"
            style={{
              width: '184px',
              height: '184px',
              maxWidth: '52vw',
              maxHeight: '52vw',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 12px 28px rgba(0, 0, 0, 0.75))'
            }}
          />
        </div>

        {/* Main Branding Headings */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <h2 
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              textTransform: 'uppercase',
              lineHeight: 1.15,
              margin: 0
            }}
          >
            Rapid Cadet <br />
            <span style={{ color: '#fbbf24' }}>Attendance Sync</span>
          </h2>
          
          <p 
            style={{
              fontSize: '0.82rem',
              color: '#94a3b8',
              maxWidth: '300px',
              margin: '0 auto',
              lineHeight: 1.5,
              fontWeight: 500
            }}
          >
            Scan cadet ID QR codes offline during field formation and sync directly to HQ via Webcam Batch QR.
          </p>
        </div>

        {/* PRIMARY ACTION BUTTON */}
        <div style={{ width: '100%', maxWidth: '340px', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onStartScanning}
            style={{
              width: '100%',
              padding: '1.05rem 1.5rem',
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
              color: '#020617',
              fontWeight: 900,
              fontSize: '0.92rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.2s ease'
            }}
          >
            <QrCode size={22} color="#020617" />
            <span>Launch Field Scanner</span>
            <ArrowRight size={20} color="#020617" />
          </button>
        </div>
      </div>

      {/* FOOTER METADATA */}
      <div 
        style={{
          textAlign: 'center',
          paddingTop: '0.85rem',
          paddingBottom: '0.25rem',
          borderTop: '1px solid #1e293b',
          fontSize: '0.65rem',
          color: '#64748b',
          fontWeight: 600,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        <span>CSU ROTCU v2.4 (Offline Engine)</span>
        <span style={{ color: '#94a3b8' }}>HQ Sync Compatible</span>
      </div>

    </div>
  );
}
