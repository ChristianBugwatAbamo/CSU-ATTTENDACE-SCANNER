import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AttendanceHistory from './components/AttendanceHistory';
import IDGenerator from './components/IDGenerator';
import ScannerPage from './components/ScannerPage';
import AdminSettings from './components/AdminSettings';
import LoginPage from './components/LoginPage';
import PublicLandingPage from './components/PublicLandingPage';
import {
  evaluateSingleScan,
  reconcileCadetDailyStatus,
  getActiveFormationCutoff,
  recalculateAttendanceLogs,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon,
  getScannedUnitEchelon
} from './utils/attendanceStatus';
import {
  fetchCadetsFromSupabase,
  fetchAttendanceFromSupabase,
  bulkUpsertAttendanceToSupabase,
  ingestBatchToSupabase,
  subscribeToAttendanceRealtime,
  getSupabaseClient,
  inferCadetFromId
} from './utils/supabaseClient';
import { LogOut, ShieldCheck } from 'lucide-react';

export default function App() {
  const VALID_TABS = ['dashboard', 'history', 'idcards', 'scanner', 'settings'];

  // Authentication Session State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user) {
          // Verify expiration if set
          if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) {
            localStorage.removeItem('csu_rotc_auth_session');
            return null;
          }
          return parsed.user;
        }
      }
    } catch (_) {}
    return null;
  });

  // Top-Level Route Navigation: 'home' (Public Landing /) | 'login' (/login) | 'portal' (/dashboard/*)
  const [currentRoute, setCurrentRoute] = useState(() => {
    try {
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      if (hash === 'login') return 'login';
      if (VALID_TABS.includes(hash)) {
        const savedSession = localStorage.getItem('csu_rotc_auth_session');
        return savedSession ? 'portal' : 'login';
      }
      if (hash === 'home' || hash === '' || hash === '/') return 'home';
    } catch (_) {}
    return 'home';
  });

  // Hydrate activeTab inside the Admin Portal
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && VALID_TABS.includes(hash)) {
        return hash;
      }
      const saved = localStorage.getItem('csu_rotc_active_tab');
      if (saved && VALID_TABS.includes(saved)) {
        return saved;
      }
    } catch (_) {}
    return 'dashboard';
  });

  // Sync route and activeTab to window URL hash
  useEffect(() => {
    try {
      if (currentRoute === 'home') {
        if (window.location.hash !== '#home' && window.location.hash !== '') {
          window.location.hash = 'home';
        }
      } else if (currentRoute === 'login') {
        if (window.location.hash !== '#login') {
          window.location.hash = 'login';
        }
      } else if (currentRoute === 'portal') {
        localStorage.setItem('csu_rotc_active_tab', activeTab);
        if (window.location.hash.replace('#', '').trim() !== activeTab) {
          window.location.hash = activeTab;
        }
      }
    } catch (_) {}
  }, [currentRoute, activeTab]);

  // Support browser back/forward buttons with hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      if (hash === 'home' || hash === '' || hash === '/') {
        setCurrentRoute('home');
      } else if (hash === 'login') {
        setCurrentRoute('login');
      } else if (VALID_TABS.includes(hash)) {
        if (currentUser) {
          setCurrentRoute('portal');
          setActiveTab(hash);
        } else {
          setCurrentRoute('login');
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  // Hydrate Cadets & Master Attendance from localStorage on initial render
  const [cadets, setCadets] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_cadets_roster');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [attendanceLogs, setAttendanceLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_master_attendance');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch (_) {}
    localStorage.removeItem('csu_rotc_auth_session');
    setCurrentUser(null);
  };

  const [serverOnline, setServerOnline] = useState(true);

  // Fetch Cadets & Attendance Logs directly from Supabase Cloud
  const fetchData = async () => {
    try {
      const [sbCadets, sbLogs] = await Promise.allSettled([
        fetchCadetsFromSupabase(),
        fetchAttendanceFromSupabase()
      ]);

      if (sbCadets.status === 'fulfilled' && Array.isArray(sbCadets.value)) {
        setCadets(sbCadets.value);
        try {
          localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(sbCadets.value));
        } catch (_) {}
      }

      if (sbLogs.status === 'fulfilled' && Array.isArray(sbLogs.value)) {
        setAttendanceLogs(sbLogs.value);
        try {
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(sbLogs.value));
          window.dispatchEvent(new Event('local-attendance-update'));
        } catch (_) {}
      }

      setServerOnline(true);
    } catch (err) {
      console.warn('Supabase fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s for live sync updates

    const handleStorage = (e) => {
      if (!e || e.key === 'csu_rotc_master_attendance' || e.type === 'local-attendance-update') {
        try {
          const saved = localStorage.getItem('csu_rotc_master_attendance');
          if (saved) setAttendanceLogs(JSON.parse(saved));
        } catch (_) {}
      }
      if (!e || e.key === 'csu_rotc_cadets_roster' || e.type === 'local-attendance-update') {
        try {
          const savedCadets = localStorage.getItem('csu_rotc_cadets_roster');
          if (savedCadets) setCadets(JSON.parse(savedCadets));
        } catch (_) {}
      }
    };

    const handleSettingsUpdated = (e) => {
      const newSettings = e?.detail || JSON.parse(localStorage.getItem('csu_rotc_admin_settings') || '{}');
      const cutoff = newSettings?.morningCutoffTime || newSettings?.formationCutoffTime || newSettings?.musterAndUnit?.timeInCutoff || getActiveFormationCutoff();

      setAttendanceLogs((prev) => {
        const updated = recalculateAttendanceLogs(prev, cutoff);
        try {
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    };

    // Subscribe to live Supabase Realtime stream
    const realtimeChannel = subscribeToAttendanceRealtime((payload) => {
      fetchData();
      window.dispatchEvent(new Event('local-attendance-update'));
    });

    window.addEventListener('storage', handleStorage);
    window.addEventListener('local-attendance-update', handleStorage);
    window.addEventListener('csu_settings_updated', handleSettingsUpdated);
    return () => {
      clearInterval(interval);
      if (realtimeChannel) realtimeChannel.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('local-attendance-update', handleStorage);
      window.removeEventListener('csu_settings_updated', handleSettingsUpdated);
    };
  }, []);

  const handleClearAttendance = async (clearType = 'ALL', targetPayload = null) => {
    try {
      if (clearType === 'ALL') {
        await fetch('/api/attendance', { method: 'DELETE' });
        localStorage.removeItem('csu_rotc_master_attendance');
        localStorage.removeItem('csu_rotc_recent_approved_signatures');
        setAttendanceLogs([]);
      } else if (clearType === 'PLATOON' && targetPayload) {
        const { battalion, company, platoon } = targetPayload;
        const query = new URLSearchParams({ type: 'PLATOON', battalion: battalion || '', company: company || '', platoon: platoon || '' }).toString();
        await fetch(`/api/attendance?${query}`, { method: 'DELETE' });

        setAttendanceLogs((prev) => {
          const remaining = prev.filter((log) => {
            const ech = getScannedUnitEchelon(log);
            const matchBn = battalion && battalion !== 'ALL' ? normalizeBattalion(ech.battalion || log.battalion) === normalizeBattalion(battalion) : true;
            const matchCo = company && company !== 'ALL' ? normalizeCompany(ech.company || log.company) === normalizeCompany(company) : true;
            const matchPl = platoon && platoon !== 'ALL' ? normalizePlatoon(ech.platoon || log.platoon) === normalizePlatoon(platoon) : true;
            return !(matchBn && matchCo && matchPl);
          });
          try {
            localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(remaining));
          } catch (_) {}
          return remaining;
        });
      } else if (clearType === 'CADET' && targetPayload) {
        const targetCid = String(targetPayload.cadetId || targetPayload).trim().toUpperCase();
        const query = new URLSearchParams({ type: 'CADET', cadetId: targetCid }).toString();
        await fetch(`/api/attendance?${query}`, { method: 'DELETE' });

        setAttendanceLogs((prev) => {
          const remaining = prev.filter((log) => {
            const cId = String(log.cadetId || log.id || '').trim().toUpperCase();
            return cId !== targetCid;
          });
          try {
            localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(remaining));
          } catch (_) {}
          return remaining;
        });
      } else if (clearType === 'FILTERED' && Array.isArray(targetPayload)) {
        const targetCids = new Set(targetPayload.map(c => String(c).trim().toUpperCase()));
        setAttendanceLogs((prev) => {
          const remaining = prev.filter(log => {
            const cid = String(log.cadetId || log.id || '').trim().toUpperCase();
            return !targetCids.has(cid);
          });
          try {
            localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(remaining));
          } catch (_) {}
          return remaining;
        });
      }
    } catch (err) {
      console.warn('Backend server offline during clear, cleared locally:', err);
      if (clearType === 'ALL') {
        localStorage.removeItem('csu_rotc_master_attendance');
        localStorage.removeItem('csu_rotc_recent_approved_signatures');
        setAttendanceLogs([]);
      }
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('local-attendance-update'));
  };

function toDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

  // Ingest approved batch records into Master Attendance with single-row cadet deduplication and merging
  const handleSyncComplete = (enrichedRecords) => {
    const cutoffTime = getActiveFormationCutoff();

    setAttendanceLogs((prev) => {
      let updated = [...prev];

      enrichedRecords.forEach((rawRecord) => {
        const scanDateStr = toDateKey(rawRecord.date || rawRecord.timestamp) || toDateKey(new Date());
        const cid = String(rawRecord.cadetId || rawRecord.i || '').trim().toUpperCase();
        if (!cid) return;

        const isTimeOut = rawRecord.scanMode === 'Time-Out' ||
          rawRecord.m === 0 ||
          rawRecord.mode === 'TIME_OUT' ||
          (rawRecord.status && String(rawRecord.status).toUpperCase().includes('TIME-OUT'));

        // Look up cadet's existing record for the current date (single-row model)
        const existingIndex = updated.findIndex((l) => {
          const dStr = toDateKey(l.date || l.timestamp);
          const lCid = String(l.cadetId || l.i || '').trim().toUpperCase();
          return lCid === cid && dStr === scanDateStr;
        });

        if (existingIndex > -1) {
          // UPDATE & MERGE existing cadet row
          const existing = updated[existingIndex];

          const updatedTimeIn = isTimeOut
            ? (existing.timeIn || (existing.scanMode !== 'Time-Out' ? existing.timestamp : null))
            : rawRecord.timestamp;

          const updatedTimeOut = isTimeOut
            ? rawRecord.timestamp
            : (existing.timeOut || (existing.scanMode === 'Time-Out' ? existing.timestamp : null));

          const timeInScan = updatedTimeIn ? { ...existing, ...rawRecord, timestamp: updatedTimeIn, scanMode: 'Time-In' } : null;
          const timeOutScan = updatedTimeOut ? { ...existing, ...rawRecord, timestamp: updatedTimeOut, scanMode: 'Time-Out' } : null;

          const reconciled = reconcileCadetDailyStatus(
            { id: cid, name: rawRecord.name || existing.name },
            timeInScan,
            timeOutScan,
            cutoffTime
          );

          updated[existingIndex] = {
            ...existing,
            ...rawRecord,
            cadetId: cid,
            name: rawRecord.name || existing.name,
            rank: rawRecord.rank || existing.rank || 'Cadet',
            battalion: rawRecord.battalion || existing.battalion || '1st Battalion',
            company: rawRecord.company || existing.company || 'Alpha Company',
            platoon: rawRecord.platoon || existing.platoon || '1st Platoon',
            date: scanDateStr,
            timeIn: updatedTimeIn,
            timeOut: updatedTimeOut,
            timeInScan,
            timeOutScan,
            timeInStatus: reconciled.timeInStatus,
            timeOutStatus: reconciled.timeOutStatus,
            finalDailyStatus: reconciled.finalDailyStatus,
            status: reconciled.finalDailyStatus,
            dutyOfficer: rawRecord.dutyOfficer || existing.dutyOfficer,
            sessionName: rawRecord.sessionName || existing.sessionName,
            timestamp: updatedTimeIn || updatedTimeOut || rawRecord.timestamp,
            receivedAt: new Date().toISOString()
          };
        } else {
          // INSERT new cadet row
          const timeInTimestamp = !isTimeOut ? rawRecord.timestamp : null;
          const timeOutTimestamp = isTimeOut ? rawRecord.timestamp : null;

          const timeInScan = timeInTimestamp ? { ...rawRecord, scanMode: 'Time-In', timestamp: timeInTimestamp } : null;
          const timeOutScan = timeOutTimestamp ? { ...rawRecord, scanMode: 'Time-Out', timestamp: timeOutTimestamp } : null;

          const reconciled = reconcileCadetDailyStatus(
            { id: cid, name: rawRecord.name },
            timeInScan,
            timeOutScan,
            cutoffTime
          );

          const newRecord = {
            ...rawRecord,
            cadetId: cid,
            name: rawRecord.name || `Cadet ${cid}`,
            rank: rawRecord.rank || 'Cadet',
            battalion: rawRecord.battalion || '1st Battalion',
            company: rawRecord.company || 'Alpha Company',
            platoon: rawRecord.platoon || '1st Platoon',
            date: scanDateStr,
            timeIn: timeInTimestamp,
            timeOut: timeOutTimestamp,
            timeInScan,
            timeOutScan,
            timeInStatus: reconciled.timeInStatus,
            timeOutStatus: reconciled.timeOutStatus,
            finalDailyStatus: reconciled.finalDailyStatus,
            status: reconciled.finalDailyStatus,
            dutyOfficer: rawRecord.dutyOfficer || rawRecord.duty_officer || 'Duty Officer',
            sessionName: rawRecord.sessionName || rawRecord.session_name || 'Formation Session',
            timestamp: rawRecord.timestamp,
            receivedAt: new Date().toISOString()
          };

          updated.unshift(newRecord);
        }
      });

      try {
        localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('local-attendance-update'));
      } catch (_) {}

      return updated;
    });

    // Auto-Expansion: Register new cadets dynamically into master roster
    setCadets((prevCadets) => {
      const existingCids = new Set(prevCadets.map(c => String(c.id || c.cadetId || '').trim().toUpperCase()));
      let newlyAdded = [];
      enrichedRecords.forEach((rec) => {
        const cid = String(rec.cadetId || rec.i || '').trim().toUpperCase();
        if (cid && !existingCids.has(cid)) {
          existingCids.add(cid);
          const inferred = inferCadetFromId(cid, rec);
          newlyAdded.push(inferred);
        }
      });

      if (newlyAdded.length > 0) {
        const updatedCadets = [...prevCadets, ...newlyAdded];
        try {
          localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(updatedCadets));
          window.dispatchEvent(new Event('storage'));
        } catch (_) {}
        return updatedCadets;
      }
      return prevCadets;
    });

    // Push enriched records to Supabase Cloud with auto-provisioning of Cadets and Sessions
    if (Array.isArray(enrichedRecords) && enrichedRecords.length > 0) {
      bulkUpsertAttendanceToSupabase(enrichedRecords)
        .then(async () => {
          // Re-fetch to ensure all local views and cloud database are in sync
          await fetchData();
        })
        .catch((err) => {
          console.warn('Background Supabase cloud sync failed:', err);
        });
    }
  };

  // 1. Public Landing Page Route (/)
  if (currentRoute === 'home') {
    return (
      <PublicLandingPage
        onNavigateToLogin={() => setCurrentRoute('login')}
        onNavigateToDashboard={() => {
          if (currentUser) {
            setCurrentRoute('portal');
          } else {
            setCurrentRoute('login');
          }
        }}
        isAuthenticated={Boolean(currentUser)}
        currentUser={currentUser}
      />
    );
  }

  // 2. Admin Authentication Route (/login)
  if (currentRoute === 'login') {
    return (
      <LoginPage
        onLoginSuccess={(userData) => {
          setCurrentUser(userData);
          setCurrentRoute('portal');
          setActiveTab('dashboard');
        }}
        onBackToPublic={() => setCurrentRoute('home')}
      />
    );
  }

  // 3. Protected Admin Command Center Portal (/dashboard/*)
  // If session expired or unauthenticated, redirect to Login
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(userData) => {
          setCurrentUser(userData);
          setCurrentRoute('portal');
          setActiveTab('dashboard');
        }}
        onBackToPublic={() => setCurrentRoute('home')}
      />
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverOnline={serverOnline}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-wrapper">
        <header className="top-header no-print">
          <div className="page-title-group">
            <h2>CSU ROTC ATTENDANCE & ROSTER SYSTEM</h2>
            <p>Admin HQ Desktop Node • 1501st CDC</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Authorized Admin HQ Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(6, 78, 46, 0.08)',
                border: '1px solid rgba(6, 78, 46, 0.2)',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--rotc-green-dark, #064e2e)'
              }}
            >
              <ShieldCheck size={14} color="#059669" />
              <span>Authorized Admin HQ</span>
            </div>

            {/* Live Date */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'dashboard' && (
            <AnalyticsDashboard
              cadets={cadets}
              attendanceLogs={attendanceLogs}
              onRefresh={fetchData}
              onNavigateToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'history' && (
            <AttendanceHistory
              cadets={cadets}
              attendanceLogs={attendanceLogs}
              onRefresh={fetchData}
              onNavigateToSyncLogs={() => setActiveTab('synclogs')}
            />
          )}

          {activeTab === 'idcards' && (
            <IDGenerator
              cadets={cadets}
            />
          )}

          {activeTab === 'scanner' && (
            <ScannerPage
              cadets={cadets}
              attendanceLogs={attendanceLogs}
              onSyncComplete={handleSyncComplete}
            />
          )}

          {activeTab === 'settings' && (
            <AdminSettings
              cadets={cadets}
              attendanceLogs={attendanceLogs}
              onRefresh={fetchData}
              serverOnline={serverOnline}
            />
          )}
        </div>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setActiveTab('scanner')}
      />
    </div>
  );
}
