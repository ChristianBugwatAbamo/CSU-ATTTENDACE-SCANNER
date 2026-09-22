import React, { useState, useRef, useCallback } from 'react';
import { Shield, ArrowLeft, User, AlertCircle, Loader2, ChevronRight, X } from 'lucide-react';
import { fetchCadetByCadetId } from '../utils/supabaseClient';
import MilitaryLoader from './MilitaryLoader';

export default function CadetLogin({ onCadetLoginSuccess, onBackToHome }) {
  const [cadetIdInput, setCadetIdInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null); // { title: string, message: string }
  const hasError = Boolean(errorInfo);

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

  // Auto-formatting mask: XXX-XXXXX (digits only, max 8 digits)
  const handleInputChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    const trimmed = digitsOnly.slice(0, 8); // Max 8 digits: 3 prefix + 5 suffix

    let formatted = trimmed;
    if (trimmed.length > 3) {
      formatted = `${trimmed.slice(0, 3)}-${trimmed.slice(3)}`;
    }

    setCadetIdInput(formatted);
    if (errorInfo) setErrorInfo(null);
  };

  const handleLastNameChange = (e) => {
    setLastNameInput(e.target.value.toUpperCase());
    if (errorInfo) setErrorInfo(null);
  };

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    const cleanId = cadetIdInput.trim();
    const cleanLastName = lastNameInput.trim().toUpperCase();

    if (!cleanId && !cleanLastName) {
      setErrorInfo({
        title: 'Missing Credentials',
        message: 'Please enter both your Cadet ID Number and Last Name to sign in.'
      });
      return;
    }

    if (!cleanId) {
      setErrorInfo({
        title: 'Missing Cadet ID',
        message: 'Please enter your Cadet ID Number (e.g. 221-01231).'
      });
      return;
    }

    if (!cleanLastName) {
      setErrorInfo({
        title: 'Missing Last Name',
        message: 'Please enter your official Last Name (e.g. DELA CRUZ, ABAMO).'
      });
      return;
    }

    const digitsOnly = cleanId.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      setErrorInfo({
        title: 'Incomplete Cadet ID',
        message: 'Please enter your complete 8-digit Cadet ID (e.g. 221-00002).'
      });
      return;
    }

    setLoading(true);
    setErrorInfo(null);

    try {
      // Direct Supabase database verification requiring two-factor parameter match (student_id AND last_name)
      const cadet = await fetchCadetByCadetId(cleanId, cleanLastName);
      if (cadet) {
        const sessionPayload = {
          cadet,
          loginAt: new Date().toISOString()
        };
        try {
          localStorage.setItem('csu_rotc_cadet_session', JSON.stringify(sessionPayload));
        } catch (_) { }
        setLoading(false);
        navigateWithLoader('Verifying Cadet Credentials...', () => {
          if (onCadetLoginSuccess) onCadetLoginSuccess(cadet);
        }, 800);
        return;
      } else {
        setErrorInfo({
          title: 'Cadet ID Not Found',
          message: `Cadet ID "${cleanId}" was not found in the official CSU ROTC database. Please verify your ID number or report to your Platoon Sergeant.`
        });
      }
    } catch (err) {
      if (err.code === 'LAST_NAME_MISMATCH') {
        setErrorInfo({
          title: 'Last Name Mismatch',
          message: `The Last Name "${cleanLastName}" does not match the official record for Cadet ID "${cleanId}". Please check your spelling and try again.`
        });
      } else {
        console.error('Login error:', err);
        setErrorInfo({
          title: 'Database Connection Error',
          message: 'Unable to connect to Supabase database. Please check your internet connection.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Tactical Radar Overlay for Cadet Login */}
      {isNavigating && (
        <MilitaryLoader
          mode="cadet"
          variant="fullscreen"
          staticPhrase={navPhrase}
        />
      )}
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
            onClick={() => navigateWithLoader('Returning to Home...', onBackToHome, 500)}
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
              Enter your Cadet ID Number and Last Name to access your profile, unit, and attendance history.
            </p>
          </div>

          {/* High-Contrast Vivid Red Alert Banner */}
          {errorInfo && (
            <div
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                border: '1.5px solid #f87171',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                color: '#ffffff',
                boxShadow: '0 8px 24px -4px rgba(220, 38, 38, 0.55), 0 0 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                <AlertCircle size={18} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.3px', color: '#ffffff', marginBottom: '2px' }}>
                  {errorInfo.title}
                </div>
                <div style={{ fontSize: '0.80rem', color: '#fee2e2', lineHeight: 1.4 }}>
                  {errorInfo.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorInfo(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; }}
                title="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit}>
            {/* 1. Cadet ID Number Input */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label
                htmlFor="cadet-id-input"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  color: hasError ? '#fca5a5' : '#cbd5e1',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem'
                }}
              >
                ID Number
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: hasError ? '#f87171' : '#94a3b8',
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
                  inputMode="numeric"
                  value={cadetIdInput}
                  onChange={handleInputChange}
                  placeholder="221-01231"
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                  maxLength={9} // 8 digits + 1 hyphen
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem 0.8rem 2.75rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: hasError ? '1.5px solid rgba(239, 68, 68, 0.85)' : '1.5px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '10px',
                    color: '#fbbf24',
                    fontFamily: 'monospace, Courier, monospace',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    boxShadow: hasError ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={(e) => {
                    if (hasError) {
                      e.target.style.borderColor = '#ef4444';
                      e.target.style.boxShadow = '0 0 0 3.5px rgba(239, 68, 68, 0.4)';
                    } else {
                      e.target.style.borderColor = '#fbbf24';
                      e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.2)';
                    }
                  }}
                  onBlur={(e) => {
                    if (hasError) {
                      e.target.style.borderColor = 'rgba(239, 68, 68, 0.85)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
                    } else {
                      e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                />
              </div>
            </div>

            {/* 2. Cadet Last Name Input with .toUpperCase() auto-formatting */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="cadet-lastname-input"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  color: hasError ? '#fca5a5' : '#cbd5e1',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem'
                }}
              >
                Last Name
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: hasError ? '#f87171' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <Shield size={18} />
                </div>
                <input
                  id="cadet-lastname-input"
                  type="text"
                  value={lastNameInput}
                  onChange={handleLastNameChange}
                  placeholder="e.g. DELA CRUZ"
                  autoComplete="family-name"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem 0.8rem 2.75rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: hasError ? '1.5px solid rgba(239, 68, 68, 0.85)' : '1.5px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box',
                    outline: 'none',
                    boxShadow: hasError ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={(e) => {
                    if (hasError) {
                      e.target.style.borderColor = '#ef4444';
                      e.target.style.boxShadow = '0 0 0 3.5px rgba(239, 68, 68, 0.4)';
                    } else {
                      e.target.style.borderColor = '#fbbf24';
                      e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.2)';
                    }
                  }}
                  onBlur={(e) => {
                    if (hasError) {
                      e.target.style.borderColor = 'rgba(239, 68, 68, 0.85)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
                    } else {
                      e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                      e.target.style.boxShadow = 'none';
                    }
                  }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: hasError ? '#fca5a5' : '#94a3b8', marginTop: '0.35rem', marginLeft: '2px' }}>
                Enter your surname as officially registered in CSU ROTC roster
              </div>
            </div>

            {/* Solid Gold/Amber Primary Action Button */}
            <button
              type="submit"
              disabled={loading || !cadetIdInput.trim() || !lastNameInput.trim()}
              style={{
                width: '100%',
                background: loading || !cadetIdInput.trim() || !lastNameInput.trim()
                  ? 'rgba(229, 169, 0, 0.3)'
                  : '#e5a900',
                color: loading || !cadetIdInput.trim() || !lastNameInput.trim() ? '#94a3b8' : '#0b0f19',
                border: 'none',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.98rem',
                letterSpacing: '0.3px',
                cursor: loading || !cadetIdInput.trim() || !lastNameInput.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: loading || !cadetIdInput.trim() || !lastNameInput.trim()
                  ? 'none'
                  : '0 2px 8px rgba(0, 0, 0, 0.25)',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading && cadetIdInput.trim() && lastNameInput.trim()) {
                  e.currentTarget.style.background = '#d97706';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && cadetIdInput.trim() && lastNameInput.trim()) {
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
    </>
  );
}
