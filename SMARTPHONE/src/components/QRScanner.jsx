import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, AlertTriangle, Shield, Users, UserPlus, Info, Settings, Lock, ShieldAlert } from 'lucide-react';
import { formatCadetHeading } from '../services/cadetDirectory';
import scannerAudio from '../services/scannerAudio';

const PLATOON_QUOTA = 37;

// Helper to filter scans for active unit context
const getActiveUnitScans = (scans, setup, mode) => {
  if (!Array.isArray(scans)) return [];
  const activeBn = (setup?.battalion || '1st Battalion').trim();
  const activeCoy = (setup?.company || 'Alpha Company').trim();
  const activePltn = (setup?.platoon || '1st Platoon').trim();
  const activeMode = mode || setup?.scanMode || 'Time-In';

  return scans.filter(scan => {
    if (!scan.cadetId) return false;
    const id = String(scan.cadetId).trim();
    if (id.startsWith('{') || id.startsWith('[') || id.startsWith('http')) return false;

    // Battalion match
    const matchBn = !setup?.battalion ||
      setup.battalion === 'All Battalions' ||
      scan.battalion === setup.battalion ||
      (scan.sessionName || '').includes(setup.battalion);

    // Company match
    const setupCoClean = activeCoy.replace(' Company', '');
    const matchCo = !setup?.company ||
      setup.company === 'All Companies' ||
      (scan.company || '').includes(setupCoClean) ||
      (scan.sessionName || '').includes(setupCoClean);

    // Platoon match
    const setupPlClean = activePltn.replace(' Platoon', '');
    const matchPl = !setup?.platoon ||
      setup.platoon === 'All Platoons' ||
      scan.platoon === setup.platoon ||
      (scan.sessionName || '').includes(setup.platoon);

    // Scan Mode match (Time-In vs Time-Out)
    const matchMode = !activeMode || scan.scanMode === activeMode;

    return matchBn && matchCo && matchPl && matchMode;
  });
};

export default function QRScanner({
  onScanSuccess,
  activeSessionScans = [],
  scanMode = 'Time-In',
  sessionSetup = {},
  facingMode = 'environment',
  isTorchOn = false,
  onOpenSettings
}) {
  const html5QrcodeScannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastScanToast, setLastScanToast] = useState(null);
  const [scanFlash, setScanFlash] = useState(null); // 'success' | 'warning' | null

  // Setup Required Modal State (shown when scanning while setup is incomplete)
  const [isSetupRequiredModalOpen, setIsSetupRequiredModalOpen] = useState(false);

  // Check if session setup is fully configured
  const isSetupComplete = Boolean(
    sessionSetup?.dutyOfficer &&
    sessionSetup?.dutyOfficer.trim() &&
    sessionSetup?.dutyOfficer !== '(Not Configured)' &&
    sessionSetup?.battalion &&
    sessionSetup?.battalion.trim() &&
    sessionSetup?.company &&
    sessionSetup?.company.trim() &&
    sessionSetup?.platoon &&
    sessionSetup?.platoon.trim()
  );

  // Hard-Stop Capacity Error Modal State (Strict 37 Cadets Max - Zero Override)
  const [capacityFullModal, setCapacityFullModal] = useState(null);

  // Echelon Mismatch Alert state
  const [echelonMismatchAlert, setEchelonMismatchAlert] = useState(null);

  // Steady, non-flickering notification overlay alert state
  const [alertState, setAlertState] = useState({ active: false, type: '', message: '' });

  // Steady Invalid QR Modal State
  const [scanErrorModal, setScanErrorModal] = useState({ visible: false, title: '', message: '' });

  // Real-time Ref Set of scanned Cadet IDs to prevent stale closures and rapid frame duplicates
  const scannedIdsSetRef = useRef(new Set());

  // Scoped active scans count
  const activeUnitScans = getActiveUnitScans(activeSessionScans, sessionSetup, scanMode);
  const activeScannedCount = activeUnitScans.length;
  const isCapacityFull = activeScannedCount >= PLATOON_QUOTA;

  // Keep Ref Set synchronized with activeSessionScans for the current Unit Context
  useEffect(() => {
    const currentSet = new Set();
    activeUnitScans.forEach(scan => {
      if (scan.cadetId) currentSet.add(String(scan.cadetId).trim().toUpperCase());
    });
    scannedIdsSetRef.current = currentSet;
  }, [activeSessionScans, sessionSetup, scanMode]);

  // Warning Buzzer Sound (Haptic Vibration Disabled)
  const playWarningBuzzer = () => {
    scannerAudio.playMismatchWarning();
  };

  // Invalid QR Warning Handler without Haptic Vibration
  const handleInvalidQrCode = (errorDetails) => {
    scannerAudio.playInvalidQrError();

    // 3. Set steady modal state
    setScanErrorModal({
      visible: true,
      title: 'UNAUTHORIZED QR CODE',
      message: errorDetails || 'Invalid format. This scanner only accepts official CSU ROTC ID cards.',
    });
  };

  // Haptic Feedback - Strictly Disabled
  const triggerHaptic = (pattern = [100, 50, 100]) => {
    // DISABLE DEVICE VIBRATION ON ALL ALERTS
    // if (navigator.vibrate) {
    //   navigator.vibrate(pattern);
    // }
  };

  // Flashlight / Torch Control using MediaStreamTrack API
  useEffect(() => {
    const applyTorch = async () => {
      try {
        const videoElem = document.querySelector("#reader video");
        if (videoElem && videoElem.srcObject) {
          const track = videoElem.srcObject.getVideoTracks()[0];
          if (track && typeof track.applyConstraints === 'function') {
            await track.applyConstraints({ advanced: [{ torch: isTorchOn }] });
          }
        }
      } catch (err) {
        console.warn("Torch constraint not supported or failed on this device:", err);
      }
    };
    applyTorch();
  }, [isTorchOn, isScanning]);

  // Start / Restart Camera with current facingMode (Front vs Back) and proper track lifecycle
  useEffect(() => {
    let isMounted = true;

    const stopVideoTracks = () => {
      try {
        const videoElem = document.querySelector("#reader video");
        if (videoElem && videoElem.srcObject) {
          const stream = videoElem.srcObject;
          stream.getTracks().forEach(track => {
            try { track.stop(); } catch (_) {}
          });
          videoElem.srcObject = null;
        }
      } catch (_) {}
    };

    const initCameraScanner = async () => {
      try {
        // Stop any running scanner instance
        if (html5QrcodeScannerRef.current) {
          try {
            if (html5QrcodeScannerRef.current.isScanning) {
              await html5QrcodeScannerRef.current.stop();
            }
            await html5QrcodeScannerRef.current.clear();
          } catch (_) {}
        }
        stopVideoTracks();

        const readerElem = document.getElementById("reader");
        if (!readerElem) return;

        const html5Qrcode = new Html5Qrcode("reader");
        html5QrcodeScannerRef.current = html5Qrcode;

        const cameraConfig = { facingMode: facingMode || "environment" };
        const scanConfig = {
          fps: 15,
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        await html5Qrcode.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            if (isMounted) handleScannedCode(decodedText);
          },
          () => {} // Silent on non-detection frame ticks
        );

        if (isMounted) {
          setIsScanning(true);
          setCameraError('');
        }
      } catch (err) {
        console.error("Camera start error, trying fallback facingMode:", err);
        if (!isMounted) return;

        try {
          stopVideoTracks();
          const fallbackFacing = facingMode === 'environment' ? 'user' : 'environment';
          const fallbackScanner = new Html5Qrcode("reader");
          html5QrcodeScannerRef.current = fallbackScanner;

          await fallbackScanner.start(
            { facingMode: fallbackFacing },
            {
              fps: 15,
              qrbox: { width: 300, height: 300 },
              aspectRatio: 1.0,
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            },
            (decodedText) => {
              if (isMounted) handleScannedCode(decodedText);
            },
            () => {}
          );

          if (isMounted) {
            setIsScanning(true);
            setCameraError('');
          }
        } catch (fallbackErr) {
          console.error("Camera fallback failed:", fallbackErr);
          if (isMounted) {
            setCameraError('Camera access required. Please check camera permissions in browser.');
            setIsScanning(false);
          }
        }
      }
    };

    initCameraScanner();

    return () => {
      isMounted = false;
      if (html5QrcodeScannerRef.current) {
        try {
          if (html5QrcodeScannerRef.current.isScanning) {
            html5QrcodeScannerRef.current.stop().catch(e => console.warn(e));
          }
        } catch (_) {}
      }
      stopVideoTracks();
    };
  }, [facingMode]);

// Strict JSON Structural Validator for Official CSU ROTC Cadet ID QR Code
const isValidRotcPayload = (data) => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;

  // Ensure exact keys exist and no extra metadata is added
  const keys = Object.keys(data);
  const requiredKeys = ['id', 'name', 'bat', 'coy', 'pl'];

  // Reject if key count doesn't match exactly 5
  if (keys.length !== 5) return false;

  // Validate presence and data types of required short keys
  const hasValidKeys = requiredKeys.every((key) => key in data);
  const hasValidTypes =
    typeof data.id === 'string' &&
    data.id.trim().length > 0 &&
    typeof data.name === 'string' &&
    data.name.trim().length > 0 &&
    typeof data.bat === 'number' &&
    typeof data.coy === 'number' &&
    typeof data.pl === 'number';

  return hasValidKeys && hasValidTypes;
};

// Helper to extract numeric values
const extractNumber = (str) => {
  if (!str && str !== 0) return null;
  if (typeof str === 'number') return str;
  const match = String(str).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

// Helper to extract numeric company code 1-4
const getCompanyCode = (companyStr) => {
  if (!companyStr && companyStr !== 0) return null;
  if (typeof companyStr === 'number') return companyStr;
  const upper = String(companyStr).toUpperCase();
  if (upper.includes('ALPHA') || upper === '1') return 1;
  if (upper.includes('BRAVO') || upper === '2') return 2;
  if (upper.includes('CHARLIE') || upper === '3') return 3;
  if (upper.includes('DELTA') || upper === '4') return 4;
  return null;
};

const companyMap = {
  1: 'Alpha Company',
  2: 'Bravo Company',
  3: 'Charlie Company',
  4: 'Delta Company'
};

const companyNameMap = {
  1: 'ALPHA COY',
  2: 'BRAVO COY',
  3: 'CHARLIE COY',
  4: 'DELTA COY'
};

  const handleScannedCode = (decodedText) => {
    if (!decodedText) return;

    // 0. ENFORCE REQUIRED SETUP: Block QR scan execution if activeSession is incomplete
    if (!isSetupComplete) {
      scannerAudio.playSetupRequiredAlert();
      setAlertState({
        active: true,
        type: 'WARNING',
        message: 'Field session setup is incomplete. Please configure Platoon Leader, Unit & Platoon before scanning.'
      });
      setIsSetupRequiredModalOpen(true);
      return;
    }

    let data = null;
    try {
      if (typeof decodedText === 'string' && decodedText.trim().startsWith('{')) {
        data = JSON.parse(decodedText.trim());
      }
    } catch (e) {
      data = null;
    }

    // Silently ignore Laptop Batch Sync QR payload if presented
    if (data && (data.T === 'RBS' || data.TYPE === 'ROTC_BATCH_SYNC' || data.records || data.r)) {
      return;
    }

    // 1. STRICT JSON STRUCTURAL VALIDATION: Reject any non-official ROTC QR code
    if (!isValidRotcPayload(data)) {
      handleInvalidQrCode('Invalid format. This scanner only accepts official CSU ROTC ID cards.');
      return;
    }

    const cadetId = String(data.id).trim().toUpperCase();
    const cadetName = String(data.name).trim().toUpperCase();
    const cadetBat = data.bat;
    const cadetCoy = data.coy;
    const cadetPl = data.pl;

    // 2. ACTIVE SESSION ECHELON VALIDATION: Check against scanner session settings
    const targetBat = sessionSetup?.battalion && !sessionSetup.battalion.includes('All') && sessionSetup.battalion !== 'CADET OFFICERS'
      ? extractNumber(sessionSetup.battalion)
      : null;
    const targetCoy = sessionSetup?.company && !sessionSetup.company.includes('All') && !['1CL', '2CL', '3CL', '4CL', 'ASPIRANT'].includes(sessionSetup.company)
      ? getCompanyCode(sessionSetup.company)
      : null;
    const targetPl = sessionSetup?.platoon && !sessionSetup.platoon.includes('All') && sessionSetup.platoon !== 'Officer Corps'
      ? extractNumber(sessionSetup.platoon)
      : null;

    const isBatMismatch = targetBat !== null && cadetBat !== targetBat;
    const isCoyMismatch = targetCoy !== null && cadetCoy !== targetCoy;
    const isPlMismatch = targetPl !== null && cadetPl !== targetPl;

    if (isBatMismatch || isCoyMismatch || isPlMismatch) {
      scannerAudio.playMismatchWarning();
      setAlertState({
        active: true,
        type: 'MISMATCH',
        message: `CDT ${cadetName} is assigned to Platoon ${cadetPl}, which does not match active ${sessionSetup?.platoon || '1st Platoon'}.`
      });
      return; // Reject wrong platoon scan
    }

    const activeMode = scanMode || 'Time-In';
    const nowIso = new Date().toISOString();

    const decodedBattalion = cadetBat === 2 ? '2nd Battalion' : '1st Battalion';
    const decodedCompany = companyMap[cadetCoy] || 'Alpha Company';
    const decodedPlatoon = cadetPl === 1 ? '1st Platoon' : cadetPl === 2 ? '2nd Platoon' : cadetPl === 3 ? '3rd Platoon' : cadetPl === 4 ? '4th Platoon' : `${cadetPl}th Platoon`;

    const scanRecord = {
      cadetId: cadetId,
      name: cadetName,
      rank: 'Cadet',
      scanMode: activeMode,
      timestamp: nowIso,
      battalion: decodedBattalion,
      company: decodedCompany,
      platoon: decodedPlatoon,
      status: activeMode === 'Time-In' ? 'TIME-IN' : 'TIME-OUT'
    };
    const headingName = formatCadetHeading(scanRecord);

    // 3. STRICT CHECK: ONLY ONCE PER ID QR CODE IN ACTIVE SCOPE
    if (scannedIdsSetRef.current.has(cadetId)) {
      scannerAudio.playDuplicateScan();
      setAlertState({
        active: true,
        type: 'ALREADY_RECORDED',
        message: `${headingName} has already logged attendance for this ${activeMode} session.`
      });
      return;
    }

    // 4. HARD SCAN GUARD: CHECK PLATOON QUOTA CAPACITY (37 CADETS FIXED - NO OVERRIDE)
    if (scannedIdsSetRef.current.size >= PLATOON_QUOTA) {
      scannerAudio.playQuotaLimitAlert();
      setAlertState({
        active: true,
        type: 'WARNING',
        message: `Maximum quota of ${PLATOON_QUOTA} cadets reached for ${sessionSetup?.platoon || '1st Platoon'}! Scan blocked.`
      });

      // Trigger Hard-Stop Capacity Error Modal (No Override Option)
      setCapacityFullModal({
        headingName,
        cadetId,
        platoon: sessionSetup?.platoon || decodedPlatoon || '1st Platoon'
      });
      return;
    }

    // 5. UNDER CAPACITY: Process normal scan
    scannedIdsSetRef.current.add(cadetId);

    // Play distinct single-play tone based on Time-In vs Time-Out mode
    if (activeMode === 'Time-Out') {
      scannerAudio.playTimeOutSuccess();
    } else {
      scannerAudio.playTimeInSuccess();
    }

    setAlertState({ active: false, type: '', message: '' });
    setScanErrorModal({ visible: false, title: '', message: '' });

    onScanSuccess(scanRecord);

    setLastScanToast({
      type: 'success',
      title: `✅ SCANNED / RECORDED (${activeMode.toUpperCase()})`,
      cadetId: headingName,
      message: `ID: ${cadetId} • ${sessionSetup?.platoon || decodedPlatoon} (${scannedIdsSetRef.current.size}/${PLATOON_QUOTA})`
    });

    setTimeout(() => setLastScanToast(null), 3000);
  };

  // Formatted active unit echelon banner text
  const isSetupUnconfigured = !sessionSetup?.dutyOfficer || !sessionSetup?.battalion || !sessionSetup?.company || !sessionSetup?.platoon;
  const activeBn = (sessionSetup?.battalion || 'All Battalions').toUpperCase();
  const activeCoy = (sessionSetup?.company ? sessionSetup.company.replace(' Company', ' COY') : 'All Companies').toUpperCase();
  const activePltn = (sessionSetup?.platoon || 'All Platoons').toUpperCase();
  const activeScanModeLabel = (scanMode || 'Time-In').toUpperCase();
  const formattedUnitBanner = `${activeBn} • ${activeCoy} • ${activePltn}`;

  return (
    <div className="scanner-edge-container">
      {/* Dynamic Camera Feed Container Card */}
      <div className={`camera-container-card ${scanFlash ? `flash-${scanFlash}` : ''}`}>
        {/* HTML5 QR Camera Element */}
        <div id="reader" className="camera-feed-viewport"></div>

        {/* Steady Invalid QR Overlay Modal */}
        {scanErrorModal.visible && (
          <div className="absolute inset-x-4 top-16 z-50 bg-slate-900 border-2 border-red-600 rounded-2xl p-4 shadow-2xl transition-none" style={{
            position: 'absolute',
            left: '1rem',
            right: '1rem',
            top: '4rem',
            zIndex: 50,
            background: '#0f172a',
            border: '2px solid #dc2626',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            transition: 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            {/* Static Warning Icon */}
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0" style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.75rem',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle className="w-5 h-5 text-red-500" style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />
            </div>

            <div className="flex-1" style={{ flex: 1 }}>
              <h4 className="text-xs font-black text-red-500 uppercase tracking-wide" style={{
                fontSize: '0.75rem',
                fontWeight: 900,
                color: '#ef4444',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0
              }}>
                {scanErrorModal.title}
              </h4>
              <p className="text-xs font-bold text-white mt-0.5" style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0.15rem 0 0 0'
              }}>
                INVALID ROTC FORMAT
              </p>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug" style={{
                fontSize: '0.7rem',
                color: '#cbd5e1',
                marginTop: '0.25rem',
                lineHeight: 1.35,
                margin: '0.25rem 0 0 0'
              }}>
                {scanErrorModal.message}
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => setScanErrorModal({ visible: false })}
              className="text-slate-400 hover:text-white text-xs font-bold p-1"
              style={{
                color: '#94a3b8',
                background: 'none',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                padding: '0.25rem',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Steady, non-flickering notification overlay for Platoon Mismatch or Already Logged */}
        {alertState.active && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-slate-900 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl transition-opacity duration-200" style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            right: '1rem',
            zIndex: 50,
            background: '#0f172a',
            border: '2px solid #f59e0b',
            borderRadius: '1rem',
            padding: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0" style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.75rem',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle className="w-5 h-5 text-amber-400" style={{ width: '1.25rem', height: '1.25rem', color: '#fbbf24' }} />
            </div>

            <div className="flex-1" style={{ flex: 1 }}>
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wide" style={{
                fontSize: '0.75rem',
                fontWeight: 900,
                color: '#fbbf24',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0
              }}>
                {alertState.type === 'MISMATCH' ? 'Platoon Mismatch' : (alertState.type === 'ALREADY_RECORDED' ? 'Already Recorded' : 'Scan Alert')}
              </h4>
              <p className="text-xs text-slate-200 mt-1 font-medium leading-snug" style={{
                fontSize: '0.75rem',
                color: '#e2e8f0',
                marginTop: '0.25rem',
                fontWeight: 500,
                lineHeight: 1.35,
                margin: '0.25rem 0 0 0'
              }}>
                {alertState.message}
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => setAlertState({ active: false })}
              className="text-slate-400 hover:text-white text-xs font-bold p-1"
              style={{
                color: '#94a3b8',
                background: 'none',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                padding: '0.25rem',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Top Header Bar on Camera Feed */}
        <div className="scanner-floating-topbar">
          <div className="scanner-topbar-title">
            <Camera size={18} />
            <span>FIELD QR SCANNER</span>
          </div>

          {/* Top-Right Badges: CAPACITY PILL, TIME-IN MODE & LIVE Indicator */}
          <div className="scanner-topbar-badges">
            {/* Platoon Capacity Pill */}
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '9999px',
              background: isCapacityFull ? '#fee2e2' : 'rgba(0, 0, 0, 0.45)',
              color: isCapacityFull ? '#dc2626' : '#ffffff',
              border: isCapacityFull ? '1px solid #f87171' : '1px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}>
              <Users size={12} />
              <span>{activeScannedCount}/{PLATOON_QUOTA}</span>
            </span>

            <span className={`scanner-mode-pill ${scanMode === 'Time-In' ? 'mode-timein' : scanMode === 'Time-Out' ? 'mode-timeout' : 'mode-unselected'}`}>
              {scanMode === 'Time-In' ? '🟢 TIME-IN' : scanMode === 'Time-Out' ? '🟡 TIME-OUT' : '⚪ MODE UNSET'}
            </span>

            <div className="scanner-live-pill">
              <span className={`live-dot ${isScanning ? 'dot-active' : 'dot-inactive'}`}></span>
              <span>{isScanning ? 'LIVE' : 'INIT'}</span>
            </div>
          </div>
        </div>

        {/* Capacity Full Warning Banner on Viewfinder */}
        {isCapacityFull && (
          <div style={{
            position: 'absolute',
            top: '56px',
            left: '12px',
            right: '12px',
            background: 'rgba(185, 28, 28, 0.92)',
            color: '#ffffff',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: 800,
            textAlign: 'center',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <AlertTriangle size={13} color="#fef08a" />
            <span>CAPACITY FULL ({activeScannedCount}/{PLATOON_QUOTA}) — SCANS BLOCKED</span>
          </div>
        )}

        {/* Toast Feedback */}
        {lastScanToast && (
          <div
            className="scan-toast"
            style={{
              border: `1.5px solid ${
                lastScanToast.type === 'warning' ? '#ef4444' : '#10b981'
              }`,
              background: lastScanToast.type === 'warning' ? 'var(--bg-dark-card)' : 'var(--bg-dark-card)',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              borderRadius: '12px'
            }}
          >
            {lastScanToast.type === 'warning' ? (
              <AlertTriangle size={28} color="#f59e0b" />
            ) : lastScanToast.type === 'info' ? (
              <CheckCircle2 size={28} color="#10b981" />
            ) : (
              <CheckCircle2 size={28} color="#10b981" />
            )}
            <div>
              <div
                style={{
                  fontWeight: 850,
                  fontSize: '0.85rem',
                  color: lastScanToast.type === 'warning' ? '#f59e0b' : 'var(--rotc-gold-bright)'
                }}
              >
                {lastScanToast.title}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#ffffff'
                }}
              >
                {lastScanToast.cadetId}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-subtle)',
                  fontWeight: 500
                }}
              >
                {lastScanToast.message}
              </div>
            </div>
          </div>
        )}

        {/* Viewfinder Reticles & Sweeping Laser Overlay */}
        <div className="scanner-overlay">
          <div className="target-box">
            <div className="corner-mark corner-tl"></div>
            <div className="corner-mark corner-tr"></div>
            <div className="corner-mark corner-bl"></div>
            <div className="corner-mark corner-br"></div>
            <div className="scan-laser-line"></div>
          </div>

          {/* Floating Guide Prompt below target reticle */}
          <div className="scanner-floating-guide">
            {isCapacityFull
              ? 'Platoon capacity reached (37/37 cadets)'
              : 'Point camera at Cadet QR Code ID card'}
          </div>
        </div>

        {cameraError && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '16px',
            right: '16px',
            background: 'rgba(239, 68, 68, 0.92)',
            color: '#ffffff',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            textAlign: 'center',
            zIndex: 35,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            {cameraError}
          </div>
        )}
      </div>

      {/* Hard-Stop Platoon Capacity Error Modal (Strict 37 Max, No Override) */}
      {capacityFullModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-dark-card, #0f172a)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '390px',
            padding: '1.5rem',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.85), 0 0 25px rgba(220, 38, 38, 0.35)',
            border: '2px solid #ef4444',
            color: '#ffffff',
            animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header Icon & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.18)',
                color: '#f87171',
                border: '1.5px solid #ef4444',
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f87171' }}>
                  HARD CAPACITY LIMIT (37/37)
                </span>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '0.4px'
                }}>
                  Platoon Capacity Full
                </h3>
              </div>
            </div>

            {/* Body Text */}
            <p style={{
              fontSize: '0.86rem',
              lineHeight: '1.5',
              color: 'var(--text-subtle, #cbd5e1)',
              margin: '0 0 1rem 0'
            }}>
              The strict maximum quota of <strong>37 cadets</strong> has already been scanned for <strong>{capacityFullModal.platoon}</strong>. Scanning a 38th cadet is strictly prohibited with zero override.
            </p>

            {/* Rejected Cadet Details */}
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              marginBottom: '1.25rem',
              fontSize: '0.8rem'
            }}>
              <div style={{ color: '#f87171', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Lock size={13} /> Scan Hard-Blocked:
              </div>
              <div style={{ color: '#ffffff', fontWeight: 700 }}>
                {capacityFullModal.headingName} ({capacityFullModal.cadetId})
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--rotc-gold-bright, #e5a900)', fontWeight: 600 }}>
                • Platoon Strength: 37 / 37 Cadets (0 slots remaining)
              </div>
            </div>

            {/* Hard Stop Dismissal Button (Zero Override) */}
            <button
              type="button"
              onClick={() => setCapacityFullModal(null)}
              style={{
                width: '100%',
                padding: '0.8rem 1rem',
                borderRadius: '10px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              UNDERSTOOD / CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Echelon Mismatch Alert Modal */}
      {echelonMismatchAlert?.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            border: '2px solid #f59e0b',
            borderRadius: '1.25rem',
            padding: '1.5rem',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              background: '#fef3c7',
              color: '#d97706',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{
              fontWeight: 900,
              color: '#0f172a',
              fontSize: '1.15rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              margin: 0,
              fontFamily: 'Oswald, sans-serif'
            }}>
              Platoon Mismatch!
            </h3>

            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '0.75rem',
              padding: '0.85rem',
              textAlign: 'left',
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#78350f' }}>
                Cadet: <span style={{ fontWeight: 900 }}>{echelonMismatchAlert.cadetName} ({echelonMismatchAlert.cadetId})</span>
              </p>
              <p style={{ margin: 0, color: '#475569' }}>
                Assigned to: <span style={{ fontWeight: 800, color: '#e11d48' }}>{echelonMismatchAlert.cadetEchelon}</span>
              </p>
              <p style={{ margin: 0, color: '#475569' }}>
                Scanner Session: <span style={{ fontWeight: 800, color: '#047857' }}>{echelonMismatchAlert.scannerEchelon}</span>
              </p>
            </div>

            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
              This cadet cannot log attendance in this scanner session.
            </p>

            <button
              type="button"
              onClick={() => setEchelonMismatchAlert({ show: false })}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#f59e0b',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              Dismiss Alert
            </button>
          </div>
        </div>
      )}

      {/* Required Setup Gate Modal */}
      {isSetupRequiredModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSetupRequiredModalOpen(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 15, 8, 0.82)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '390px',
            padding: '1.5rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
            border: '1px solid var(--border-light)',
            animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {/* Header Icon */}
            <div style={{
              width: '52px',
              height: '52px',
              background: '#fef3c7',
              color: '#d97706',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <ShieldAlert size={28} />
            </div>

            <h3 style={{
              fontWeight: 900,
              color: '#0f172a',
              fontSize: '1.15rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              margin: 0,
              fontFamily: 'Oswald, sans-serif'
            }}>
              Setup Configuration Required
            </h3>

            <p style={{
              fontSize: '0.86rem',
              lineHeight: '1.45',
              color: '#4b5563',
              margin: '0'
            }}>
              Scanning is locked because your field session settings are incomplete. Please configure your <strong>Platoon Leader In Charge, Battalion, Company, and Platoon</strong> before recording cadet attendance.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsSetupRequiredModalOpen(false)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1.5px solid #d1d5db',
                  background: '#f9fafb',
                  color: '#374151',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSetupRequiredModalOpen(false);
                  if (onOpenSettings) onOpenSettings();
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--rotc-green-dark)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(6, 78, 46, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Settings size={15} />
                <span>Go to Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { QRScanner as FieldScannerView, QRScanner as MobileScannerView };
