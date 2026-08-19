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

  const handleScannedCode = (decodedText) => {
    if (!decodedText) return;

    let data = decodedText;
    try {
      if (typeof decodedText === 'string' && decodedText.trim().startsWith('{')) {
        data = JSON.parse(decodedText.trim());
      }
    } catch (e) {
      console.warn("JSON parse fallback to plain string:", e);
    }

    let rawId = '';
    let embeddedName = '';

    if (typeof data === 'object' && data !== null) {
      // If it's a Laptop Batch Sync QR payload, silently ignore it
      if (data.T === 'RBS' || data.TYPE === 'ROTC_BATCH_SYNC' || data.records || data.r) {
        return;
      }

      // Extract Cadet ID and Full Name directly from QR JSON
      rawId = data.id || data.cadetId || data.ID || data.CADET_ID || data.cadet_id || '';
      embeddedName = data.name || data.fullName || data.NAME || data.full_name || '';
    } else {
      const textStr = String(decodedText).trim();
      if (textStr.startsWith('[') || textStr.startsWith('http')) {
        return;
      }
      const match = textStr.match(/\b\d{3}-\d{5}\b/) || textStr.match(/\b\d{5,8}\b/);
      if (match) {
        rawId = match[0];
      } else {
        rawId = textStr.split(/[\n,;]/)[0].trim();
      }
    }

    rawId = String(rawId).trim().toUpperCase();
    if (embeddedName) {
      embeddedName = String(embeddedName).trim().toUpperCase();
    }

    if (!rawId) return;

    const activeMode = scanMode || 'Time-In';
    const nowIso = new Date().toISOString();

    const scanRecord = {
      cadetId: rawId,
      name: embeddedName || '',
      rank: 'Cadet',
      scanMode: activeMode,
      timestamp: nowIso,
      battalion: sessionSetup ? sessionSetup.battalion : '1st Battalion',
      company: sessionSetup ? sessionSetup.company : 'Alpha Company',
      platoon: sessionSetup ? sessionSetup.platoon : '1st Platoon',
      status: activeMode === 'Time-In' ? 'TIME-IN' : 'TIME-OUT'
    };
    const headingName = formatCadetHeading(scanRecord);

    // 1. STRICT CHECK: ONLY ONCE PER ID QR CODE IN ACTIVE SCOPE
    if (scannedIdsSetRef.current.has(rawId)) {
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

    // 2. HARD SCAN GUARD: CHECK PLATOON QUOTA CAPACITY (37 CADETS FIXED)
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
        rawId
      });
      return;
    }

    // 3. UNDER CAPACITY: Process normal scan
    scannedIdsSetRef.current.add(rawId);

    // Standard Neutral Success feedback
    playBeep(1046.5, 'sine', 0.15); // High C pitch beep
    triggerHaptic([80, 40, 80]);
    setScanFlash('success');
    setTimeout(() => setScanFlash(null), 850);

    onScanSuccess(scanRecord);

    setLastScanToast({
      type: 'success',
      title: `✅ SCANNED / RECORDED (${activeMode.toUpperCase()})`,
      cadetId: headingName,
      message: `ID: ${rawId} • ${sessionSetup?.platoon || '1st Platoon'} (${scannedIdsSetRef.current.size}/${PLATOON_QUOTA})`
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
    </div>
  );
}

export { QRScanner as FieldScannerView };
