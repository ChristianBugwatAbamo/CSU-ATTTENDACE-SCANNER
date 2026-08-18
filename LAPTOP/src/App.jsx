import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import IDGenerator from './components/IDGenerator';
import ScannerPage from './components/ScannerPage';
import SyncLogs from './components/SyncLogs';
import BatchScannerModal from './components/BatchScannerModal';
import { Camera, QrCode } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cadets, setCadets] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [serverOnline, setServerOnline] = useState(true);
  const [isBatchScannerOpen, setIsBatchScannerOpen] = useState(false);

  // Fetch Cadets & Attendance Logs
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
          }
        } catch (_) {}
      }

      if (logsRes.status === 'fulfilled' && logsRes.value && logsRes.value.ok) {
        try {
          const logsData = await logsRes.value.json();
          if (Array.isArray(logsData)) {
            setAttendanceLogs(logsData);
          }
        } catch (_) {}
      }

      setServerOnline(healthRes.status === 'fulfilled' && healthRes.value && healthRes.value.ok);
    } catch (err) {
      console.warn("Backend offline, running in offline React mode:", err);
      setServerOnline(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s for live sync updates
    return () => clearInterval(interval);
  }, []);

  const handleClearAttendance = async () => {
    try {
      await fetch('/api/attendance', { method: 'DELETE' });
      setAttendanceLogs([]);
      fetchData();
    } catch (err) {
      console.error('Failed to clear attendance logs:', err);
      setAttendanceLogs([]);
    }
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
          // Merge parsed records directly into local React state
          setAttendanceLogs(prev => [...enrichedRecords, ...prev]);
        }}
      />
    </div>
  );
}
