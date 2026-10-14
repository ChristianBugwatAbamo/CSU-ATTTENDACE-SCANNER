import React, { useState, useRef, useCallback } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound,
  Building,
  ArrowLeft,
  Loader2,
  UserPlus,
  Clock,
  Mail,
  Award
} from 'lucide-react';
import {
  signInAdmin,
  requestAdminAccess,
  writeCachedAdminSession,
  PENDING_APPROVAL_MESSAGE
} from '../utils/adminAuth';
import MilitaryLoader from './MilitaryLoader';

export default function LoginPage({ onLoginSuccess, onBackToPublic }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  // notice: { variant: 'error' | 'pending' | 'success', text } | null
  const [notice, setNotice] = useState(null);
  const setErrorMsg = (text) => setNotice(text ? { variant: 'error', text } : null);

  // 'login' | 'register'
  const [mode, setMode] = useState('login');
  const [regName, setRegName] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [registered, setRegistered] = useState(null);
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

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = identifier.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your official email and password.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid official email address.');
      return;
    }

    setIsLoading(true);

    try {
      // Supabase Auth + admin_whitelist guard. Throws AdminAuthError on rejection.
      const userData = await signInAdmin(cleanEmail, password);

      writeCachedAdminSession(userData, rememberMe);
      setTimeout(() => {
        setIsLoading(false);
        navigateWithLoader('Initializing Command Center...', () => {
          if (onLoginSuccess) onLoginSuccess(userData);
        }, 800);
      }, 300);
      return;
    } catch (err) {
      if (err?.code === 'PENDING_APPROVAL') {
        setNotice({ variant: 'pending', text: PENDING_APPROVAL_MESSAGE });
      } else if (err?.name === 'AdminAuthError') {
        setErrorMsg(err.message);
      } else {
        console.error('Authentication error:', err);
        setErrorMsg('Authentication service unavailable. Please check your connection.');
      }
      setPassword('');
    }
    setIsLoading(false);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setNotice(null);
    setRegistered(null);
    setShowPassword(false);
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setNotice(null);

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanName.length < 3) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid official email address.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (regPassword !== regConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { needsEmailConfirmation } = await requestAdminAccess({
        email: cleanEmail,
        password: regPassword,
        fullName: cleanName,
        title: regTitle
      });
      setRegistered({ email: cleanEmail, needsEmailConfirmation });
      setRegPassword('');
      setRegConfirm('');
    } catch (err) {
      if (err?.name === 'AdminAuthError') {
        setErrorMsg(err.message);
      } else {
        console.error('Access request error:', err);
        setErrorMsg('Authentication service unavailable. Please check your connection.');
      }
    }
    setIsLoading(false);
  };

  return (
    <>
      {isNavigating && (
        <MilitaryLoader
          mode="admin"
          variant="fullscreen"
          staticPhrase={navPhrase}
        />
      )}
      <style>{`
        @keyframes ml-btn-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes auth-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 20%, #064e2e 0%, #032b19 60%, #01140b 100%)',
          padding: '1.5rem',
          boxSizing: 'border-box',
          position: 'fixed',
          inset: 0,
          zIndex: 10
        }}
      >
        {/* Background Subtle Camo Grid Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(229, 169, 0, 0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            pointerEvents: 'none'
          }}
        />

        {/* Main Glassmorphic Login Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '2px solid rgba(229, 169, 0, 0.4)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 78, 46, 0.2)',
            padding: '1.75rem 2rem',
            position: 'relative',
            zIndex: 1
          }}
        >
          {/* Back to Home Link */}
          {onBackToPublic && (
            <button
              type="button"
              disabled={isNavigating || isLoading}
              onClick={() => navigateWithLoader('Returning to Public Home...', onBackToPublic, 700)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#064e2e',
                cursor: (isNavigating || isLoading) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 0 1rem 0',
                transition: 'opacity 0.2s ease',
                opacity: isNavigating ? 0.7 : 1
              }}
            >
              {isNavigating ? (
                <>
                  <Loader2 size={14} style={{ animation: 'ml-btn-spin 0.8s linear infinite' }} />
                  <span>Returning to Public Home...</span>
                </>
              ) : (
                <>
                  <ArrowLeft size={14} />
                  <span>Back to Public Home</span>
                </>
              )}
            </button>
          )}

          {/* Unit Branding Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.35rem' }}>
            <div
              style={{
                width: '96px',
                height: '96px',
                margin: '0 auto 0.85rem auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #064e2e 0%, #043820 100%)',
                border: '3.5px solid #e5a900',
                boxShadow: '0 6px 20px rgba(6, 78, 46, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px'
              }}
            >
              <img
                src="/rotc-seal-transparent.png"
                alt="ROTC Seal"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = '<div style="color:#e5a900;font-size:24px;font-weight:900;">CSU</div>';
                }}
              />
            </div>

            <h2
              style={{
                margin: 0,
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.45rem',
                color: 'var(--rotc-green-dark, #064e2e)',
                letterSpacing: '0.75px',
                textTransform: 'uppercase'
              }}
            >
              CSU MAIN ROTCU
            </h2>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: '0.82rem',
                color: '#4b5563',
                fontWeight: 600
              }}
            >
              Command Center & Attendance Admin
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '8px',
                background: 'rgba(6, 78, 46, 0.08)',
                color: '#064e2e',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(6, 78, 46, 0.15)'
              }}
            >
              <Shield size={12} color="#064e2e" />
              <span>Authorized Personnel Access Only</span>
            </div>
          </div>

          {/* Sign In / Request Access Tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            style={{
              display: 'flex',
              background: 'rgba(6, 78, 46, 0.06)',
              border: '1px solid rgba(6, 78, 46, 0.12)',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '1.1rem'
            }}
          >
            {[
              { key: 'login', label: 'Sign In', Icon: LogIn },
              { key: 'register', label: 'Request Access', Icon: UserPlus }
            ].map(({ key, label, Icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  id={`auth-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={isLoading || isNavigating}
                  onClick={() => !active && switchMode(key)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: (isLoading || isNavigating) ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    letterSpacing: '0.3px',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#064e2e' : '#6b7280',
                    boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Status Alert (error / pending approval / success) */}
          {notice && <StatusAlert variant={notice.variant} text={notice.text} />}

          {/* Request Access: Success Panel */}
          {mode === 'register' && registered && (
            <div style={{ textAlign: 'center', animation: 'auth-fade-in 0.25s ease' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  margin: '0 auto 0.75rem auto',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  border: '2px solid #6ee7b7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckCircle2 size={28} color="#059669" />
              </div>
              <h3
                style={{
                  margin: '0 0 6px 0',
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '1.1rem',
                  color: '#064e2e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Request Submitted
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.55 }}>
                {registered.needsEmailConfirmation ? (
                  <>We sent a confirmation link to <strong>{registered.email}</strong>. Please verify your email, then wait for an administrator to approve your account.</>
                ) : (
                  <>Your access request for <strong>{registered.email}</strong> has been filed with Command HQ.</>
                )}
              </p>
              <StatusAlert variant="pending" text={PENDING_APPROVAL_MESSAGE} />
              <button
                id="auth-back-to-signin"
                type="button"
                onClick={() => {
                  setIdentifier(registered.email);
                  switchMode('login');
                }}
                style={PRIMARY_BUTTON_STYLE(false)}
              >
                <LogIn size={18} />
                <span>Back to Sign In</span>
              </button>
            </div>
          )}

          {/* Request Access: Registration Form */}
          {mode === 'register' && !registered && (
            <form
              id="auth-register-form"
              onSubmit={handleRegister}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', animation: 'auth-fade-in 0.25s ease' }}
            >
              <FormField id="reg-full-name" label="Full Name" icon={User}>
                <input
                  id="reg-full-name"
                  type="text"
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Juan D. Dela Cruz"
                  maxLength={150}
                  required
                  autoFocus
                  style={INPUT_STYLE}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </FormField>

              <FormField id="reg-title" label="Rank / Position" icon={Award} optional>
                <input
                  id="reg-title"
                  type="text"
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  placeholder="e.g. Tactical Officer"
                  maxLength={150}
                  style={INPUT_STYLE}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </FormField>

              <FormField id="reg-email" label="Official Email" icon={Mail}>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. officer@csu.edu.ph"
                  required
                  style={INPUT_STYLE}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </FormField>

              <FormField id="reg-password" label="Password" icon={Lock}>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  style={{ ...INPUT_STYLE, paddingRight: '2.4rem' }}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={EYE_BUTTON_STYLE}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </FormField>

              <FormField id="reg-confirm" label="Confirm Password" icon={KeyRound}>
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  style={{
                    ...INPUT_STYLE,
                    borderColor: regConfirm && regConfirm !== regPassword ? '#f87171' : INPUT_STYLE.borderColor
                  }}
                  onFocus={focusOn}
                  onBlur={(e) => {
                    e.target.style.borderColor = regConfirm && regConfirm !== regPassword ? '#f87171' : '#d1d5db';
                  }}
                />
              </FormField>

              <p style={{ margin: 0, fontSize: '0.74rem', color: '#6b7280', lineHeight: 1.45, display: 'flex', gap: '6px' }}>
                <Clock size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>New accounts stay inactive until a Command Center administrator approves them.</span>
              </p>

              <button
                id="auth-register-submit"
                type="submit"
                disabled={isLoading || isNavigating}
                style={PRIMARY_BUTTON_STYLE(isLoading || isNavigating)}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'ml-btn-spin 0.8s linear infinite', flexShrink: 0 }} />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>Submit Access Request</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Login Form */}
          {mode === 'login' && (
          <form id="auth-login-form" onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', animation: 'auth-fade-in 0.25s ease' }}>
            {/* Username / Email Field */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#1f2937',
                  marginBottom: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Official Email
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6b7280',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="email"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. commandant@csu.edu.ph"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.4rem',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #d1d5db',
                    background: '#ffffff',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#064e2e')}
                  onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#1f2937',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '5px'
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6b7280',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 2.4rem 0.65rem 2.4rem',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #d1d5db',
                    background: '#ffffff',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#064e2e')}
                  onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#064e2e', cursor: 'pointer' }}
                />
                <span>Remember this terminal</span>
              </label>
            </div>

            {/* Submit Sign-In Button with Inline Spinner */}
            <button
              type="submit"
              disabled={isLoading || isNavigating}
              style={{
                marginTop: '0.4rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                background: (isLoading || isNavigating) ? '#2d6a4f' : '#005a2b',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.92rem',
                letterSpacing: '0.5px',
                cursor: (isLoading || isNavigating) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0, 90, 43, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'ml-btn-spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In to Command Center</span>
                </>
              )}
            </button>
          </form>
          )}

          {/* Footer toggle link */}
          {!registered && (
            <p style={{ margin: '1rem 0 0 0', textAlign: 'center', fontSize: '0.8rem', color: '#4b5563' }}>
              {mode === 'login' ? 'Need Command Center access? ' : 'Already approved? '}
              <button
                id="auth-toggle-mode-link"
                type="button"
                disabled={isLoading || isNavigating}
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#064e2e',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px'
                }}
              >
                {mode === 'login' ? 'Create Account / Request Access' : 'Sign In'}
              </button>
            </p>
          )}

        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational helpers
// ---------------------------------------------------------------------------

const LABEL_STYLE = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 800,
  color: '#1f2937',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const ICON_STYLE = {
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#6b7280',
  pointerEvents: 'none'
};

const INPUT_STYLE = {
  width: '100%',
  padding: '0.65rem 1rem 0.65rem 2.4rem',
  fontSize: '0.9rem',
  borderRadius: '8px',
  borderWidth: '1.5px',
  borderStyle: 'solid',
  borderColor: '#d1d5db',
  background: '#ffffff',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'all 0.15s ease'
};

const EYE_BUTTON_STYLE = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  color: '#6b7280',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center'
};

const PRIMARY_BUTTON_STYLE = (busy) => ({
  width: '100%',
  marginTop: '0.4rem',
  padding: '0.75rem 1.25rem',
  borderRadius: '8px',
  background: busy ? '#2d6a4f' : '#005a2b',
  color: '#ffffff',
  border: 'none',
  fontWeight: 800,
  fontSize: '0.92rem',
  letterSpacing: '0.5px',
  cursor: busy ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: '0 4px 14px rgba(0, 90, 43, 0.4)',
  transition: 'all 0.15s ease'
});

const focusOn = (e) => (e.target.style.borderColor = '#064e2e');
const focusOff = (e) => (e.target.style.borderColor = '#d1d5db');

function FormField({ id, label, icon: Icon, optional, children }) {
  return (
    <div>
      <label htmlFor={id} style={LABEL_STYLE}>
        {label}
        {optional && (
          <span style={{ fontWeight: 600, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}> (optional)</span>
        )}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon size={16} style={ICON_STYLE} />
        {children}
      </div>
    </div>
  );
}

const ALERT_VARIANTS = {
  error: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', Icon: AlertCircle },
  pending: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', Icon: Clock },
  success: { bg: '#ecfdf5', border: '#6ee7b7', color: '#065f46', Icon: CheckCircle2 }
};

function StatusAlert({ variant = 'error', text }) {
  const v = ALERT_VARIANTS[variant] || ALERT_VARIANTS.error;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: '8px',
        padding: '0.75rem',
        fontSize: '0.82rem',
        color: v.color,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '1.1rem',
        textAlign: 'left',
        animation: 'auth-fade-in 0.2s ease'
      }}
    >
      <v.Icon size={16} style={{ flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
}
