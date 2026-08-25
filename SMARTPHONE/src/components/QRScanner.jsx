import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, AlertTriangle, Shield, Users, UserPlus, Info } from 'lucide-react';
import { formatCadetHeading } from '../services/cadetDirectory';
import ConfirmModal from './ConfirmModal';

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
      (scan.platoon || '').includes(setupPlClean) ||
      (scan.sessionName || '').includes(setupPlClean);

    // Scan Mode match (Time-In vs Time-Out)
    const matchMode = !activeMode || scan.scanMode === activeMode;

    return matchBn && matchCo && matchPl && matchMode;
  });
};

export default function QRScanner({
  onScanSuccess,
  activeSessionScans,
  scanMode,
  sessionSetup,
  facingMode = 'environment',
  isTorchOn = false
}) {
  const html5QrcodeScannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastScanToast, setLastScanToast] = useState(null);
  const [scanFlash, setScanFlash] = useState(null); // 'success' | 'warning' | null

  // Manual override candidate for scanning beyond quota
  const [overrideCandidate, setOverrideCandidate] = useState(null);

  // Echelon Mismatch Alert state
  const [echelonMismatchAlert, setEchelonMismatchAlert] = useState(null);

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

  // Audio Synthesizer Beep
  const playBeep = (freq = 880, type = 'sine', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log("Audio beep unavailable:", e);
    }
  };

  // Warning Buzzer Sound & Haptic Vibration for Echelon Mismatches
  const playWarningBuzzer = () => {
    playBeep(260, 'sawtooth', 0.4);
    triggerHaptic([200, 100, 200, 100, 200]);
  };

  // Haptic Feedback
  const triggerHaptic = (pattern = [100, 50, 100]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
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
      playWarningBuzzer();
      setScanFlash('warning');
      setTimeout(() => setScanFlash(null), 850);

      setLastScanToast({
        type: 'warning',
        title: 'UNAUTHORIZED QR CODE',
        cadetId: 'INVALID ROTC FORMAT',
        message: 'Invalid format. This scanner only accepts official CSU ROTC ID cards.'
      });
      setTimeout(() => setLastScanToast(null), 3500);
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
      playWarningBuzzer();
      setScanFlash('warning');
      setTimeout(() => setScanFlash(null), 850);

      const cadetBatLabel = `${cadetBat === 1 ? '1ST' : '2ND'} BN`;
      const cadetCoyLabel = companyNameMap[cadetCoy] || `COY ${cadetCoy}`;
      const cadetPlLabel = `PL ${cadetPl}`;

      const targetBatLabel = targetBat ? `${targetBat === 1 ? '1ST' : '2ND'} BN` : (sessionSetup?.battalion || '1ST BN');
      const targetCoyLabel = targetCoy ? (companyNameMap[targetCoy] || `COY ${targetCoy}`) : (sessionSetup?.company || 'ALPHA COY');
      const targetPlLabel = targetPl ? `PL ${targetPl}` : (sessionSetup?.platoon || 'PL 1');

      setEchelonMismatchAlert({
        show: true,
        cadetId: cadetId,
        cadetName: cadetName,
        cadetEchelon: `${cadetBatLabel} • ${cadetCoyLabel} • ${cadetPlLabel}`,
        scannerEchelon: `${targetBatLabel} • ${targetCoyLabel} • ${targetPlLabel}`,
        message: `WRONG PLATOON! CDT ${cadetName} belongs to Platoon ${cadetPl}, not your active Platoon ${targetPl || 1}.`
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
      playBeep(523.25, 'sine', 0.18); // Pleasant confirmation chime
      triggerHaptic([60, 40, 60]);
      setScanFlash('success');
      setTimeout(() => setScanFlash(null), 850);

      setLastScanToast({
        type: 'info',
        title: 'CADET ALREADY RECORDED',
        cadetId: headingName,
        message: `${headingName} has already logged attendance for this session!`
      });
      setTimeout(() => setLastScanToast(null), 3000);
      return;
    }

    // 4. HARD SCAN GUARD: CHECK PLATOON QUOTA CAPACITY (37 CADETS FIXED)
    if (scannedIdsSetRef.current.size >= PLATOON_QUOTA) {
      playBeep(300, 'sawtooth', 0.35);
      triggerHaptic([300, 100, 300, 100, 300]);
      setScanFlash('warning');
      setTimeout(() => setScanFlash(null), 850);

      setLastScanToast({
        type: 'warning',
        title: `CAPACITY REACHED (${PLATOON_QUOTA}/${PLATOON_QUOTA})`,
        cadetId: headingName,
        message: `Maximum quota of ${PLATOON_QUOTA} cadets is reached for ${sessionSetup?.platoon || '1st Platoon'}! Scan blocked.`
      });
      setTimeout(() => setLastScanToast(null), 4000);

      // Offer manual override option modal
      setOverrideCandidate({
        scanRecord,
        headingName,
        rawId: cadetId
      });
      return;
    }

    // 5. UNDER CAPACITY: Process normal scan
    scannedIdsSetRef.current.add(cadetId);

    playBeep(1046.5, 'sine', 0.15); // High C pitch beep
    triggerHaptic([80, 40, 80]);
    setScanFlash('success');
    setTimeout(() => setScanFlash(null), 850);

    onScanSuccess(scanRecord);

    setLastScanToast({
      type: 'success',
      title: `✅ SCANNED / RECORDED (${activeMode.toUpperCase()})`,
      cadetId: headingName,
      message: `ID: ${cadetId} • ${sessionSetup?.platoon || decodedPlatoon} (${scannedIdsSetRef.current.size}/${PLATOON_QUOTA})`
    });

    setTimeout(() => setLastScanToast(null), 3000);
  };

  // Handle Manual Override confirmation when capacity is full
  const handleConfirmOverride = () => {
    if (!overrideCandidate) return;
    const { scanRecord, rawId, headingName } = overrideCandidate;

    const extraRecord = {
      ...scanRecord,
      designation: 'Extra / Visitor Cadet'
    };

    scannedIdsSetRef.current.add(rawId);
    playBeep(1046.5, 'sine', 0.15);
    triggerHaptic([80, 40, 80]);
    setScanFlash('success');
    setTimeout(() => setScanFlash(null), 850);

    onScanSuccess(extraRecord);

    setLastScanToast({
      type: 'success',
      title: 'EXTRA CADET RECORDED',
      cadetId: headingName,
      message: `Cadet ${rawId} recorded as Extra / Visitor Cadet.`
    });
    setTimeout(() => setLastScanToast(null), 3500);

    setOverrideCandidate(null);
  };

  const handleCancelOverride = () => {
    setOverrideCandidate(null);
  };

  // Formatted active unit echelon banner text
  const activeBn = (sessionSetup?.battalion || '1st Battalion').toUpperCase();
  const activeCoy = (sessionSetup?.company || 'Alpha Company').replace(' Company', ' COY').toUpperCase();
  const activePltn = (sessionSetup?.platoon || '1st Platoon').toUpperCase();
  const formattedUnitBanner = `${activeBn} • ${activeCoy} • ${activePltn}`;

  return (
    <div className="scanner-page-layout">
      {/* Active Unit Header Banner */}
      <div className="active-unit-scanner-banner">
        <div className="unit-banner-content">
          <Shield size={15} className="unit-banner-shield" />
          <span className="unit-banner-text">{formattedUnitBanner}</span>
        </div>
      </div>

      {/* Centered Camera Container Card */}
      <div className={`camera-container-card ${scanFlash ? `flash-${scanFlash}` : ''}`}>
        {/* Underlying Camera Feed (Constrained inside centered card) */}
        <div id="reader"></div>

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

            <span className={`scanner-mode-pill ${scanMode === 'Time-In' ? 'mode-timein' : 'mode-timeout'}`}>
              {scanMode === 'Time-In' ? '🟢 TIME-IN' : '🟡 TIME-OUT'}
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
              background: lastScanToast.type === 'warning' ? '#fef2f2' : '#ecfdf5',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
              borderRadius: '12px'
            }}
          >
            {lastScanToast.type === 'warning' ? (
              <AlertTriangle size={28} color="#ef4444" />
            ) : lastScanToast.type === 'info' ? (
              <CheckCircle2 size={28} color="#059669" />
            ) : (
              <CheckCircle2 size={28} color="#059669" />
            )}
            <div>
              <div
                style={{
                  fontWeight: 850,
                  fontSize: '0.85rem',
                  color: lastScanToast.type === 'warning' ? '#dc2626' : '#065f46'
                }}
              >
                {lastScanToast.title}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: lastScanToast.type === 'warning' ? '#7f1d1d' : '#047857'
                }}
              >
                {lastScanToast.cadetId}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: lastScanToast.type === 'warning' ? '#991b1b' : '#065f46',
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

      {/* Manual Override Confirmation Modal for Extra / Visitor Cadet */}
      <ConfirmModal
        isOpen={!!overrideCandidate}
        title="⚠️ Platoon Quota Full (37/37)"
        message={`The maximum quota of 37 cadets has already been scanned for ${sessionSetup?.platoon || '1st Platoon'}. Do you want to record ${overrideCandidate?.headingName || overrideCandidate?.rawId} as an Extra / Visitor Cadet?`}
        confirmLabel="Allow Extra Cadet"
        cancelLabel="Cancel / Block"
        onConfirm={handleConfirmOverride}
        onCancel={handleCancelOverride}
        isDestructive={false}
      />

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
    </div>
  );
}

export { QRScanner as FieldScannerView };
