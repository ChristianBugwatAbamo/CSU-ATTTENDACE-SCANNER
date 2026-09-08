import React, { useState, useEffect } from 'react';
import CadetLandingPage from './components/CadetLandingPage';
import CadetLogin from './components/CadetLogin';
import CadetPortal from './components/CadetPortal';
import MilitaryLoader from './components/MilitaryLoader';

export default function App() {
  // Startup loading splash — shows military loader for minimum 1.5 s on first mount
  const [isAppLoading, setIsAppLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsAppLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const [currentView, setCurrentView] = useState(() => {
    // Check if cadet is already logged in
    try {
      const saved = localStorage.getItem('csu_rotc_cadet_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cadet) return 'portal';
      }
    } catch (_) {}
    return 'landing';
  });

  const [cadetUser, setCadetUser] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_cadet_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cadet) return parsed.cadet;
      }
    } catch (_) {}
    return null;
  });

  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_cadet_theme');
      if (saved) return saved === 'dark';
    } catch (_) {}
    return true; // Default to military dark theme
  });

  const toggleTheme = () => {
    setIsDarkTheme((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('csu_rotc_cadet_theme', next ? 'dark' : 'light');
      } catch (_) {}
      return next;
    });
  };

  const handleCadetLoginSuccess = (cadetData) => {
    setCadetUser(cadetData);
    setCurrentView('portal');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('csu_rotc_cadet_session');
    } catch (_) {}
    setCadetUser(null);
    setCurrentView('landing');
  };

  // 0. Startup Military Loader splash
  if (isAppLoading) {
    return <MilitaryLoader mode="cadet" variant="fullscreen" label="Cadet Portal" />;
  }

  // 1. Cadet Dashboard View
  if (currentView === 'portal' && cadetUser) {
    return (
      <CadetPortal
        cadet={cadetUser}
        onLogout={handleLogout}
      />
    );
  }

  // 2. Cadet Login View
  if (currentView === 'login') {
    return (
      <CadetLogin
        onCadetLoginSuccess={handleCadetLoginSuccess}
        onBackToHome={() => setCurrentView('landing')}
      />
    );
  }

  // 3. Default: Dedicated Cadet Landing Page
  return (
    <CadetLandingPage
      onOpenLogin={() => setCurrentView('login')}
      onQuickCadetFound={handleCadetLoginSuccess}
      isDarkTheme={isDarkTheme}
      onToggleTheme={toggleTheme}
    />
  );
}
