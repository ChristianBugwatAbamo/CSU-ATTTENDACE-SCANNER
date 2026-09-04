import React, { useState, useEffect } from 'react';
import CadetLandingPage from './components/CadetLandingPage';
import CadetLogin from './components/CadetLogin';
import CadetPortal from './components/CadetPortal';

export default function App() {
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
