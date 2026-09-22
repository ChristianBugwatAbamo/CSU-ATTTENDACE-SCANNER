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
import {
  getDailyQueues,
  saveOfflineScan,
  removeOfflineScan,
  clearDailyQueues,
  purgeLegacyScanQueues,
  getAdminIp,
  setAdminIp,
  getLocalPhilippineDate
} from './services/storage';
import { syncUnitStructureFromAdmin } from './utils/unitStructure';

const SESSION_SETUP_KEY = 'csu_rotc_mobile_session_setup';

const DEFAULT_SESSION_SETUP = {
  dutyOfficer: '',
  sessionDate: getLocalPhilippineDate(),
  sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  battalion: '',
  company: '',
  platoon: '',
  scanMode: 'Time-In' // Defaults to Time-In
};

export default function App() {
  const [adminIpState, setAdminIpState] = useState(getAdminIp());
  // Split queues state: { timeInQueue: [], timeOutQueue: [] }
  const [dailyQueues, setDailyQueues] = useState({ timeInQueue: [], timeOutQueue: [] });
  const [serverConnected, setServerConnected] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // Active Bottom Navigation Tab: 'scanner' | 'dashboard' | 'about' | 'settings'
  const [activeTab, setActiveTab] = useState('scanner');

  // Center FAB Batch Sync Modal State
  const [isBatchSyncOpen, setIsBatchSyncOpen] = useState(false);

  // Custom Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Session Setup parameters: loads saved configuration from localStorage or defaults
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
          sessionDate: parsed.sessionDate || getLocalPhilippineDate(),
          sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          scanMode: parsed.scanMode || 'Time-In'
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

  // Derived active mode and active queue
  const activeMode = sessionSetup.scanMode === 'Time-Out' ? 'Time-Out' : 'Time-In';
  const activeQueue = activeMode === 'Time-Out' ? (dailyQueues.timeOutQueue || []) : (dailyQueues.timeInQueue || []);

  // Track previous configuration key to safely close QR sync modal if echelon changes
  const prevConfigRef = useRef(null);

  // Safely close the batch sync modal on echelon change so QR can regenerate with new unit info, WITHOUT wiping scanned records
  useEffect(() => {
    const currentConfigKey = `${sessionSetup.battalion || ''}|${sessionSetup.company || ''}|${sessionSetup.platoon || ''}|${sessionSetup.sessionDate || ''}`;

    if (prevConfigRef.current === null) {
      prevConfigRef.current = currentConfigKey;
      return;
    }

    if (prevConfigRef.current !== currentConfigKey) {
      prevConfigRef.current = currentConfigKey;
      setIsBatchSyncOpen(false);
    }
  }, [
    sessionSetup.battalion,
    sessionSetup.company,
    sessionSetup.platoon,
    sessionSetup.sessionDate
  ]);

  // Load Today's Daily Queues on mount
  useEffect(() => {
    async function loadQueues() {
      const today = getLocalPhilippineDate();
      purgeLegacyScanQueues(today);
      const q = await getDailyQueues(today);
      setDailyQueues(q);
    }
    loadQueues();
  }, []);

  // Daily Auto-Reset: Check for calendar midnight rollover
  const todayDateRef = useRef(getLocalPhilippineDate());

  useEffect(() => {
    const checkDateRollover = async () => {
      const currentToday = getLocalPhilippineDate();
      if (currentToday !== todayDateRef.current) {
        console.log(`[Auto-Reset] Calendar date changed: ${todayDateRef.current} -> ${currentToday}. Resetting daily scan queues.`);
        todayDateRef.current = currentToday;
        purgeLegacyScanQueues(currentToday);
        const freshQueues = await getDailyQueues(currentToday);
        setDailyQueues(freshQueues);
        setSessionSetup(prev => ({
          ...prev,
          sessionDate: currentToday
        }));
      }
    };

    // Check periodically every 10 seconds
    const interval = setInterval(checkDateRollover, 10000);

    // Also check on visibilitychange (when phone unlocks or browser tab regains focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDateRollover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkDateRollover);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkDateRollover);
    };
  }, []);

  const handleUpdateAdminIp = (newIp) => {
    const saved = setAdminIp(newIp);
    setAdminIpState(saved);
  };

  // Health check to check connection with laptop & auto-sync unit structure
  useEffect(() => {
    let syncedOnce = false;
    const checkConn = async () => {
      try {
        const endpoint = `${adminIpState.replace(/\/$/, '')}/api/health`;
        const res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(3000) });
        const isOk = res.ok;
        setServerConnected(isOk);

        // Automatically sync unit structure from Laptop Admin HQ when connected
        if (isOk && !syncedOnce) {
          try {
            await syncUnitStructureFromAdmin(adminIpState);
            syncedOnce = true;
          } catch (_) {}
        }
      } catch (err) {
        setServerConnected(false);
        syncedOnce = false;
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
    const targetMode = newMode || (activeMode === 'Time-Out' ? 'Time-In' : 'Time-Out');
    setSessionSetup(prev => ({ ...prev, scanMode: targetMode }));
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
      sessionDate: sessionSetup.sessionDate || getLocalPhilippineDate(),
      sessionTime: sessionSetup.sessionTime,
      dutyOfficer: sessionSetup.dutyOfficer || 'Field Duty Officer',
      battalion: sessionSetup.battalion || '1st Battalion',
      company: sessionSetup.company || 'Alpha Company',
      platoon: sessionSetup.platoon || '1st Platoon',
      scanMode: activeMode
    };

    const updatedQueues = await saveOfflineScan(enrichedRecord);
    setDailyQueues(updatedQueues);
  };

  // Delete Specific Scan from Offline Queue
  const handleDeleteScan = async (scanToDelete) => {
    if (!scanToDelete) return;
    const updatedQueues = await removeOfflineScan(scanToDelete);
    setDailyQueues(updatedQueues);
  };

  // Handle Sync Success (clears scanned records in active mode queue)
  const handleSyncSuccess = async () => {
    const updatedQueues = await clearDailyQueues(activeMode);
    setDailyQueues(updatedQueues);
    setIsBatchSyncOpen(false);
  };

  // Trigger Custom Reset Modal
  const handleOpenResetModal = () => {
    if (activeQueue.length === 0) return;
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    const updatedQueues = await clearDailyQueues(activeMode);
    setDailyQueues(updatedQueues);
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
        sessionSetup={{ ...sessionSetup, scanMode: activeMode }}
        isSessionActive={true}
        onToggleScanMode={handleToggleScanMode}
        onEditSetup={handleEditSetup}
        onOpenLanding={() => setShowLanding(true)}
        serverConnected={serverConnected}
        queueCount={activeQueue.length}
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
            activeSessionScans={activeQueue}
            scanMode={activeMode}
            onToggleScanMode={handleToggleScanMode}
            sessionSetup={{ ...sessionSetup, scanMode: activeMode }}
            facingMode={cameraFacingMode}
            isTorchOn={isTorchOn}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'dashboard' && (
          <MobileAnalytics
            scanLogs={activeQueue}
            sessionSetup={{ ...sessionSetup, scanMode: activeMode }}
            onResetQueue={handleOpenResetModal}
            onDeleteScan={handleDeleteScan}
          />
        )}

        {(activeTab === 'about' || activeTab === 'idcards') && (
          <AboutUs />
        )}

        {activeTab === 'settings' && (
          <SessionSetup
            initialSetup={{ ...sessionSetup, scanMode: activeMode }}
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
        queueCount={activeQueue.length}
      />

      {/* Duty Officer Batch Sync QR Presentation Modal */}
      <SyncControl
        isOpen={isBatchSyncOpen}
        onClose={() => setIsBatchSyncOpen(false)}
        offlineQueue={activeQueue}
        adminIp={adminIpState}
        sessionSetup={{ ...sessionSetup, scanMode: activeMode }}
        dutyOfficer={sessionSetup.dutyOfficer}
        sessionName={`${sessionSetup.battalion} - ${sessionSetup.company} (${sessionSetup.platoon})`}
        onSyncSuccess={handleSyncSuccess}
        onResetQueue={handleOpenResetModal}
        hideBottomBar={true}
      />

      {/* Custom UI Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title={`⚠️ Reset ${activeMode} Session?`}
        message={`Are you sure you want to clear all ${activeQueue.length} ${activeMode} scanned records from this device? This action cannot be undone.`}
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
