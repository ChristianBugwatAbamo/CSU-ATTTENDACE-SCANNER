import React, { useState } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { getSupabaseClient } from '../utils/supabaseClient';

export default function LoginPage({ onLoginSuccess, onBackToPublic }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cleanUser = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both your Username/Email and Password.');
      return;
    }

    setIsLoading(true);

    try {
      let authenticated = false;
      let userData = null;

      // 1. Try Supabase Auth if email format
      const supabase = getSupabaseClient();
      if (supabase && cleanUser.includes('@')) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanUser,
            password: cleanPass
          });

          if (!error && data?.user) {
            authenticated = true;
            userData = {
              email: data.user.email,
              id: data.user.id,
              name: data.user.user_metadata?.full_name || 'ROTC Command Officer',
              role: 'SUPER_ADMIN',
              authProvider: 'SUPABASE'
            };
          }
        } catch (_) {}
      }

      // 2. Standard ROTC HQ Master Credentials Fallback
      if (!authenticated) {
        const isMasterAdmin =
          (cleanUser.toLowerCase() === 'admin' || cleanUser.toLowerCase() === 'commandant@csu.edu.ph' || cleanUser.toLowerCase() === 'commandant') &&
          (cleanPass === 'rotc2026' || cleanPass === 'rotcadmin' || cleanPass === 'admin123' || cleanPass === '123456');

        if (isMasterAdmin) {
          authenticated = true;
          userData = {
            username: cleanUser,
            name: 'LTC RYAN L MARCELO INF (GSC) PA',
            title: 'Commandant, CSU ROTC Unit',
            role: 'COMMANDANT_HQ',
            authProvider: 'LOCAL_SECURE'
          };
        }
      }

      if (authenticated && userData) {
        const sessionPayload = {
          user: userData,
          loggedInAt: new Date().toISOString(),
          expiresAt: rememberMe ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        localStorage.setItem('csu_rotc_auth_session', JSON.stringify(sessionPayload));
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        }
      } else {
        setErrorMsg('Invalid Username/Email or Password. Please verify your credentials.');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setErrorMsg('Authentication service unavailable. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setIdentifier('admin');
    setPassword('rotc2026');
    setErrorMsg(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #064e2e 0%, #032b19 60%, #01140b 100%)',
        padding: '1.5rem',
        boxSizing: 'border-box',
        position: 'fixed',
        inset: 0,
        zIndex: 99999
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
            onClick={onBackToPublic}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#064e2e',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0 0 1rem 0'
            }}
          >
            <ArrowLeft size={14} /> Back to Public Home
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
            1501st CDC • Command Center & Attendance HQ
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

        {/* Error Alert Message */}
        {errorMsg && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.82rem',
              color: '#991b1b',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1.25rem'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
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
              Username or Official Email
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
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. admin or commandant@csu.edu.ph"
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

          {/* Submit Sign-In Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '0.4rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              background: isLoading ? '#4b7a62' : '#005a2b',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.92rem',
              letterSpacing: '0.5px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0, 90, 43, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <LogIn size={18} />
            <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Command Center'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
