import React, { useState, useEffect } from 'react';
import HeaderBar from './components/HeaderBar';
import SessionSetup from './components/SessionSetup';
import QRScanner from './components/QRScanner';
import MobileAnalytics from './components/MobileAnalytics';
import SyncControl from './components/SyncControl';
import ConfirmModal from './components/ConfirmModal';
import { getOfflineQueue, saveOfflineScan, clearOfflineQueue, getAdminIp, setAdminIp } from './services/storage';

export default function App() {
  const [adminIpState, setAdminIpState] = useState(getAdminIp());
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [serverConnected, setServerConnected] = useState(false);

  // Custom Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Session Active state (pre-scanning prompt flow)
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Session Setup parameters
  const [sessionSetup, setSessionSetup] = useState({
    dutyOfficer: 'C/CPT Santos',
    sessionDate: new Date().toISOString().split('T')[0],
    sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    battalion: '1st Battalion',
    company: 'Alpha Company',
    platoon: '1st Platoon',
    scanMode: 'Time-In' // 'Time-In' | 'Time-Out'
  });

  // Load Offline Queue on mount
  useEffect(() => {
    async function loadQueue() {
      const q = await getOfflineQueue();
      setOfflineQueue(q);
    }
    loadQueue();
  }, []);

  const handleUpdateAdminIp = (newIp) => {
    const saved = setAdminIp(newIp);
    setAdminIpState(saved);
  };

  // Health check to check connection with laptop
  useEffect(() => {
    const checkConn = async () => {
      try {
        const endpoint = `${adminIpState.replace(/\/$/, '')}/api/health`;
        const res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(3000) });
        setServerConnected(res.ok);
      } catch (err) {
        setServerConnected(false);
      }
    };
    checkConn();
    const timer = setInterval(checkConn, 8000);
    return () => clearInterval(timer);
  }, [adminIpState]);

  // Start Session Handler from SessionSetup component
  const handleStartSession = (setupData) => {
    setSessionSetup(setupData);
    setIsSessionActive(true);
  };

  // Toggle Mode Handler (Time-In <-> Time-Out)
  const handleToggleScanMode = (newMode) => {
    setSessionSetup(prev => ({ ...prev, scanMode: newMode }));
  };

  // Reset Session Setup
  const handleEditSetup = () => {
    setIsSessionActive(false);
  };

  // Handle New QR Scan Success
  const handleScanSuccess = async (scanRecord) => {
    const enrichedRecord = {
      ...scanRecord,
      sessionName: `${sessionSetup.battalion} - ${sessionSetup.company} (${sessionSetup.platoon})`,
      sessionDate: sessionSetup.sessionDate,
      sessionTime: sessionSetup.sessionTime,
      dutyOfficer: sessionSetup.dutyOfficer,
      battalion: sessionSetup.battalion,
      company: sessionSetup.company,
      platoon: sessionSetup.platoon,
      scanMode: sessionSetup.scanMode
    };

    const updatedQueue = await saveOfflineScan(enrichedRecord);
    setOfflineQueue(updatedQueue);
  };

  // Handle Sync Success
  const handleSyncSuccess = async () => {
    await clearOfflineQueue();
    setOfflineQueue([]);
  };

  // Trigger Custom Reset Modal
  const handleOpenResetModal = () => {
    if (offlineQueue.length === 0) return;
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    await clearOfflineQueue();
    setOfflineQueue([]);
    setIsResetModalOpen(false);
  };

  const handleCancelReset = () => {
    setIsResetModalOpen(false);
  };

  return (
    <div className="mobile-container">
      <HeaderBar
        adminIp={adminIpState}
        setAdminIp={handleUpdateAdminIp}
        sessionSetup={sessionSetup}
        isSessionActive={isSessionActive}
        onToggleScanMode={handleToggleScanMode}
        onEditSetup={handleEditSetup}
        serverConnected={serverConnected}
      />

      <main style={{ flexGrow: 1 }}>
        {!isSessionActive ? (
          /* Pre-Scanning Session Setup Screen */
          <SessionSetup
            initialSetup={sessionSetup}
            onStartSession={handleStartSession}
          />
        ) : (
          /* Active Field Scanner & Analytics */
          <>
            <QRScanner
              onScanSuccess={handleScanSuccess}
              activeSessionScans={offlineQueue}
              scanMode={sessionSetup.scanMode}
              sessionSetup={sessionSetup}
            />

            <MobileAnalytics
              scanLogs={offlineQueue}
              sessionSetup={sessionSetup}
              onResetQueue={handleOpenResetModal}
            />
          </>
        )}
      </main>

      {/* Admin Sync Action Bar */}
      <SyncControl
        offlineQueue={offlineQueue}
        adminIp={adminIpState}
        sessionSetup={sessionSetup}
        dutyOfficer={sessionSetup.dutyOfficer}
        sessionName={`${sessionSetup.battalion} - ${sessionSetup.company} (${sessionSetup.platoon})`}
        onSyncSuccess={handleSyncSuccess}
        onResetQueue={handleOpenResetModal}
      />

      {/* Custom UI Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="⚠️ Reset Scanning Session?"
        message={`Are you sure you want to clear all ${offlineQueue.length} scanned records from this device? This action cannot be undone.`}
        confirmLabel="Clear Queue"
        cancelLabel="Cancel"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
        isDestructive={true}
      />
    </div>
  );
}
