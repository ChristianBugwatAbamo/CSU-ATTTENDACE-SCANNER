import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import IDGenerator from './components/IDGenerator';
import ScannerPage from './components/ScannerPage';
import SyncLogs from './components/SyncLogs';
import AdminSettings from './components/AdminSettings';
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

export default function App() {
  const VALID_TABS = ['dashboard', 'idcards', 'scanner', 'synclogs', 'settings'];

  // Hydrate activeTab from URL hash or localStorage
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

  // Sync activeTab to localStorage and URL hash
  useEffect(() => {
    try {
      localStorage.setItem('csu_rotc_active_tab', activeTab);
      if (window.location.hash.replace('#', '').trim() !== activeTab) {
        window.location.hash = activeTab;
      }
    } catch (_) {}
  }, [activeTab]);

  // Support browser back/forward buttons with hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  const [serverOnline, setServerOnline] = useState(true);

  // Fetch Cadets & Attendance Logs from server or fallback to persistent storage
  const fetchData = async () => {
    try {
      const [cadetsRes, logsRes, healthRes] = await Promise.allSettled([
        fetch('/api/cadets'),
        fetch('/api/attendance'),
        fetch('/api/health')
      ]);

      if (cadetsRes.status === 'fulfilled' && cadetsRes.value && cadetsRes.value.ok) {
        try {
          const cadetsData = await cadetsRes.value.json();
          if (Array.isArray(cadetsData)) {
            setCadets(cadetsData);
            localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(cadetsData));
          }
        } catch (_) {}
      }

      if (logsRes.status === 'fulfilled' && logsRes.value && logsRes.value.ok) {
        try {
          const logsData = await logsRes.value.json();
          if (Array.isArray(logsData)) {
            setAttendanceLogs(logsData);
            localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(logsData));
            window.dispatchEvent(new Event('local-attendance-update'));
          }
        } catch (_) {}
      } else {
        // Offline / server error fallback: hydrate from localStorage
        try {
          const savedLogs = localStorage.getItem('csu_rotc_master_attendance');
          if (savedLogs) {
            setAttendanceLogs(JSON.parse(savedLogs));
          }
        } catch (_) {}
      }

      setServerOnline(healthRes.status === 'fulfilled' && healthRes.value && healthRes.value.ok);
    } catch (err) {
      console.warn('Backend offline, running in offline React mode:', err);
      setServerOnline(false);
      try {
        const savedLogs = localStorage.getItem('csu_rotc_master_attendance');
        if (savedLogs) {
          setAttendanceLogs(JSON.parse(savedLogs));
        }
      } catch (_) {}
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

    window.addEventListener('storage', handleStorage);
    window.addEventListener('local-attendance-update', handleStorage);
    window.addEventListener('csu_settings_updated', handleSettingsUpdated);
    return () => {
      clearInterval(interval);
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

  // Ingest approved batch records into Master Attendance with single-row cadet deduplication and merging
  const handleSyncComplete = (enrichedRecords) => {
    const cutoffTime = getActiveFormationCutoff();

    setAttendanceLogs((prev) => {
      let updated = [...prev];

      enrichedRecords.forEach((rawRecord) => {
        const scanDateStr = rawRecord.timestamp ? new Date(rawRecord.timestamp).toDateString() : new Date().toDateString();
        const cid = String(rawRecord.cadetId || rawRecord.i || '').trim().toUpperCase();
        if (!cid) return;

        const isTimeOut = rawRecord.scanMode === 'Time-Out' ||
          rawRecord.m === 0 ||
          rawRecord.mode === 'TIME_OUT' ||
          (rawRecord.status && String(rawRecord.status).toUpperCase().includes('TIME-OUT'));

        // Look up cadet's existing record for the current date (single-row model)
        const existingIndex = updated.findIndex((l) => {
          const dStr = l.timestamp ? new Date(l.timestamp).toDateString() : (l.date ? new Date(l.date).toDateString() : '');
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
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverOnline={serverOnline}
      />

      <main className="main-wrapper">
        <header className="top-header no-print">
          <div className="page-title-group">
            <h2>CSU ROTC ATTENDANCE & ROSTER SYSTEM</h2>
            <p>Admin HQ Desktop Node</p>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>Command Center</div>
            <div style={{ color: 'var(--text-muted)' }}>
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

          {activeTab === 'synclogs' && (
            <SyncLogs
              attendanceLogs={attendanceLogs}
              onRefresh={fetchData}
              onClearLogs={handleClearAttendance}
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
