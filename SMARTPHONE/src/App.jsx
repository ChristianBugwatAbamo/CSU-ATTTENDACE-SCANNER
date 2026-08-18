import React, { useState, useEffect } from 'react';
import HeaderBar from './components/HeaderBar';
import SessionSetup from './components/SessionSetup';
import QRScanner from './components/QRScanner';
import MobileAnalytics from './components/MobileAnalytics';
import AboutUs from './components/AboutUs';
import MobileSettings from './components/MobileSettings';
import MobileBottomNav from './components/MobileBottomNav';
import SyncControl from './components/SyncControl';
import ConfirmModal from './components/ConfirmModal';
import { getOfflineQueue, saveOfflineScan, clearOfflineQueue, getAdminIp, setAdminIp } from './services/storage';

export default function App() {
  const [adminIpState, setAdminIpState] = useState(getAdminIp());
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [serverConnected, setServerConnected] = useState(false);

  // Active Bottom Navigation Tab: 'scanner' | 'dashboard' | 'about' | 'settings'
  const [activeTab, setActiveTab] = useState('scanner');

  // Center FAB Batch Sync Modal State
  const [isBatchSyncOpen, setIsBatchSyncOpen] = useState(false);

  // Custom Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Session Active state (pre-scanning prompt flow)
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Session Setup parameters
  const [sessionSetup, setSessionSetup] = useState({
    dutyOfficer: 'C/LT COL MARIA L SANTOS (ROTC) 1CL',
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
    setActiveTab('scanner');
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
    setIsBatchSyncOpen(false);
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

  // Camera Switcher & Torch State
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);

  const handleToggleTorch = () => {
    setIsTorchOn(prev => !prev);
  };

  const handleSwitchCamera = () => {
    setCameraFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  return (
    <div className={`mobile-container ${activeTab === 'settings' || activeTab === 'about' || !isSessionActive ? 'settings-theme-bg' : ''}`}>
      <HeaderBar
        adminIp={adminIpState}
        setAdminIp={handleUpdateAdminIp}
        sessionSetup={sessionSetup}
        isSessionActive={isSessionActive}
        onToggleScanMode={handleToggleScanMode}
        onEditSetup={handleEditSetup}
        serverConnected={serverConnected}
        queueCount={offlineQueue.length}
        onOpenBatchSync={() => setIsBatchSyncOpen(true)}
        isTorchOn={isTorchOn}
        onToggleTorch={handleToggleTorch}
        cameraFacingMode={cameraFacingMode}
        onSwitchCamera={handleSwitchCamera}
        isOfflineStorageActive={true}
        activeTab={activeTab}
      />

      <main style={{ flexGrow: 1, paddingBottom: activeTab === 'settings' || activeTab === 'scanner' || activeTab === 'about' ? '0' : '80px', display: 'flex', flexDirection: 'column' }}>
        {!isSessionActive ? (
          /* Pre-Scanning Session Setup Screen */
          <SessionSetup
            initialSetup={sessionSetup}
            onStartSession={handleStartSession}
          />
        ) : (
          /* Active 4-Tab Mobile Navigation Views */
          <>
            {activeTab === 'scanner' && (
              <QRScanner
                onScanSuccess={handleScanSuccess}
                activeSessionScans={offlineQueue}
                scanMode={sessionSetup.scanMode}
                sessionSetup={sessionSetup}
                facingMode={cameraFacingMode}
                isTorchOn={isTorchOn}
              />
            )}

            {activeTab === 'dashboard' && (
              <MobileAnalytics
                scanLogs={offlineQueue}
                sessionSetup={sessionSetup}
                onResetQueue={handleOpenResetModal}
              />
            )}

            {(activeTab === 'about' || activeTab === 'idcards') && (
              <AboutUs />
            )}

            {activeTab === 'settings' && (
              <SessionSetup
                initialSetup={sessionSetup}
                onStartSession={(updatedSetup) => {
                  setSessionSetup(updatedSetup);
                  setIsSessionActive(true);
                  setActiveTab('scanner');
                }}
                isEditing={true}
              />
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation Bar with Raised Center Batch Sync FAB */}
      {isSessionActive && (
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onPresentBatchSync={() => setIsBatchSyncOpen(true)}
          queueCount={offlineQueue.length}
        />
      )}

      {/* Duty Officer Batch Sync QR Presentation Modal */}
      <SyncControl
        isOpen={isBatchSyncOpen}
        onClose={() => setIsBatchSyncOpen(false)}
        offlineQueue={offlineQueue}
        adminIp={adminIpState}
        sessionSetup={sessionSetup}
        dutyOfficer={sessionSetup.dutyOfficer}
        sessionName={`${sessionSetup.battalion} - ${sessionSetup.company} (${sessionSetup.platoon})`}
        onSyncSuccess={handleSyncSuccess}
        onResetQueue={handleOpenResetModal}
        hideBottomBar={true}
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
