import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import IDGenerator from './components/IDGenerator';
import ScannerPage from './components/ScannerPage';
import SyncLogs from './components/SyncLogs';
import AdminSettings from './components/AdminSettings';
import BatchScannerModal from './components/BatchScannerModal';
import { Camera, QrCode } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

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
  const [isBatchScannerOpen, setIsBatchScannerOpen] = useState(false);

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
      console.warn("Backend offline, running in offline React mode:", err);
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

    window.addEventListener('storage', handleStorage);
    window.addEventListener('local-attendance-update', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('local-attendance-update', handleStorage);
    };
  }, []);

  const handleClearAttendance = async () => {
    try {
      await fetch('/api/attendance', { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to clear attendance logs on server:', err);
    }
    localStorage.removeItem('csu_rotc_master_attendance');
    setAttendanceLogs([]);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('local-attendance-update'));
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
            <p>Admin HQ Desktop Node • Port 8080</p>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>Command Center</div>
            <div style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
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
              onOpenScanner={() => setIsBatchScannerOpen(true)}
              attendanceLogs={attendanceLogs}
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
        onOpenScanner={() => setIsBatchScannerOpen(true)}
      />

      {/* Webcam Offline Batch QR Code Scanner Modal */}
      <BatchScannerModal
        isOpen={isBatchScannerOpen}
        onClose={() => setIsBatchScannerOpen(false)}
        cadets={cadets}
        onSyncComplete={(enrichedRecords) => {
          // Ingest batch with in-place Duty Officer & Timestamp updates
          setAttendanceLogs(prev => {
            let updated = [...prev];

            enrichedRecords.forEach(newRecord => {
              const scanDateStr = newRecord.timestamp ? new Date(newRecord.timestamp).toDateString() : new Date().toDateString();
              const cid = String(newRecord.cadetId || '').trim().toUpperCase();
              const mode = newRecord.scanMode || (String(newRecord.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');

              const existingIndex = updated.findIndex(l => {
                const dStr = l.timestamp ? new Date(l.timestamp).toDateString() : '';
                const lCid = String(l.cadetId || '').trim().toUpperCase();
                const lMode = l.scanMode || (String(l.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');
                return lCid === cid && dStr === scanDateStr && lMode === mode;
              });

              if (existingIndex !== -1) {
                // OVERWRITE: Update Duty Officer, Timestamp, and Session Details
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  dutyOfficer: newRecord.dutyOfficer,
                  timestamp: newRecord.timestamp,
                  sessionName: newRecord.sessionName || updated[existingIndex].sessionName,
                  status: newRecord.status || updated[existingIndex].status,
                  receivedAt: new Date().toISOString()
                };
              } else {
                // NEW RECORD: Prepend to list
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
        }}
      />
    </div>
  );
}
