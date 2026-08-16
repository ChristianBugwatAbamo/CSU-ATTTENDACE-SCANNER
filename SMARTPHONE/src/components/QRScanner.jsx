import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCadetHeading } from '../services/cadetDirectory';

export default function QRScanner({ onScanSuccess, activeSessionScans, scanMode, sessionSetup }) {
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
        const setupPlClean = (sessionSetup?.platoon || '').replace(' Platoon', '');
        const matchPl = !sessionSetup?.platoon || sessionSetup.platoon === 'All Platoons' || (scan.platoon || '').includes(setupPlClean) || (scan.sessionName || '').includes(setupPlClean);
        const matchMode = !scanMode || scan.scanMode === scanMode;

        if (matchBn && matchCo && matchPl && matchMode) {
          currentSet.add(scan.cadetId.trim().toUpperCase());
        }
      });
    }
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

  useEffect(() => {
    let html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScannerRef.current = html5QrcodeScanner;

    const config = {
      fps: 15,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.333333,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };

    html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        handleScannedCode(decodedText);
      },
      () => {}
    ).then(() => {
      setIsScanning(true);
      setCameraError('');
    }).catch(err => {
      console.warn("Unable to start environment camera, trying default fallback:", err);
      html5QrcodeScanner.start(
        { facingMode: "user" },
        config,
        (decodedText) => {
          handleScannedCode(decodedText);
        },
        () => {}
      ).then(() => {
        setIsScanning(true);
        setCameraError('');
      }).catch(err2 => {
        setCameraError('Camera access required for QR field scanner. Please grant camera permission.');
        setIsScanning(false);
      });
    });

    return () => {
      if (html5QrcodeScannerRef.current && html5QrcodeScannerRef.current.isScanning) {
        html5QrcodeScannerRef.current.stop().catch(e => console.error("Error stopping scanner:", e));
      }
    };
  }, []);

  const handleScannedCode = (codePayload) => {
    const trimmedPayload = codePayload.trim();
    let rawId = '';
    let embeddedName = '';

    // 1. Check if scanned payload is JSON (e.g., { id: "221-00003", name: "AUREA, REYMARK" })
    if (trimmedPayload.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedPayload);

        // If it's a Laptop Batch Sync QR payload, silently ignore it
        if (parsed.T === 'RBS' || parsed.TYPE === 'ROTC_BATCH_SYNC' || parsed.records || parsed.r) {
          return;
        }

        // Extract Cadet ID and Full Name directly from QR JSON
        if (parsed.id) {
          rawId = String(parsed.id).trim().toUpperCase();
        }
        if (parsed.name) {
          embeddedName = String(parsed.name).trim().toUpperCase();
        }
      } catch (err) {
        // Fallback if malformed JSON
      }
    } else if (trimmedPayload.startsWith('[') || trimmedPayload.startsWith('http')) {
      // Silently ignore array payloads or web URLs
      return;
    } else {
      // Plain text Cadet ID (e.g. "221-00003")
      rawId = trimmedPayload.toUpperCase();
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

  return (
    <div className={`scanner-card ${scanFlash ? `flash-${scanFlash}` : ''}`}>
      {/* Top Header & Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'nowrap' }}>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.3px', flexShrink: 0 }}>
          <Camera size={18} />
          <span>FIELD QR SCANNER</span>
        </div>

        {/* Top-Right Badges: TIME-IN MODE & LIVE Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '9999px',
            background: scanMode === 'Time-In' ? '#d1fae5' : '#fef3c7',
            color: scanMode === 'Time-In' ? '#065f46' : '#92400e',
            border: `1px solid ${scanMode === 'Time-In' ? '#6ee7b7' : '#fde68a'}`,
            whiteSpace: 'nowrap'
          }}>
            {scanMode === 'Time-In' ? '🟢 TIME-IN' : '🟡 TIME-OUT'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 800, color: isScanning ? '#059669' : '#dc2626', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isScanning ? '#059669' : '#dc2626' }}></span>
            {isScanning ? 'LIVE' : 'INIT'}
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

      {/* Camera Viewport Container (Fixed 4:3 with Border Radius 12px) */}
      <div className="camera-container">
        <div id="reader"></div>

        {/* Slim Corner Marks Overlay Frame */}
        <div className="scanner-overlay">
          <div className="target-box">
            <div className="corner-mark corner-tl"></div>
            <div className="corner-mark corner-tr"></div>
            <div className="corner-mark corner-bl"></div>
            <div className="corner-mark corner-br"></div>
            <div className="scan-laser-line"></div>
          </div>
        </div>
      </div>

      {cameraError && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginTop: '0.65rem', textAlign: 'center' }}>
          {cameraError}
        </div>
      )}

      {/* Centered Scanning Guide Text */}
      <div style={{ marginTop: '0.65rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        Point camera at Cadet QR Code ID card
      </div>
    </div>
  );
}
