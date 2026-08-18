import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, Layers } from 'lucide-react';

export default function BatchScannerModal({ isOpen, onClose, onSyncComplete, cadets }) {
  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const pagesScannedRef = useRef([]);
  const collectedRecordsRef = useRef([]);
  const totalPagesRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Multi-chunk accumulation state for UI display
  const [collectedRecords, setCollectedRecords] = useState([]);
  const [pagesScanned, setPagesScanned] = useState([]); // page numbers already scanned [1, 2, ...]
  const [totalPages, setTotalPages] = useState(null);
  const [lastChunkInfo, setLastChunkInfo] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'warning' | 'info', text: string }

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

  const finalizeImport = (allRecords, dutyOfficer, sessionName) => {
    const cadetMap = new Map((cadets || []).map(c => [c.id, c]));

    const enrichedRecords = allRecords.map(rec => {
      const match = cadetMap.get(rec.cadetId);

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

    setImportResult({
      success: true,
      count: enrichedRecords.length,
      pagesScanned: pagesScannedRef.current.length,
      dutyOfficer: dutyOfficer || 'Duty Officer',
      sessionName: sessionName || 'Field Session'
    });
  };

  const handleBatchScanned = async (decodedText) => {
    // 1. Prevent duplicate concurrent reads while processing or cooling down
    if (isProcessingRef.current) return;

    try {
      let raw;
      try {
        raw = JSON.parse(decodedText);
      } catch (parseErr) {
        // Not a valid JSON payload - ignore quietly without stopping stream
        return;
      }

      // Expand minified keys
      const payload = expandPayload(raw);
      if (!payload || !payload.records || payload.records.length === 0) {
        return;
      }

      const pageNum = payload.page;
      const total = payload.totalPages;

      // Check if this chunk page was already scanned
      if (pagesScannedRef.current.includes(pageNum)) {
        // Brief pause to prevent rapid re-alerting
        isProcessingRef.current = true;
        setFeedbackMessage({
          type: 'warning',
          text: `Page ${pageNum} already scanned. Please show Page ${pagesScannedRef.current.length + 1} of ${total}.`
        });
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1200);
        return;
      }

      // Lock scanner processing
      isProcessingRef.current = true;
      setIsProcessing(true);

      playSuccessBeep();

      // Accumulate records & page numbers in refs and state
      const updatedPages = [...pagesScannedRef.current, pageNum];
      pagesScannedRef.current = updatedPages;
      setPagesScanned(updatedPages);

      const updatedRecords = [...collectedRecordsRef.current, ...payload.records];
      collectedRecordsRef.current = updatedRecords;
      setCollectedRecords(updatedRecords);

      totalPagesRef.current = total;
      setTotalPages(total);

      setLastChunkInfo({
        page: pageNum,
        total: total,
        count: payload.records.length,
        dutyOfficer: payload.dutyOfficer,
        sessionName: payload.sessionName
      });

      // Check if all pages have been scanned
      if (updatedPages.length >= total) {
        // All pages (e.g. 4/4) collected! Stop scanner and show final success modal
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (stopErr) {
            console.warn("Scanner stop error on finish:", stopErr);
          }
          setIsScanning(false);
        }

        finalizeImport(updatedRecords, payload.dutyOfficer, payload.sessionName);
      } else {
        // More pages remaining (e.g. 1/4 -> wait for 2/4).
        // Keep camera stream running continuously in the background!
        setFeedbackMessage({
          type: 'success',
          text: `✓ Page ${pageNum} of ${total} Scanned (+${payload.records.length} records)! Please swipe to Page ${pageNum + 1}.`
        });

        // 1200ms cooldown before accepting the next page to avoid accidental double-reads
        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessing(false);
        }, 1200);
      }
    } catch (err) {
      console.error("Batch QR Import Error:", err);
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const startCameraScanner = useCallback(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const el = document.getElementById('hq-batch-reader');
      if (!el) return;

      // Ensure any existing instance is cleaned up before instantiating new
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }

      let html5QrcodeScanner = new Html5Qrcode("hq-batch-reader");
      scannerRef.current = html5QrcodeScanner;

      const config = {
        fps: 15,
        qrbox: { width: 300, height: 300 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
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
        console.warn("HD user camera unavailable, trying environment camera:", err);
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

    // Reset all state & refs on modal open
    isProcessingRef.current = false;
    pagesScannedRef.current = [];
    collectedRecordsRef.current = [];
    totalPagesRef.current = null;

    setImportResult(null);
    setIsProcessing(false);
    setCameraError('');
    setCollectedRecords([]);
    setPagesScanned([]);
    setTotalPages(null);
    setLastChunkInfo(null);
    setFeedbackMessage(null);

    const timer = startCameraScanner();

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(e => console.warn("Error stopping HQ webcam scanner on unmount:", e));
          }
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
      } catch (_) {}
      scannerRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

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
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={22} />
          </button>
        </div>

        {/* Multi-Page Progress Bar & Indicator */}
        {totalPages && totalPages > 1 && !importResult && (
          <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={14} color="var(--rotc-green-dark)" /> Chunk Ingestion Progress
              </span>
              <span style={{ color: 'var(--rotc-green-dark)', fontWeight: 800 }}>
                {pagesScanned.length} / {totalPages} pages scanned ({collectedRecords.length} records)
              </span>
            </div>
            
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #059669, #10b981)',
                borderRadius: '4px',
                width: `${(pagesScanned.length / totalPages) * 100}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Chunk Page Badges */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                const isScanned = pagesScanned.includes(pg);
                return (
                  <span
                    key={pg}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: isScanned ? '#d1fae5' : '#f1f5f9',
                      color: isScanned ? '#065f46' : '#64748b',
                      border: isScanned ? '1px solid #10b981' : '1px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    {isScanned && <CheckCircle2 size={10} />}
                    Page {pg}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Camera Viewport (stays mounted during continuous multi-page scan) */}
        {!importResult && (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Hold up the <strong>Duty Officer's smartphone screen</strong> displaying the Summary Batch QR code in front of this webcam.
              {totalPages && totalPages > 1 && pagesScanned.length < totalPages && (
                <span style={{ color: '#059669', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                  Keep camera steady — swipe to Page {pagesScanned.length + 1} on phone now.
                </span>
              )}
            </p>

            {/* Camera Viewport */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#000000',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '0.75rem',
              border: isProcessing ? '3px solid #10b981' : '3px solid var(--rotc-green-dark)',
              transition: 'border-color 0.2s'
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

              {/* In-view feedback overlay banner */}
              {feedbackMessage && (
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  background: feedbackMessage.type === 'warning' ? 'rgba(217, 119, 6, 0.92)' : 'rgba(5, 150, 105, 0.92)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(4px)',
                  animation: 'fadeIn 0.2s ease-in'
                }}>
                  {feedbackMessage.text}
                </div>
              )}
            </div>

            {cameraError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
                {cameraError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: isScanning ? '#059669' : '#dc2626' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isScanning ? '#059669' : '#dc2626' }}></span>
                {isScanning ? (isProcessing ? 'PROCESSING CHUNK...' : 'WEBCAM ACTIVE — SCANNING CONTINUOUSLY') : 'INITIALIZING CAMERA'}
              </span>
              <span>HD 720p Transfer</span>
            </div>
          </>
        )}

        {/* Final Batch Sync Ingestion Complete Screen */}
        {importResult && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ display: 'inline-flex', background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <CheckCircle2 size={48} />
            </div>

            <h3 style={{ fontFamily: 'Oswald, sans-serif', color: 'var(--rotc-green-dark)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
              BATCH IMPORT SUCCESSFUL!
            </h3>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-dark)', marginBottom: '1.25rem' }}>
              Successfully ingested <strong>{importResult.count} cadet records</strong> across {importResult.pagesScanned} chunk pages from <strong>{importResult.dutyOfficer}</strong>.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.8rem', textAlign: 'left', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Session:</span>
                <strong>{importResult.sessionName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <strong style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> Merged into Master Dashboard
                </strong>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>QR Pages Scanned:</span>
                  <strong>{totalPages} / {totalPages} (100%)</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  isProcessingRef.current = false;
                  pagesScannedRef.current = [];
                  collectedRecordsRef.current = [];
                  totalPagesRef.current = null;
                  setImportResult(null);
                  setIsProcessing(false);
                  setCollectedRecords([]);
                  setPagesScanned([]);
                  setTotalPages(null);
                  setLastChunkInfo(null);
                  setFeedbackMessage(null);
                  setTimeout(() => startCameraScanner(), 100);
                }}
              >
                Scan Another Phone
              </button>
              <button
                className="btn btn-primary"
                onClick={handleClose}
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
