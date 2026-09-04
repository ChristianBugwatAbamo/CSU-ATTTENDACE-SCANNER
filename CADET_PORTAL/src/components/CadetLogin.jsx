import React, { useState } from 'react';
import { Shield, ArrowLeft, User, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { fetchCadetByCadetId } from '../utils/supabaseClient';

export default function CadetLogin({ onCadetLoginSuccess, onBackToHome }) {
  const [cadetIdInput, setCadetIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-formatting mask: XXX-XXXXX (e.g., 221-01231)
  const handleInputChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const trimmed = raw.slice(0, 8); // Max 8 characters: 3 prefix + 5 suffix

    let formatted = trimmed;
    if (trimmed.length > 3) {
      formatted = `${trimmed.slice(0, 3)}-${trimmed.slice(3)}`;
    }

    setCadetIdInput(formatted);
    if (errorMsg) setErrorMsg('');
  };

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    const cleanId = cadetIdInput.trim();
    if (!cleanId) {
      setErrorMsg('Please enter your Cadet ID Number (e.g. 221-01231).');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Direct Supabase database verification
      const cadet = await fetchCadetByCadetId(cleanId);
      if (cadet) {
        const sessionPayload = {
          cadet,
          loginAt: new Date().toISOString()
        };
        try {
          localStorage.setItem('csu_rotc_cadet_session', JSON.stringify(sessionPayload));
        } catch (_) {}
        if (onCadetLoginSuccess) {
          onCadetLoginSuccess(cadet);
        }
      } else {
        setErrorMsg(`Cadet ID "${cleanId}" was not found in the official CSU ROTC database. Please verify your ID number or report to your Platoon Sergeant.`);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Unable to connect to Supabase database. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(circle at 50% 30%, #064e2e 0%, #032b1a 60%, #01180d 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Background Camo / Tactical Subtle Pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(245, 158, 11, 0.06) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none'
        }}
      />

      {/* Top Navigation / Return Home Button */}
      <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem', zIndex: 10 }}>
        <button
          type="button"
          onClick={onBackToHome}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e2e8f0',
            padding: '0.45rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
        >
          <ArrowLeft size={15} /> Return to Home
        </button>
      </div>

      {/* Main Login Card - Streamlined & Centered */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'rgba(7, 33, 22, 0.92)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(16px)',
          padding: '2rem 1.75rem',
          zIndex: 1,
          position: 'relative',
          boxSizing: 'border-box',
          margin: 'auto 0'
        }}
      >
        {/* Seal & Streamlined Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 0.75rem auto',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
              border: '2.5px solid #e5a900',
              boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px'
            }}
          >
            <img
              src="/rotc-seal-transparent.png"
              alt="CSU ROTC Seal"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(229, 169, 0, 0.12)',
              border: '1px solid rgba(229, 169, 0, 0.3)',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#facc15',
              letterSpacing: '0.4px',
              marginBottom: '0.4rem',
              textTransform: 'uppercase'
            }}
          >
            <Shield size={12} /> Cadet Portal
          </div>

          <h1
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1.55rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              margin: '0 0 0.25rem 0',
              textTransform: 'uppercase',
              color: '#ffffff'
            }}
          >
            CSU ROTC Cadet Portal
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Enter your Cadet ID Number to access your profile, unit, and attendance history.
          </p>
        </div>

        {/* Softened Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '0.7rem 0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
              lineHeight: 1.4
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#f87171' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit}>
          <div style={{ marginBottom: '1.1rem' }}>
            <label
              htmlFor="cadet-id-input"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.4px',
                color: '#cbd5e1',
                textTransform: 'uppercase',
                marginBottom: '0.4rem'
              }}
            >
              Cadet ID Number
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none'
                }}
              >
                <User size={18} />
              </div>
              <input
                id="cadet-id-input"
                type="text"
                value={cadetIdInput}
                onChange={handleInputChange}
                placeholder="221-01231"
                autoComplete="off"
                autoFocus
                disabled={loading}
                maxLength={9} // 8 characters + 1 hyphen
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem 0.8rem 2.75rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1.5px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '10px',
                  color: '#fbbf24',
                  fontFamily: 'monospace, Courier, monospace',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#fbbf24';
                  e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Solid Gold/Amber Primary Action Button */}
          <button
            type="submit"
            disabled={loading || !cadetIdInput.trim()}
            style={{
              width: '100%',
              background: loading || !cadetIdInput.trim()
                ? 'rgba(229, 169, 0, 0.3)'
                : '#e5a900',
              color: loading || !cadetIdInput.trim() ? '#94a3b8' : '#0b0f19',
              border: 'none',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.98rem',
              letterSpacing: '0.3px',
              cursor: loading || !cadetIdInput.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: loading || !cadetIdInput.trim()
                ? 'none'
                : '0 2px 8px rgba(0, 0, 0, 0.25)',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading && cadetIdInput.trim()) {
                e.currentTarget.style.background = '#d97706';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && cadetIdInput.trim()) {
                e.currentTarget.style.background = '#e5a900';
              }
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Verifying Cadet Record...
              </>
            ) : (
              <>
                Access Cadet Portal <ChevronRight size={18} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Security / System Footer */}
        <div
          style={{
            marginTop: '1.25rem',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: '#64748b'
          }}
        >
          Caraga State University Main ROTC Unit
        </div>
      </div>
    </div>
  );
}
