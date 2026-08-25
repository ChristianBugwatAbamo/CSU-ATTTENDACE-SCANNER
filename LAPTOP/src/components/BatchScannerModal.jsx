import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle2, AlertTriangle, ShieldCheck, Layers, Users, ArrowRight, Clock } from 'lucide-react';
import { evaluateSingleScan, getActiveFormationCutoff } from '../utils/attendanceStatus';

export default function BatchScannerModal({
  isOpen,
  onClose,
  cadets = [],
  attendanceLogs = [],
  pendingBatches = [],
  onBatchQueued,
  recentApprovedSignatures = new Set()
}) {
  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const pagesScannedRef = useRef([]);
  const collectedRecordsRef = useRef([]);
  const totalPagesRef = useRef(null);
  const activeBatchKeyRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isProcessingChunk, setIsProcessingChunk] = useState(false);

  // Multi-chunk accumulation state for UI display
  const [collectedRecords, setCollectedRecords] = useState([]);
  const [pagesScanned, setPagesScanned] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'warning' | 'info', text: string }

  // Audio beep for rapid scan detection
  const playQueueBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  };

  // Expand minified payload keys back to full names
  const expandPayload = (raw) => {
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
        records: (raw.r || []).map((rec) => ({
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

    if (raw.type === 'ROTC_BATCH_SYNC' || raw.records) {
      return {
        ...raw,
        dutyOfficer: raw.dutyOfficer || raw.d || 'Duty Officer',
        sessionName: raw.sessionName || raw.s || 'Field Session',
        page: raw.page || raw.p || 1,
        totalPages: raw.totalPages || raw.n || 1,
        records: (raw.records || raw.r || []).map((rec) => ({
          cadetId: rec.cadetId || rec.i || rec.id,
          name: rec.name || rec.n || '',
          battalion: rec.battalion || rec.bn || '1st Battalion',
          company: rec.company || rec.co || 'Alpha Company',
          platoon: rec.platoon || rec.pl || '1st Platoon',
          rank: rec.rank || rec.rk || 'Cadet',
          scanMode: rec.scanMode || (rec.m === 1 ? 'Time-In' : rec.m === 0 ? 'Time-Out' : 'Time-In'),
          timestamp: rec.timestamp || (rec.t ? new Date(rec.t * 1000).toISOString() : new Date().toISOString())
        }))
      };
    }

    // Support single compact Cadet ID QR Code (e.g. {"id":"221-00006","name":"SAMONTE","bat":1,"coy":1,"pl":2})
    if (raw.id && (raw.bat !== undefined || raw.coy !== undefined || raw.pl !== undefined || raw.name)) {
      const companyMap = { 1: 'Alpha Company', 2: 'Bravo Company', 3: 'Charlie Company', 4: 'Delta Company' };
      const bnNum = typeof raw.bat === 'number' ? raw.bat : parseInt(raw.bat, 10);
      const bn = bnNum === 2 ? '2nd Battalion' : '1st Battalion';
      const co = companyMap[raw.coy] || (typeof raw.coy === 'string' ? raw.coy : 'Alpha Company');
      const plNum = typeof raw.pl === 'number' ? raw.pl : parseInt(raw.pl, 10);
      const pl = plNum === 1 ? '1st Platoon' : plNum === 2 ? '2nd Platoon' : plNum === 3 ? '3rd Platoon' : plNum === 4 ? '4th Platoon' : '1st Platoon';

      return {
        type: 'ROTC_BATCH_SYNC',
        dutyOfficer: raw.dutyOfficer || raw.d || 'Duty Officer',
        sessionName: raw.sessionName || `${bn} - ${co} (${pl})`,
        battalion: bn,
        company: co,
        platoon: pl,
        page: 1,
        totalPages: 1,
        records: [{
          cadetId: raw.id,
          name: raw.name || '',
          battalion: bn,
          company: co,
          platoon: pl,
          rank: 'Cadet',
          scanMode: raw.scanMode || 'Time-In',
          timestamp: new Date().toISOString()
        }]
      };
    }

    return null;
  };

  // Match scanned records against registered Cadets Roster
  const enrichRecords = (records, dutyOfficer, sessionName) => {
    const cadetMap = new Map((cadets || []).map((c) => [c.id, c]));

    const seenBatchKeys = new Set();
    const uniqueRecords = records.filter((rec) => {
      const cid = String(rec.cadetId || '').trim().toUpperCase();
      if (!cid) return false;
      const mode = rec.scanMode || 'Time-In';
      const key = `${cid}__${mode}`;
      if (seenBatchKeys.has(key)) return false;
      seenBatchKeys.add(key);
      return true;
    });

    return uniqueRecords.map((rec) => {
      const match = cadetMap.get(rec.cadetId);

      const directName =
        rec.name && rec.name !== 'UNREGISTERED CADET' && rec.name.trim().length > 0
          ? rec.name.trim()
          : match?.name || (rec.cadetId ? `CADET ${rec.cadetId}` : 'CADET');

      const directBn =
        rec.battalion && rec.battalion !== 'N/A'
          ? rec.battalion
          : match?.battalion || '1st Battalion';

      const directCo =
        rec.company && rec.company !== 'N/A'
          ? rec.company
          : match?.company || 'Alpha Company';

      const directPl =
        rec.platoon && rec.platoon !== 'N/A'
          ? rec.platoon
          : match?.platoon || '1st Platoon';

      const directRank =
        rec.rank && rec.rank !== 'N/A'
          ? rec.rank
          : match?.rank || 'Cadet';

      const cutoffTime = getActiveFormationCutoff();
      const status = rec.scanMode === 'Time-Out' ? 'TIME-OUT' : evaluateSingleScan(rec, cutoffTime);

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
        status: status,
        receivedAt: new Date().toISOString()
      };
    });
  };

  // Generate deterministic batch signature
  const generateBatchSignature = (records, dutyOfficer, battalion, company, platoon) => {
    const sortedRecordKeys = (records || [])
      .map((r) => `${r.cadetId || r.i}_${r.scanMode || r.m}_${r.timestamp || r.t}`)
      .sort()
      .join('|');
    return `${dutyOfficer}__${battalion}__${company}__${platoon}__${sortedRecordKeys}`;
  };

  // Handle scanned batch payload from continuous camera stream
  const handleBatchScanned = async (decodedText) => {
    if (isProcessingRef.current) return;

    try {
      let raw;
      try {
        raw = JSON.parse(decodedText);
      } catch (_) {
        return;
      }

      const payload = expandPayload(raw);
      if (!payload || !payload.records || payload.records.length === 0) {
        return;
      }

      const pageNum = payload.page;
      const total = payload.totalPages;
      const echelonKey = `${payload.dutyOfficer}__${payload.battalion}__${payload.company}__${payload.platoon}`;

      // Reset accumulation if different officer/echelon is presented
      if (activeBatchKeyRef.current && activeBatchKeyRef.current !== echelonKey) {
        pagesScannedRef.current = [];
        collectedRecordsRef.current = [];
        totalPagesRef.current = null;
      }
      activeBatchKeyRef.current = echelonKey;

      if (pagesScannedRef.current.includes(pageNum)) {
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

      isProcessingRef.current = true;
      setIsProcessingChunk(true);

      const updatedPages = [...pagesScannedRef.current, pageNum];
      pagesScannedRef.current = updatedPages;
      setPagesScanned(updatedPages);

      const updatedRecords = [...collectedRecordsRef.current, ...payload.records];
      collectedRecordsRef.current = updatedRecords;
      setCollectedRecords(updatedRecords);

      totalPagesRef.current = total;
      setTotalPages(total);

      if (updatedPages.length >= total) {
        const enriched = enrichRecords(updatedRecords, payload.dutyOfficer, payload.sessionName);
        const signature = generateBatchSignature(
          enriched,
          payload.dutyOfficer,
          payload.battalion,
          payload.company,
          payload.platoon
        );

        // Duplicate Safeguard: Check if batch is already in pending queue
        const alreadyQueued = pendingBatches.some((b) => b.signature === signature);

        // Check if all records from this batch are already present in Master Attendance logs
        const alreadyInMasterLogs =
          enriched.length > 0 &&
          attendanceLogs.length > 0 &&
          enriched.every((rec) => {
            const scanDateStr = rec.timestamp ? new Date(rec.timestamp).toDateString() : new Date().toDateString();
            const cid = String(rec.cadetId || '').trim().toUpperCase();
            const mode = rec.scanMode || (String(rec.status || '').toUpperCase().includes('TIME-OUT') ? 'Time-Out' : 'Time-In');

            return attendanceLogs.some((l) => {
              const dStr = l.timestamp ? new Date(l.timestamp).toDateString() : (l.date ? new Date(l.date).toDateString() : '');
              const lCid = String(l.cadetId || '').trim().toUpperCase();
              if (lCid !== cid || dStr !== scanDateStr) return false;
              if (mode === 'Time-Out') {
                return !!(l.timeOut || (l.scanMode === 'Time-Out' && l.timestamp));
              } else {
                return !!(l.timeIn || (l.scanMode !== 'Time-Out' && l.timestamp));
              }
            });
          });

        const recentlyApproved = recentApprovedSignatures.has(signature) && (attendanceLogs.length > 0 && alreadyInMasterLogs);

        if (alreadyQueued || alreadyInMasterLogs || recentlyApproved) {
          setFeedbackMessage({
            type: 'warning',
            text: `Duplicate Batch: ${payload.dutyOfficer}'s batch is already ${alreadyQueued ? 'in queue' : 'ingested'}.`
          });

          pagesScannedRef.current = [];
          collectedRecordsRef.current = [];
          totalPagesRef.current = null;
          activeBatchKeyRef.current = null;
          setPagesScanned([]);
          setCollectedRecords([]);
          setTotalPages(null);

          setTimeout(() => {
            isProcessingRef.current = false;
            setIsProcessingChunk(false);
          }, 1800);
          return;
        }

        // New Batch: Push to Pending Queue
        const newBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newBatchItem = {
          id: newBatchId,
          signature: signature,
          records: enriched,
          rawRecords: updatedRecords,
          dutyOfficer: payload.dutyOfficer || 'Duty Officer',
          sessionName: payload.sessionName || 'Field Session',
          battalion: payload.battalion || enriched[0]?.battalion || '1st Battalion',
          company: payload.company || enriched[0]?.company || 'Alpha Company',
          platoon: payload.platoon || enriched[0]?.platoon || '1st Platoon',
          totalPages: total,
          pagesScanned: updatedPages.length,
          scannedAt: new Date().toISOString()
        };

        playQueueBeep();

        if (onBatchQueued) {
          onBatchQueued(newBatchItem);
        }

        setFeedbackMessage({
          type: 'success',
          text: `✓ Queued +${enriched.length} Cadets (${payload.dutyOfficer})! Camera ready for next phone.`
        });

        // Reset accumulation for next batch without stopping camera
        pagesScannedRef.current = [];
        collectedRecordsRef.current = [];
        totalPagesRef.current = null;
        activeBatchKeyRef.current = null;
        setPagesScanned([]);
        setCollectedRecords([]);
        setTotalPages(null);

        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessingChunk(false);
        }, 1200);
      } else {
        setFeedbackMessage({
          type: 'success',
          text: `✓ Page ${pageNum} of ${total} Scanned! Swipe to Page ${pageNum + 1} on phone.`
        });

        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessingChunk(false);
        }, 1200);
      }
    } catch (err) {
      console.error('Modal QR Scan Error:', err);
      isProcessingRef.current = false;
      setIsProcessingChunk(false);
    }
  };

  const startCameraScanner = useCallback(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const el = document.getElementById('modal-batch-reader');
      if (!el) return;

      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }

      let html5QrcodeScanner = new Html5Qrcode('modal-batch-reader');
      scannerRef.current = html5QrcodeScanner;

      const config = {
        fps: 15,
        qrbox: { width: 300, height: 300 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      };

      const hdConstraints = {
        facingMode: 'user',
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      };

      html5QrcodeScanner
        .start(
          hdConstraints,
          config,
          (decodedText) => handleBatchScanned(decodedText),
          () => {}
        )
        .then(() => {
          setIsScanning(true);
          setCameraError('');
        })
        .catch(() => {
          html5QrcodeScanner
            .start(
              { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
              config,
              (decodedText) => handleBatchScanned(decodedText),
              () => {}
            )
            .then(() => {
              setIsScanning(true);
              setCameraError('');
            })
            .catch(() => {
              html5QrcodeScanner
                .start(
                  { facingMode: 'user' },
                  { fps: 15, qrbox: { width: 280, height: 280 }, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] },
                  (decodedText) => handleBatchScanned(decodedText),
                  () => {}
                )
                .then(() => {
                  setIsScanning(true);
                  setCameraError('');
                })
                .catch(() => {
                  setCameraError('Webcam access required. Please allow camera permissions.');
                  setIsScanning(false);
                });
            });
        });
    }, 200);

    return timer;
  }, [isOpen, pendingBatches]);

  useEffect(() => {
    if (!isOpen) return;

    isProcessingRef.current = false;
    pagesScannedRef.current = [];
    collectedRecordsRef.current = [];
    totalPagesRef.current = null;
    activeBatchKeyRef.current = null;

    setCameraError('');
    setCollectedRecords([]);
    setPagesScanned([]);
    setTotalPages(null);
    setFeedbackMessage(null);

    const timer = startCameraScanner();

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            background: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '6px', borderRadius: '8px' }}>
              <Camera size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.15rem' }}>
                RAPID WEBCAM BATCH SCANNER
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Continuous background scanner • Auto-queues batches
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Instructions banner */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem'
            }}
          >
            <span style={{ color: 'var(--text-dark)' }}>
              Hold smartphone screen with Batch QR in front of camera.
            </span>
            <span
              style={{
                background: pendingBatches.length > 0 ? '#059669' : '#e2e8f0',
                color: pendingBatches.length > 0 ? '#ffffff' : '#64748b',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.75rem'
              }}
            >
              {pendingBatches.length} in queue
            </span>
          </div>

          {/* Multi-Chunk Progress Bar if active */}
          {totalPages && totalPages > 1 && (
            <div
              style={{
                marginBottom: '0.85rem',
                background: '#f8fafc',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={13} color="var(--rotc-green-dark)" /> Chunk Progress
                </span>
                <span style={{ color: 'var(--rotc-green-dark)', fontWeight: 800 }}>
                  {pagesScanned.length} / {totalPages} pages ({collectedRecords.length} records)
                </span>
              </div>

              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                <div
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #059669, #10b981)',
                    borderRadius: '3px',
                    width: `${(pagesScanned.length / totalPages) * 100}%`,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                  const isScanned = pagesScanned.includes(pg);
                  return (
                    <span
                      key={pg}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '8px',
                        background: isScanned ? '#d1fae5' : '#f1f5f9',
                        color: isScanned ? '#065f46' : '#64748b',
                        border: isScanned ? '1px solid #10b981' : '1px solid #cbd5e1'
                      }}
                    >
                      Page {pg}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Camera Viewport */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#0a0f0d',
              borderRadius: '12px',
              overflow: 'hidden',
              border: isProcessingChunk ? '3px solid #10b981' : '3px solid var(--rotc-green-dark)',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
              marginBottom: '0.75rem'
            }}
          >
            <div id="modal-batch-reader" style={{ width: '100%', height: '100%' }}></div>

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
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  right: '10px',
                  background:
                    feedbackMessage.type === 'warning'
                      ? 'rgba(217, 119, 6, 0.95)'
                      : 'rgba(5, 150, 105, 0.95)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(4px)',
                  animation: 'fadeIn 0.2s ease-in'
                }}
              >
                {feedbackMessage.text}
              </div>
            )}
          </div>

          {cameraError && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.75rem', textAlign: 'center' }}>
              {cameraError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: isScanning ? '#059669' : '#dc2626' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isScanning ? '#059669' : '#dc2626' }}></span>
              {isScanning ? (isProcessingChunk ? 'PROCESSING...' : 'CAMERA ACTIVE — SCANNING CONTINUOUSLY') : 'INITIALIZING...'}
            </span>
            <span>HD 720p Transfer</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--rotc-green-dark)', fontWeight: 700 }}>
            {pendingBatches.length > 0 ? (
              <span><strong>{pendingBatches.length}</strong> batch(es) queued for review</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Ready for batch scans</span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleClose}
            style={{
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Done Scanning / Review Batches</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
