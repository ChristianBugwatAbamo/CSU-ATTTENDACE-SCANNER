import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function BatchScannerModal({ isOpen, onClose, onSyncComplete, cadets }) {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Multi-chunk accumulation state
  const [collectedRecords, setCollectedRecords] = useState([]);
  const [pagesScanned, setPagesScanned] = useState([]);    // page numbers already scanned
  const [totalPages, setTotalPages] = useState(null);       // set after first chunk
  const [lastChunkInfo, setLastChunkInfo] = useState(null);  // { page, total, dutyOfficer, sessionName }
  const [awaitingNextPage, setAwaitingNextPage] = useState(false);

  // Audio Synthesizer Beep
  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log("Audio feedback unavailable:", e);
    }
  };

  // Expand minified payload keys back to full names
  const expandPayload = (raw) => {
    // New ultra-low density format: T='RBS', d, bn, co, pl, s, p, n, r:[{i, n, m, t}]
    if (raw.T === 'RBS') {
      const bn = raw.bn || '1st Battalion';
      const co = raw.co || 'Alpha Company';
      const pl = raw.pl || '1st Platoon';
      const dutyOfficer = raw.d || 'Duty Officer';
      const sessionName = raw.s || `${bn} - ${co} (${pl})`;

      return {
        type: 'ROTC_BATCH_SYNC',
        dutyOfficer: dutyOfficer,
        sessionName: sessionName,
        battalion: bn,
        company: co,
        platoon: pl,
        page: raw.p || 1,
        totalPages: raw.n || 1,
        records: (raw.r || []).map(rec => ({
          cadetId: rec.i,
          name: rec.n || rec.name || '',
          battalion: rec.bn || bn,
          company: rec.co || co,
          platoon: rec.pl || pl,
          rank: rec.rk || 'Cadet',
          scanMode: rec.m === 1 ? 'Time-In' : 'Time-Out',
          timestamp: rec.t ? new Date(rec.t * 1000).toISOString() : new Date().toISOString()
        }))
      };
    }

    // Legacy or full-key format (backwards compat)
    if (raw.type === 'ROTC_BATCH_SYNC' || raw.records) {
      return {
        ...raw,
        dutyOfficer: raw.dutyOfficer || raw.d || 'Duty Officer',
        sessionName: raw.sessionName || raw.s || 'Field Session',
        page: raw.page || raw.p || 1,
        totalPages: raw.totalPages || raw.n || 1,
        records: (raw.records || raw.r || []).map(rec => ({
          cadetId: rec.cadetId || rec.i || rec.id,
          name: rec.name || rec.n || '',
          battalion: rec.battalion || rec.bn || '1st Battalion',
          company: rec.company || rec.co || 'Alpha Company',
          platoon: rec.platoon || rec.pl || '1st Platoon',
          rank: rec.rank || rec.rk || 'Cadet',
          scanMode: rec.scanMode || (rec.m === 1 ? 'Time-In' : (rec.m === 0 ? 'Time-Out' : 'Time-In')),
          timestamp: rec.timestamp || (rec.t ? new Date(rec.t * 1000).toISOString() : new Date().toISOString())
        }))
      };
    }

    return null;
  };

  const startCameraScanner = useCallback(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const el = document.getElementById('hq-batch-reader');
      if (!el) return;

      let html5QrcodeScanner = new Html5Qrcode("hq-batch-reader");
      scannerRef.current = html5QrcodeScanner;

      const config = {
        fps: 15,
        qrbox: { width: 300, height: 300 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        // Request HD resolution for better QR readability
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      };

      const hdConstraints = {
        facingMode: "user",
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      };

      html5QrcodeScanner.start(
        hdConstraints,
        config,
        (decodedText) => {
          handleBatchScanned(decodedText);
        },
        () => {}
      ).then(() => {
        setIsScanning(true);
        setCameraError('');
      }).catch(err => {
        console.warn("HD user camera unavailable, trying environment HD:", err);
        html5QrcodeScanner.start(
          { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          config,
          (decodedText) => {
            handleBatchScanned(decodedText);
          },
          () => {}
        ).then(() => {
          setIsScanning(true);
          setCameraError('');
        }).catch(err2 => {
          // Final fallback: default resolution
          html5QrcodeScanner.start(
            { facingMode: "user" },
            { fps: 15, qrbox: { width: 280, height: 280 }, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] },
            (decodedText) => { handleBatchScanned(decodedText); },
            () => {}
          ).then(() => {
            setIsScanning(true);
            setCameraError('');
          }).catch(err3 => {
            setCameraError("Webcam access required. Please allow camera permissions.");
            setIsScanning(false);
          });
        });
      });
    }, 200);

    return timer;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset all state
    setImportResult(null);
    setIsProcessing(false);
    setCameraError('');
    setCollectedRecords([]);
    setPagesScanned([]);
    setTotalPages(null);
    setLastChunkInfo(null);
    setAwaitingNextPage(false);

    const timer = startCameraScanner();

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => console.error("Error stopping HQ webcam scanner:", e));
      }
    };
  }, [isOpen]);

  const handleBatchScanned = async (decodedText) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      let raw;
      try {
        raw = JSON.parse(decodedText);
      } catch (parseErr) {
        alert("Invalid QR Code: Not valid ROTC batch data.");
        setIsProcessing(false);
        return;
      }

      // Expand minified keys
      const payload = expandPayload(raw);
      if (!payload || !payload.records || payload.records.length === 0) {
        alert("Unrecognized QR format. Expected ROTC Batch Sync structure.");
        setIsProcessing(false);
        return;
      }

      const pageNum = payload.page;
      const total = payload.totalPages;

      // Prevent duplicate page scans
      if (pagesScanned.includes(pageNum)) {
        alert(`Page ${pageNum}/${total} was already scanned. Please show the next page.`);
        setIsProcessing(false);
        return;
      }

      // Stop scanner while processing
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        setIsScanning(false);
      }

      playSuccessBeep();

      // Accumulate records
      const newCollected = [...collectedRecords, ...payload.records];
      const newPagesScanned = [...pagesScanned, pageNum];

      setCollectedRecords(newCollected);
      setPagesScanned(newPagesScanned);
      setTotalPages(total);
      setLastChunkInfo({
        page: pageNum,
        total: total,
        dutyOfficer: payload.dutyOfficer,
        sessionName: payload.sessionName
      });

      // Check if all pages have been scanned
      if (newPagesScanned.length >= total) {
        // All chunks collected — finalize import
        finalizeImport(newCollected, payload.dutyOfficer, payload.sessionName);
      } else {
        // More pages to scan — show "Scan Next" UI
        setAwaitingNextPage(true);
      }
    } catch (err) {
      console.error("Batch QR Import Error:", err);
      alert(`Import Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = (allRecords, dutyOfficer, sessionName) => {
    // DIRECT EXTRACTION: Use scanned values straight from the batch QR payload
    const cadetMap = new Map((cadets || []).map(c => [c.id, c]));

    const enrichedRecords = allRecords.map(rec => {
      const match = cadetMap.get(rec.cadetId);

      // Prioritize name from scanned payload, then matched roster if present, then Cadet ID
      const directName = (rec.name && rec.name !== 'UNREGISTERED CADET' && rec.name.trim().length > 0)
        ? rec.name.trim()
        : (match?.name || (rec.cadetId ? `CADET ${rec.cadetId}` : 'CADET'));

      const directBn = (rec.battalion && rec.battalion !== 'N/A')
        ? rec.battalion
        : (match?.battalion || '1st Battalion');

      const directCo = (rec.company && rec.company !== 'N/A')
        ? rec.company
        : (match?.company || 'Alpha Company');

      const directPl = (rec.platoon && rec.platoon !== 'N/A')
        ? rec.platoon
        : (match?.platoon || '1st Platoon');

      const directRank = (rec.rank && rec.rank !== 'N/A')
        ? rec.rank
        : (match?.rank || 'Cadet');

      return {
        ...rec,
        cadetId: rec.cadetId || 'N/A',
        name: directName,
        rank: directRank,
        battalion: directBn,
        company: directCo,
        platoon: directPl,
        designation: rec.designation || match?.designation || 'None',
        scanMode: rec.scanMode || 'Time-In',
        dutyOfficer: dutyOfficer || 'Duty Officer',
        sessionName: sessionName || 'Field Session',
        status: rec.scanMode === 'Time-Out' ? 'TIME-OUT' : 'PRESENT',
        receivedAt: new Date().toISOString()
      };
    });

    // Push directly to App state
    if (onSyncComplete) {
      onSyncComplete(enrichedRecords);
    }

    // Best-effort background POST for Excel generation
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dutyOfficer: dutyOfficer || 'Mobile Duty Officer',
          sessionName: sessionName || 'Field Session',
          records: enrichedRecords
        })
      }).catch(() => {});
    } catch (_) {}

    setAwaitingNextPage(false);
    setImportResult({
      success: true,
      count: enrichedRecords.length,
      pagesScanned: pagesScanned.length + (pagesScanned.includes(lastChunkInfo?.page) ? 0 : 1),
      dutyOfficer: dutyOfficer || 'Duty Officer',
      sessionName: sessionName || 'Field Session'
    });
  };

  const handleScanNextPage = async () => {
    setAwaitingNextPage(false);

    // Restart camera for next page
    const el = document.getElementById('hq-batch-reader');
    if (el) {
      el.innerHTML = ''; // clear old video element
    }

    const timer = setTimeout(() => {
      const elCheck = document.getElementById('hq-batch-reader');
      if (!elCheck) return;

      let html5QrcodeScanner = new Html5Qrcode("hq-batch-reader");
      scannerRef.current = html5QrcodeScanner;

      const hdConstraints = {
        facingMode: "user",
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      };

      html5QrcodeScanner.start(
        hdConstraints,
        { fps: 15, qrbox: { width: 300, height: 300 }, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] },
        (decodedText) => { handleBatchScanned(decodedText); },
        () => {}
      ).then(() => {
        setIsScanning(true);
      }).catch(() => {
        html5QrcodeScanner.start(
          { facingMode: "user" },
          { fps: 15, qrbox: { width: 280, height: 280 }, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] },
          (decodedText) => { handleBatchScanned(decodedText); },
          () => {}
        ).then(() => setIsScanning(true)).catch(() => {});
      });
    }, 250);
  };

  if (!isOpen) return null;

  // Determine which view to show
  const showCamera = !importResult && !awaitingNextPage;
  const showNextPagePrompt = !importResult && awaitingNextPage;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--rotc-green-dark)', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Oswald, sans-serif' }}>
            <Camera size={22} />
            <span>WEBCAM BATCH QR SCANNER</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={22} />
          </button>
        </div>

        {/* Multi-Page Progress Bar */}
        {totalPages && totalPages > 1 && !importResult && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Chunk Progress</span>
              <span style={{ color: 'var(--rotc-green-dark)' }}>{pagesScanned.length} / {totalPages} pages scanned</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #059669, #10b981)',
                borderRadius: '4px',
                width: `${(pagesScanned.length / totalPages) * 100}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        )}

        {showCamera && (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Hold up the <strong>Duty Officer's smartphone screen</strong> displaying the Summary Batch QR code in front of this webcam.
              {pagesScanned.length > 0 && <span style={{ color: '#059669', fontWeight: 700 }}> — Show Page {pagesScanned.length + 1} now.</span>}
            </p>

            {/* Camera Viewport */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#000000',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '1rem',
              border: '3px solid var(--rotc-green-dark)'
            }}>
              <div id="hq-batch-reader" style={{ width: '100%', height: '100%' }}></div>

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
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
                {cameraError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: isScanning ? '#059669' : '#dc2626' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isScanning ? '#059669' : '#dc2626' }}></span>
                {isScanning ? 'WEBCAM ACTIVE — HD 720p' : 'INITIALIZING CAMERA'}
              </span>
              <span>Offline Camera-to-Camera Transfer</span>
            </div>
          </>
        )}

        {showNextPagePrompt && lastChunkInfo && (
          /* "Scan Next Page" interstitial */
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ display: 'inline-flex', background: '#dbeafe', color: '#1e40af', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <CheckCircle2 size={40} />
            </div>

            <h3 style={{ fontFamily: 'Oswald, sans-serif', color: 'var(--rotc-green-dark)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              PAGE {lastChunkInfo.page} / {lastChunkInfo.total} SCANNED ✓
            </h3>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
              Collected <strong>{collectedRecords.length} records</strong> so far.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Ask the Duty Officer to swipe to <strong>Page {lastChunkInfo.page + 1}</strong> on their phone, then tap the button below.
            </p>

            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={handleScanNextPage}
            >
              <Camera size={18} />
              SCAN NEXT PAGE
            </button>
          </div>
        )}

        {importResult && (
          /* Final Import Result Screen */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ display: 'inline-flex', background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <CheckCircle2 size={48} />
            </div>

            <h3 style={{ fontFamily: 'Oswald, sans-serif', color: 'var(--rotc-green-dark)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
              BATCH IMPORT SUCCESSFUL!
            </h3>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-dark)', marginBottom: '1.25rem' }}>
              Successfully ingested <strong>{importResult.count} cadet records</strong> from <strong>{importResult.dutyOfficer}</strong>.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.8rem', textAlign: 'left', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Session:</span>
                <strong>{importResult.sessionName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <strong style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> Merged into Dashboard
                </strong>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>QR Pages Scanned:</span>
                  <strong>{totalPages} / {totalPages}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setImportResult(null);
                  setCollectedRecords([]);
                  setPagesScanned([]);
                  setTotalPages(null);
                  setLastChunkInfo(null);
                  setAwaitingNextPage(false);
                  setTimeout(() => startCameraScanner(), 100);
                }}
              >
                Scan Another Phone
              </button>
              <button
                className="btn btn-primary"
                onClick={onClose}
              >
                Done / View Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
