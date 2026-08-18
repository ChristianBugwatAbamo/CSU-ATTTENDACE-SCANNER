import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import { formatCadetHeading } from '../services/cadetDirectory';

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

  // Real-time Ref Set of scanned Cadet IDs to prevent stale closures and rapid frame duplicates
  const scannedIdsSetRef = useRef(new Set());

  // Keep Ref Set synchronized with activeSessionScans for the current Unit Context
  useEffect(() => {
    const currentSet = new Set();
    if (Array.isArray(activeSessionScans)) {
      activeSessionScans.forEach(scan => {
        if (!scan.cadetId) return;

        // Scope check for current battalion, company, platoon, and scan mode
        const matchBn = !sessionSetup?.battalion || sessionSetup.battalion === 'All Battalions' || scan.battalion === sessionSetup.battalion || (scan.sessionName || '').includes(sessionSetup.battalion);
        const setupCoClean = (sessionSetup?.company || '').replace(' Company', '');
        const matchCo = !sessionSetup?.company || sessionSetup.company === 'All Companies' || (scan.company || '').includes(setupCoClean) || (scan.sessionName || '').includes(setupCoClean);
        if (scan.cadetId) currentSet.add(scan.cadetId);
      });
    }
    scannedIdsSetRef.current = currentSet;
  }, [activeSessionScans]);

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
    console.log("Scanned QR Text:", decodedText);
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

    // STRICT CHECK: ONLY ONCE PER ID QR CODE IN ACTIVE SCOPE
    if (scannedIdsSetRef.current.has(rawId)) {
      playBeep(400, 'sawtooth', 0.25);
      triggerHaptic([200, 100, 200, 100, 200]); // Strong vibration alert for duplicate
      setScanFlash('warning');
      setTimeout(() => setScanFlash(null), 850);

      const dupHeading = embeddedName
        ? formatCadetHeading({ name: embeddedName, cadetId: rawId })
        : formatCadetHeading({ cadetId: rawId });

      setLastScanToast({
        type: 'warning',
        title: 'DUPLICATE CADET QR BLOCKED',
        cadetId: dupHeading,
        message: `Cadet ${rawId} has ALREADY been scanned in this session!`
      });
      setTimeout(() => setLastScanToast(null), 3000);
      return;
    }

    // Immediately add to Real-time Ref Set to block rapid camera callbacks
    scannedIdsSetRef.current.add(rawId);

    // Success feedback
    playBeep(1046.5, 'sine', 0.15); // High C pitch beep
    triggerHaptic([80, 40, 80]);
    setScanFlash('success');
    setTimeout(() => setScanFlash(null), 850);

    const activeMode = scanMode || 'Time-In';

    // DIRECT NAME PARSING: Use the real name encoded in the QR code directly!
    const scanRecord = {
      cadetId: rawId,
      name: embeddedName || '',
      rank: 'Cadet',
      scanMode: activeMode,
      timestamp: new Date().toISOString(),
      battalion: sessionSetup ? sessionSetup.battalion : '1st Battalion',
      company: sessionSetup ? sessionSetup.company : 'Alpha Company',
      platoon: sessionSetup ? sessionSetup.platoon : '1st Platoon',
      status: activeMode === 'Time-In' ? 'TIME-IN RECORDED' : 'TIME-OUT RECORDED'
    };

    onScanSuccess(scanRecord);

    const headingName = formatCadetHeading(scanRecord);

    setLastScanToast({
      type: 'success',
      title: `${activeMode.toUpperCase()} CONFIRMED`,
      cadetId: headingName,
      message: `ID: ${rawId} • ${sessionSetup?.platoon || '1st Platoon'} recorded.`
    });

    setTimeout(() => setLastScanToast(null), 3000);
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

          {/* Top-Right Badges: TIME-IN MODE & LIVE Indicator */}
          <div className="scanner-topbar-badges">
            <span className={`scanner-mode-pill ${scanMode === 'Time-In' ? 'mode-timein' : 'mode-timeout'}`}>
              {scanMode === 'Time-In' ? '🟢 TIME-IN' : '🟡 TIME-OUT'}
            </span>

            <div className="scanner-live-pill">
              <span className={`live-dot ${isScanning ? 'dot-active' : 'dot-inactive'}`}></span>
              <span>{isScanning ? 'LIVE' : 'INIT'}</span>
            </div>
          </div>
        </div>

        {/* Toast Feedback */}
        {lastScanToast && (
          <div className="scan-toast" style={{ borderColor: lastScanToast.type === 'warning' ? '#ef4444' : 'var(--rotc-yellow-gold)' }}>
            {lastScanToast.type === 'warning' ? (
              <AlertTriangle size={28} color="#ef4444" />
            ) : (
              <CheckCircle2 size={28} color="var(--rotc-green-primary)" />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: lastScanToast.type === 'warning' ? '#dc2626' : 'var(--rotc-green-dark)' }}>
                {lastScanToast.title}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{lastScanToast.cadetId}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastScanToast.message}</div>
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
            Point camera at Cadet QR Code ID card
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
    </div>
  );
}

export { QRScanner as FieldScannerView };
