import React, { useState, useEffect, useRef } from 'react';
import HeaderBar from './components/HeaderBar';
import SessionSetup from './components/SessionSetup';
import QRScanner from './components/QRScanner';
import MobileAnalytics from './components/MobileAnalytics';
import AboutUs from './components/AboutUs';
import MobileSettings from './components/MobileSettings';
import MobileBottomNav from './components/MobileBottomNav';
import SyncControl from './components/SyncControl';
import ConfirmModal from './components/ConfirmModal';
import ScannerLandingView from './components/ScannerLandingView';
import { getOfflineQueue, saveOfflineScan, removeOfflineScan, clearOfflineQueue, getAdminIp, setAdminIp } from './services/storage';

const SESSION_SETUP_KEY = 'csu_rotc_mobile_session_setup';

const DEFAULT_SESSION_SETUP = {
  dutyOfficer: '',
  sessionDate: new Date().toISOString().split('T')[0],
  sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  battalion: '',
  company: '',
  platoon: '',
  scanMode: '' // Completely blank unselected on load
};

export default function App() {
  const [adminIpState, setAdminIpState] = useState(getAdminIp());
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [serverConnected, setServerConnected] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // Active Bottom Navigation Tab: 'scanner' | 'dashboard' | 'about' | 'settings'
  const [activeTab, setActiveTab] = useState('scanner');

  // Center FAB Batch Sync Modal State
  const [isBatchSyncOpen, setIsBatchSyncOpen] = useState(false);

  // Custom Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Session Setup parameters: loads saved configuration from localStorage or completely empty defaults
  const [sessionSetup, setSessionSetup] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_SETUP_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Purge mock dummy data if previously cached
        const isMock = parsed.dutyOfficer?.includes('SANTOS') || parsed.dutyOfficer?.includes('MARIA');
        if (isMock) {
          localStorage.removeItem(SESSION_SETUP_KEY);
          return DEFAULT_SESSION_SETUP;
        }
        return {
          ...DEFAULT_SESSION_SETUP,
          ...parsed,
          sessionDate: parsed.sessionDate || new Date().toISOString().split('T')[0],
          sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
    } catch (_) {}
    return DEFAULT_SESSION_SETUP;
  });

  // Automatically synchronize session setup to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_SETUP_KEY, JSON.stringify(sessionSetup));
    } catch (_) {}
  }, [sessionSetup]);

  // Track previous configuration key to trigger auto-flush on setup updates
  const prevConfigRef = useRef(null);

  // Auto-Reset Effect: Flush scanned queue and reset sync QR state on configuration changes
  useEffect(() => {
    const currentConfigKey = `${sessionSetup.battalion || ''}|${sessionSetup.company || ''}|${sessionSetup.platoon || ''}|${sessionSetup.scanMode || ''}|${sessionSetup.sessionDate || ''}|${sessionSetup.sessionTime || ''}`;

    if (prevConfigRef.current === null) {
      prevConfigRef.current = currentConfigKey;
      return;
    }

    if (prevConfigRef.current !== currentConfigKey) {
      prevConfigRef.current = currentConfigKey;
      clearOfflineQueue().then(() => {
        setOfflineQueue([]);
        setIsBatchSyncOpen(false);
      });
    }
  }, [
    sessionSetup.battalion,
    sessionSetup.company,
    sessionSetup.platoon,
    sessionSetup.scanMode,
    sessionSetup.sessionDate,
    sessionSetup.sessionTime
  ]);

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

  // Start / Update Session Handler
  const handleStartSession = (setupData) => {
    setSessionSetup(setupData);
    setActiveTab('scanner');
  };

  // Toggle Mode Handler (Time-In <-> Time-Out)
  const handleToggleScanMode = (newMode) => {
    setSessionSetup(prev => ({ ...prev, scanMode: newMode }));
  };

  // Reset / Edit Session Setup
  const handleEditSetup = () => {
    setActiveTab('settings');
  };

  // Handle New QR Scan Success
  const handleScanSuccess = async (scanRecord) => {
    const enrichedRecord = {
      ...scanRecord,
      sessionName: `${sessionSetup.battalion || '1st Battalion'} - ${sessionSetup.company || 'Alpha Company'} (${sessionSetup.platoon || '1st Platoon'})`,
      sessionDate: sessionSetup.sessionDate,
      sessionTime: sessionSetup.sessionTime,
      dutyOfficer: sessionSetup.dutyOfficer || 'Field Duty Officer',
      battalion: sessionSetup.battalion || '1st Battalion',
      company: sessionSetup.company || 'Alpha Company',
      platoon: sessionSetup.platoon || '1st Platoon',
      scanMode: sessionSetup.scanMode
    };

    const updatedQueue = await saveOfflineScan(enrichedRecord);
    setOfflineQueue(updatedQueue);
  };

  // Delete Specific Scan from Offline Queue
  const handleDeleteScan = async (scanToDelete) => {
    if (!scanToDelete) return;
    const updatedQueue = await removeOfflineScan(scanToDelete);
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

  if (showLanding) {
    return (
      <ScannerLandingView
        onStartScanning={() => {
          setShowLanding(false);
          setActiveTab('scanner');
        }}
        isOffline={!serverConnected}
      />
    );
  }

  return (
    <div className={`mobile-container ${activeTab === 'settings' || activeTab === 'about' ? 'settings-theme-bg' : ''}`}>
      <HeaderBar
        adminIp={adminIpState}
        setAdminIp={handleUpdateAdminIp}
        sessionSetup={sessionSetup}
        isSessionActive={true}
        onToggleScanMode={handleToggleScanMode}
        onEditSetup={handleEditSetup}
        onOpenLanding={() => setShowLanding(true)}
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

      <main
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: activeTab === 'scanner' ? 'center' : 'flex-start',
          alignItems: activeTab === 'scanner' ? 'center' : 'stretch',
          minHeight: 'calc(100vh - 120px)',
          paddingBottom: activeTab === 'settings' || activeTab === 'about' ? '0' : '80px'
        }}
      >
        {/* Active 4-Tab Mobile Navigation Views */}
        {activeTab === 'scanner' && (
          <QRScanner
            onScanSuccess={handleScanSuccess}
            activeSessionScans={offlineQueue}
            scanMode={sessionSetup.scanMode}
            sessionSetup={sessionSetup}
            facingMode={cameraFacingMode}
            isTorchOn={isTorchOn}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'dashboard' && (
          <MobileAnalytics
            scanLogs={offlineQueue}
            sessionSetup={sessionSetup}
            onResetQueue={handleOpenResetModal}
            onDeleteScan={handleDeleteScan}
          />
        )}

        {(activeTab === 'about' || activeTab === 'idcards') && (
          <AboutUs />
        )}

        {activeTab === 'settings' && (
          <SessionSetup
            initialSetup={sessionSetup}
            onStartSession={handleStartSession}
            isEditing={true}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar with Raised Center Batch Sync FAB */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onPresentBatchSync={() => setIsBatchSyncOpen(true)}
        queueCount={offlineQueue.length}
      />

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

export { App as MobileApp };
