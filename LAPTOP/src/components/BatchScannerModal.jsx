import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, Layers, Users, ArrowRight, Clock } from 'lucide-react';
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
  const lastScannedQrRef = useRef({ text: '', timestamp: 0 });
  const feedbackTimeoutRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isProcessingChunk, setIsProcessingChunk] = useState(false);

  // Multi-chunk accumulation state for UI display
  const [collectedRecords, setCollectedRecords] = useState([]);
  const [pagesScanned, setPagesScanned] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'warning' | 'error', text: string }

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
    } catch (_) { }
  };

  // Audio buzz for rejected/invalid scan
  const playErrorBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // Low A3
      osc.frequency.setValueAtTime(146.83, now + 0.12); // Lower D3

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (_) { }
  };

  // Strict Schema Validator for Official Offline Batch Sync QR Codes
  const validateBatchSyncPayload = (decodedText) => {
    let raw;
    try {
      raw = JSON.parse(decodedText);
    } catch (_) {
      // Non-JSON payload: test if it's an individual cadet ID string or external QR
      const trimmed = String(decodedText || '').trim();
      const isCadetIdString = /^\d{3}-\d{4,5}$/i.test(trimmed) || /^cadet/i.test(trimmed);
      return {
        isValid: false,
        reason: isCadetIdString ? 'individual_cadet' : 'external',
        message: isCadetIdString
          ? 'Scan Rejected: Individual Cadet ID QR detected. The Batch Scanner only accepts Official Offline Batch Sync QRs (T: RBS).'
          : 'Scan Rejected: External or invalid QR code. Only Official Offline Batch Sync QRs (T: RBS) are accepted.',
        raw: null
      };
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        isValid: false,
        reason: 'external',
        message: 'Scan Rejected: Unrecognized QR payload. Only Official Offline Batch Sync QRs (T: RBS) are accepted.',
        raw: null
      };
    }

    // Explicitly detect and reject individual Cadet ID QR formats
    if (
      raw.id !== undefined ||
      raw.cadetId !== undefined ||
      raw.cadet_id !== undefined ||
      raw.bat !== undefined ||
      raw.coy !== undefined ||
      raw.type === 'CADET_ID' ||
      raw.type === 'INDIVIDUAL_PASS'
    ) {
      return {
        isValid: false,
        reason: 'individual_cadet',
        message: 'Scan Rejected: Individual Cadet ID QR detected. The Batch Scanner only accepts Official Offline Batch Sync QRs (T: RBS).',
        raw: null
      };
    }

    // 1. Must contain key "T": "RBS"
    if (raw.T !== 'RBS') {
      return {
        isValid: false,
        reason: 'invalid_type',
        message: 'Scan Rejected: Invalid QR schema. Missing required key "T": "RBS".',
        raw: null
      };
    }

    // 2. Must contain all required batch metadata fields: (b, d, m, bn, co, pl, p, n, r)
    const missingFields = [];
    if (raw.b === undefined || raw.b === null || String(raw.b).trim() === '') missingFields.push('b');
    if (raw.d === undefined || raw.d === null || String(raw.d).trim() === '') missingFields.push('d');
    if (raw.m === undefined || raw.m === null || String(raw.m).trim() === '') missingFields.push('m');
    if (raw.bn === undefined || raw.bn === null || String(raw.bn).trim() === '') missingFields.push('bn');
    if (raw.co === undefined || raw.co === null || String(raw.co).trim() === '') missingFields.push('co');
    if (raw.pl === undefined || raw.pl === null || String(raw.pl).trim() === '') missingFields.push('pl');
    if (raw.p === undefined || raw.p === null || isNaN(Number(raw.p)) || Number(raw.p) < 1) missingFields.push('p');
    if (raw.n === undefined || raw.n === null || isNaN(Number(raw.n)) || Number(raw.n) < 1) missingFields.push('n');
    if (!Array.isArray(raw.r)) missingFields.push('r');

    if (missingFields.length > 0) {
      return {
        isValid: false,
        reason: 'missing_fields',
        message: `Scan Rejected: Incomplete Batch Sync schema. Missing required field(s): ${missingFields.join(', ')}.`,
        raw: null
      };
    }

    return {
      isValid: true,
      reason: null,
      message: null,
      raw: raw
    };
  };

  // Expand validated RBS payload to internal batch structure
  const expandPayload = (raw) => {
    if (!raw || raw.T !== 'RBS') return null;

    const bn = String(raw.bn).trim();
    const co = String(raw.co).trim();
    const pl = String(raw.pl).trim();
    const dutyOfficer = String(raw.d).trim();
    const sessionName = raw.s ? String(raw.s).trim() : `${bn} - ${co} (${pl})`;
    const rawMode = String(raw.m || '').toUpperCase();
    const resolvedScanMode = rawMode.includes('OUT') ? 'Time-Out' : 'Time-In';
    const batchId = String(raw.b).trim();
    const page = Math.floor(Number(raw.p));
    const totalPages = Math.floor(Number(raw.n));

    return {
      type: 'ROTC_BATCH_SYNC',
      batchId: batchId,
      dutyOfficer: dutyOfficer,
      sessionName: sessionName,
      battalion: bn,
      company: co,
      platoon: pl,
      scanMode: resolvedScanMode,
      mode: resolvedScanMode === 'Time-Out' ? 'TIME-OUT' : 'TIME-IN',
      page: page,
      totalPages: totalPages,
      records: raw.r.map((rec) => {
        if (typeof rec === 'string') {
          let cId = rec.trim();
          let parsedTime = null;
          if (cId.includes('@')) {
            const parts = cId.split('@');
            cId = parts[0].trim();
            const num = Number(parts[1]);
            if (!isNaN(num) && num > 0) {
              parsedTime = num > 1e11 ? new Date(num).toISOString() : new Date(num * 1000).toISOString();
            }
          }
          return {
            cadetId: cId,
            name: '',
            battalion: bn,
            company: co,
            platoon: pl,
            rank: 'Cadet',
            scanMode: resolvedScanMode,
            timestamp: parsedTime || new Date().toISOString()
          };
        }

        if (Array.isArray(rec)) {
          const cid = String(rec[0] || '').trim();
          let itemMode = resolvedScanMode;
          let itemTimestamp = null;

          if (rec.length === 2) {
            const tVal = rec[1];
            if (typeof tVal === 'number' && !isNaN(tVal) && tVal > 0) {
              itemTimestamp = tVal > 1e11 ? new Date(tVal).toISOString() : new Date(tVal * 1000).toISOString();
            } else if (typeof tVal === 'string' && tVal.trim()) {
              const num = Number(tVal);
              itemTimestamp = !isNaN(num) && num > 0
                ? (num > 1e11 ? new Date(num).toISOString() : new Date(num * 1000).toISOString())
                : tVal;
            }
          } else if (rec.length >= 3) {
            itemMode = rec[1] === 0 || String(rec[1]).toUpperCase().includes('OUT') ? 'Time-Out' : resolvedScanMode;
            const tVal = rec[2];
            if (typeof tVal === 'number' && !isNaN(tVal) && tVal > 0) {
              itemTimestamp = tVal > 1e11 ? new Date(tVal).toISOString() : new Date(tVal * 1000).toISOString();
            } else if (typeof tVal === 'string' && tVal.trim()) {
              const num = Number(tVal);
              itemTimestamp = !isNaN(num) && num > 0
                ? (num > 1e11 ? new Date(num).toISOString() : new Date(num * 1000).toISOString())
                : tVal;
            }
          }

          return {
            cadetId: cid,
            name: '',
            battalion: bn,
            company: co,
            platoon: pl,
            rank: 'Cadet',
            scanMode: itemMode,
            timestamp: itemTimestamp || new Date().toISOString()
          };
        }

        const itemMode = rec.m !== undefined ? (rec.m === 0 || String(rec.m).toUpperCase().includes('OUT') ? 'Time-Out' : 'Time-In') : resolvedScanMode;
        const rawT = rec.t !== undefined ? rec.t : rec.timestamp;
        let objTimestamp = null;
        if (typeof rawT === 'number' && !isNaN(rawT) && rawT > 0) {
          objTimestamp = rawT > 1e11 ? new Date(rawT).toISOString() : new Date(rawT * 1000).toISOString();
        } else if (typeof rawT === 'string' && rawT.trim()) {
          const num = Number(rawT);
          objTimestamp = !isNaN(num) && num > 0
            ? (num > 1e11 ? new Date(num).toISOString() : new Date(num * 1000).toISOString())
            : rawT;
        }

        return {
          cadetId: rec.i || rec.cadetId || rec.id,
          name: rec.n || rec.name || '',
          battalion: rec.bn || bn,
          company: rec.co || co,
          platoon: rec.pl || pl,
          rank: rec.rk || 'Cadet',
          scanMode: itemMode,
          timestamp: objTimestamp || new Date().toISOString()
        };
      })
    };
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

    // Cooldown buffer per identical QR payload to prevent rapid 30fps camera loop
    const now = Date.now();
    if (
      lastScannedQrRef.current.text === decodedText &&
      now - lastScannedQrRef.current.timestamp < 2500
    ) {
      return;
    }

    // 1. Strict Schema & Header Validation
    const validation = validateBatchSyncPayload(decodedText);
    if (!validation.isValid) {
      lastScannedQrRef.current = { text: decodedText, timestamp: now };
      playErrorBeep();

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setFeedbackMessage({
        type: 'error',
        text: validation.message
      });

      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackMessage((prev) => (prev?.type === 'error' ? null : prev));
      }, 4000);
      return;
    }

    try {
      const payload = expandPayload(validation.raw);
      if (!payload || !payload.records || payload.records.length === 0) {
        lastScannedQrRef.current = { text: decodedText, timestamp: now };
        playErrorBeep();

        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        setFeedbackMessage({
          type: 'error',
          text: 'Scan Rejected: Batch contains 0 attendance records.'
        });

        feedbackTimeoutRef.current = setTimeout(() => {
          setFeedbackMessage((prev) => (prev?.type === 'error' ? null : prev));
        }, 4000);
        return;
      }

      const pageNum = payload.page;
      const total = payload.totalPages;
      const echelonKey = `${payload.dutyOfficer}__${payload.battalion}__${payload.company}__${payload.platoon}`;
      const batchId = payload.batchId;
      const batchAccumulatorKey = `${echelonKey}__${batchId}`;

      // Reset accumulation if different officer/echelon OR different batch session is presented
      if (activeBatchKeyRef.current && activeBatchKeyRef.current !== batchAccumulatorKey) {
        pagesScannedRef.current = [];
        collectedRecordsRef.current = [];
        totalPagesRef.current = null;
      }
      activeBatchKeyRef.current = batchAccumulatorKey;

      // If total page count changed, reset immediately to prevent stale page merge
      if (totalPagesRef.current !== null && totalPagesRef.current !== total) {
        pagesScannedRef.current = [];
        collectedRecordsRef.current = [];
        totalPagesRef.current = null;
      }

      // If Page 1 is scanned again after previously scanning other pages, treat as intentional batch restart
      if (pageNum === 1 && pagesScannedRef.current.includes(1) && pagesScannedRef.current.length > 1) {
        pagesScannedRef.current = [];
        collectedRecordsRef.current = [];
        totalPagesRef.current = null;
      }

      if (pagesScannedRef.current.includes(pageNum)) {
        isProcessingRef.current = true;
        setFeedbackMessage({
          type: 'warning',
          text: `Page ${pageNum} already scanned. Please show Page ${pagesScannedRef.current.length + 1} of ${total}.`
        });
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1000);
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
        // Record timestamp for 3-second cooldown buffer
        lastScannedQrRef.current = { text: decodedText, timestamp: Date.now() };

        const enriched = enrichRecords(updatedRecords, payload.dutyOfficer, payload.sessionName);
        const signature = generateBatchSignature(
          enriched,
          payload.dutyOfficer,
          payload.battalion,
          payload.company,
          payload.platoon
        );

        // New Batch: Push to Pending Queue smoothly (allows multiple separate batches per duty officer)
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
          mode: payload.mode || (payload.scanMode === 'Time-Out' ? 'TIME-OUT' : 'TIME-IN'),
          scanMode: payload.scanMode || 'Time-In',
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
            scannerRef.current.stop().catch(() => { });
          }
          scannerRef.current.clear();
        } catch (_) { }
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
          () => { }
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
              () => { }
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
                  () => { }
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
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => { });
          }
          scannerRef.current.clear();
        } catch (_) { }
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => { });
        }
        scannerRef.current.clear();
      } catch (_) { }
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

          {/* Prominent Error Toast Bar */}
          {feedbackMessage && feedbackMessage.type === 'error' && (
            <div
              style={{
                marginBottom: '0.75rem',
                background: '#fef2f2',
                border: '1.5px solid #ef4444',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)',
                animation: 'fadeIn 0.2s ease-in'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, color: '#dc2626' }} />
              <span style={{ flex: 1, lineHeight: 1.4 }}>{feedbackMessage.text}</span>
              <button
                type="button"
                onClick={() => setFeedbackMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', padding: '2px' }}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
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
              border:
                feedbackMessage?.type === 'error'
                  ? '3px solid #ef4444'
                  : isProcessingChunk
                  ? '3px solid #10b981'
                  : '3px solid var(--rotc-green-dark)',
              boxShadow:
                feedbackMessage?.type === 'error'
                  ? '0 0 16px rgba(239, 68, 68, 0.4), inset 0 2px 8px rgba(0,0,0,0.6)'
                  : 'inset 0 2px 8px rgba(0,0,0,0.6)',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
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
                    feedbackMessage.type === 'error'
                      ? 'rgba(220, 38, 38, 0.96)'
                      : feedbackMessage.type === 'warning'
                      ? 'rgba(217, 119, 6, 0.95)'
                      : 'rgba(5, 150, 105, 0.95)',
                  color: '#ffffff',
                  padding: '9px 13px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(4px)',
                  animation: 'fadeIn 0.2s ease-in',
                  zIndex: 20
                }}
              >
                {feedbackMessage.type === 'error' && <AlertCircle size={16} style={{ flexShrink: 0 }} />}
                {feedbackMessage.type === 'warning' && <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
                {feedbackMessage.type === 'success' && <CheckCircle2 size={16} style={{ flexShrink: 0 }} />}
                <span>{feedbackMessage.text}</span>
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
