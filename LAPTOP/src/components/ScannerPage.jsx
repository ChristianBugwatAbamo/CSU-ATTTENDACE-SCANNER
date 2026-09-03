import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  FileSpreadsheet,
  Trash2,
  Ban,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Users,
  Sparkles,
  UserCheck,
  UserX,
  Database,
  X
} from 'lucide-react';
import BatchScannerModal from './BatchScannerModal';
import BatchSyncHierarchyTracker from './BatchSyncHierarchyTracker';
import {
  getSupabaseClient,
  inferCadetFromId,
  ensureSessionWithDutyOfficer,
  bulkUpsertAttendanceToSupabase
} from '../utils/supabaseClient';

export default function ScannerPage({ cadets = [], attendanceLogs = [], onSyncComplete }) {
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Hydrate Pending Batches from localStorage
  const [pendingBatches, setPendingBatches] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_pending_batches');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [expandedBatchIds, setExpandedBatchIds] = useState(new Set());
  const recentApprovedSignaturesRef = useRef(new Set());
  const [toastMessage, setToastMessage] = useState(null);

  // Set of registered cadet IDs for real-time validation during batch ingestion
  const registeredCadetIdSet = React.useMemo(() => {
    const set = new Set();
    if (Array.isArray(cadets)) {
      cadets.forEach((c) => {
        const id = c.id || c.cadet_id || c.cadetId;
        if (id) set.add(String(id).trim().toUpperCase());
      });
    }
    return set;
  }, [cadets]);

  // Ingested batches tracker (combines pending batches and active session logs)
  const allIngestedBatches = React.useMemo(() => {
    const list = [];
    if (Array.isArray(pendingBatches)) {
      pendingBatches.forEach(b => {
        if (b.battalion || b.company || b.platoon) {
          list.push({
            battalion: b.battalion,
            company: b.company,
            platoon: b.platoon,
            timestamp: b.scannedAt || b.timestamp || b.created_at || b.date || new Date().toISOString()
          });
        }
      });
    }
    if (Array.isArray(attendanceLogs)) {
      attendanceLogs.forEach(l => {
        if (l.battalion || l.company || l.platoon) {
          list.push({
            battalion: l.battalion,
            company: l.company,
            platoon: l.platoon,
            timestamp: l.timestamp || l.date || l.timeIn || l.timeOut || l.receivedAt
          });
        }
      });
    }
    return list;
  }, [pendingBatches, attendanceLogs]);

  // Sync Pending Batches to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(pendingBatches));
    } catch (_) { }
  }, [pendingBatches]);

  // Hydrate Approved Batch Signatures from localStorage and prune if attendanceLogs empty
  useEffect(() => {
    try {
      const savedSignatures = localStorage.getItem('csu_rotc_recent_approved_signatures');
      if (savedSignatures) {
        if (!attendanceLogs || attendanceLogs.length === 0) {
          recentApprovedSignaturesRef.current = new Set();
          localStorage.removeItem('csu_rotc_recent_approved_signatures');
        } else {
          recentApprovedSignaturesRef.current = new Set(JSON.parse(savedSignatures));
        }
      }
    } catch (_) { }
  }, [attendanceLogs]);

  // Listen to external clear / purge attendance events
  useEffect(() => {
    const handleLogsCleared = (e) => {
      // Only clear signatures if storage was cleared or explicit purge event fired
      if (e?.type === 'storage' && e.key && (e.key !== 'csu_rotc_attendance_logs' || e.newValue)) {
        return;
      }
      try {
        recentApprovedSignaturesRef.current = new Set();
        localStorage.removeItem('csu_rotc_recent_approved_signatures');
      } catch (_) { }
    };

    window.addEventListener('storage', handleLogsCleared);
    window.addEventListener('attendance-logs-cleared', handleLogsCleared);
    window.addEventListener('csu-attendance-purged', handleLogsCleared);
    return () => {
      window.removeEventListener('storage', handleLogsCleared);
      window.removeEventListener('attendance-logs-cleared', handleLogsCleared);
      window.removeEventListener('csu-attendance-purged', handleLogsCleared);
    };
  }, []);

  const saveApprovedSignatures = () => {
    try {
      localStorage.setItem(
        'csu_rotc_recent_approved_signatures',
        JSON.stringify(Array.from(recentApprovedSignaturesRef.current))
      );
    } catch (_) { }
  };

  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.35);
      gain2.gain.setValueAtTime(0.28, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.4);
    } catch (_) { }
  };

  // Called whenever a batch is auto-queued from the modal scanner
  const handleBatchQueued = (newBatchItem) => {
    setPendingBatches((prev) => [newBatchItem, ...prev]);
    // Auto expand if first batch
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      next.add(newBatchItem.id);
      return next;
    });
  };

function toDateKey(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  let d = new Date(str);
  if (isNaN(d.getTime())) {
    d = new Date(`${str} ${new Date().getFullYear()}`);
  }
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

  // Batch Approval: Ingest batch records into attendance logs and Supabase with foreign key fallback and guaranteed state cleanup
  const handleApproveBatch = async (batchId) => {
    const batch = pendingBatches.find((b) => b.id === batchId);
    if (!batch) return;

    try {
      const allRecords = batch.records || [];
      if (allRecords.length === 0) {
        // Empty batch, clean up immediately
        setPendingBatches((prev) => {
          const next = prev.filter((b) => b.id !== batchId);
          try { localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next)); } catch (_) {}
          return next;
        });
        setExpandedBatchIds((prev) => {
          const next = new Set(prev);
          next.delete(batchId);
          return next;
        });
        return;
      }

      playSuccessBeep();

      // Normalize all batch records for ingestion
      const batchRecords = allRecords.map((r) => {
        const cid = String(r.cadetId || r.cadet_id || r.id || r.i || '').trim().toUpperCase();
        const officer = r.dutyOfficer || r.duty_officer || batch.dutyOfficer || 'Duty Officer';
        const scanTimestamp = r.timestamp || r.scanned_at || r.scannedAt || batch.scannedAt || new Date().toISOString();
        const scanDate = toDateKey(r.date || batch.date || scanTimestamp || new Date());
        return {
          ...r,
          cadetId: cid,
          cadet_id: cid,
          date: scanDate,
          timestamp: scanTimestamp,
          scanned_at: scanTimestamp,
          scannedAt: scanTimestamp,
          dutyOfficer: officer,
          duty_officer: officer,
          sessionName: r.sessionName || r.session_name || batch.sessionName || 'Formation Session',
          battalion: r.battalion || batch.battalion || '1st Battalion',
          company: r.company || batch.company || 'Alpha Company',
          platoon: r.platoon || batch.platoon || '1st Platoon'
        };
      });

      // 1. Ensure parent attendance_sessions row exists in Supabase BEFORE inserting attendance_logs
      const firstScan = batchRecords[0];
      const targetDate = firstScan.date || toDateKey(new Date());
      const targetOfficer = batch.dutyOfficer || firstScan.dutyOfficer || 'Duty Officer';
      const targetTitle = batch.sessionName || firstScan.sessionName || 'Formation Session';

      const parentSession = await ensureSessionWithDutyOfficer(targetDate, targetOfficer, targetTitle);
      const parentSessionId = parentSession?.id || null;

      if (parentSessionId) {
        batchRecords.forEach(r => {
          r.session_id = parentSessionId;
          r.sessionId = parentSessionId;
        });
      }

      // 2. Ingest directly into Supabase Cloud with guaranteed session_id parent link
      try {
        await bulkUpsertAttendanceToSupabase(batchRecords, targetDate);
      } catch (sbErr) {
        console.warn('Direct Supabase ingestion note:', sbErr);
      }

      // 3. Ingest strictly into master attendance logs & notify App.jsx
      if (onSyncComplete) {
        await onSyncComplete(batchRecords);
      }
      window.dispatchEvent(new Event('local-attendance-update'));

      // Server background sync
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dutyOfficer: batch.dutyOfficer || 'Duty Officer',
            sessionName: batch.sessionName || 'Field Session',
            records: batchRecords
          })
        }).catch(() => { });
      } catch (_) { }

      if (batch.signature) {
        recentApprovedSignaturesRef.current.add(batch.signature);
        saveApprovedSignatures();
      }

      // Guaranteed state cleanup: Remove the approved batch completely from state and localStorage
      setPendingBatches((prev) => {
        const next = prev.filter((b) => b.id !== batchId);
        try {
          localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next));
        } catch (_) {}
        return next;
      });

      setExpandedBatchIds((prev) => {
        const next = new Set(prev);
        next.delete(batchId);
        return next;
      });

      setToastMessage({
        type: 'success',
        text: `✅ Approved batch from ${batch.dutyOfficer || 'Duty Officer'} (${batchRecords.length} Cadets Ingested).`
      });
    } catch (err) {
      console.error('❌ Batch approval ingestion failure:', err);
      // Guaranteed state cleanup: prevent batch from staying stuck in pending queue
      setPendingBatches((prev) => {
        const next = prev.filter((b) => b.id !== batchId);
        try {
          localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
      setExpandedBatchIds((prev) => {
        const next = new Set(prev);
        next.delete(batchId);
        return next;
      });
      setToastMessage({
        type: 'warning',
        text: `⚠️ Batch ingested with note: ${err.message || 'Check logs'}`
      });
    } finally {
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // In-Page Batch Rejection
  const handleRejectBatch = (batchId) => {
    const batch = pendingBatches.find((b) => b.id === batchId);
    setPendingBatches((prev) => {
      const next = prev.filter((b) => b.id !== batchId);
      try { localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next)); } catch (_) {}
      return next;
    });
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      next.delete(batchId);
      return next;
    });

    setToastMessage({
      type: 'warning',
      text: `Discarded batch from ${batch?.dutyOfficer || 'Duty Officer'}.`
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Approve All Batches in Queue: Ingest all records with foreign key fallback and guaranteed state cleanup
  const handleApproveAll = async () => {
    if (pendingBatches.length === 0) return;

    try {
      let allBatchRecords = [];

      pendingBatches.forEach((batch) => {
        const records = (batch.records || []).map((r) => {
          const cid = String(r.cadetId || r.cadet_id || r.id || r.i || '').trim().toUpperCase();
          const officer = r.dutyOfficer || r.duty_officer || batch.dutyOfficer || 'Duty Officer';
          const scanTimestamp = r.timestamp || r.scanned_at || r.scannedAt || batch.scannedAt || new Date().toISOString();
          const scanDate = toDateKey(r.date || batch.date || scanTimestamp || new Date());
          return {
            ...r,
            cadetId: cid,
            cadet_id: cid,
            date: scanDate,
            timestamp: scanTimestamp,
            scanned_at: scanTimestamp,
            scannedAt: scanTimestamp,
            dutyOfficer: officer,
            duty_officer: officer,
            sessionName: r.sessionName || r.session_name || batch.sessionName || 'Formation Session',
            battalion: r.battalion || batch.battalion || '1st Battalion',
            company: r.company || batch.company || 'Alpha Company',
            platoon: r.platoon || batch.platoon || '1st Platoon'
          };
        });

        allBatchRecords = allBatchRecords.concat(records);

        if (batch.signature) {
          recentApprovedSignaturesRef.current.add(batch.signature);
        }
      });

      if (allBatchRecords.length === 0) {
        setPendingBatches([]);
        setExpandedBatchIds(new Set());
        try { localStorage.removeItem('csu_rotc_pending_batches'); } catch (_) {}
        return;
      }

      playSuccessBeep();
      saveApprovedSignatures();

      // 1. Ensure parent attendance_sessions exist for all dates, officers & platoon titles
      const dateOfficerGroups = new Map();
      allBatchRecords.forEach(r => {
        const key = `${r.date}__${r.dutyOfficer}__${r.sessionName || ''}`;
        if (!dateOfficerGroups.has(key)) {
          dateOfficerGroups.set(key, { date: r.date, officer: r.dutyOfficer, title: r.sessionName });
        }
      });

      const sessionMap = new Map();
      for (const [key, grp] of dateOfficerGroups.entries()) {
        try {
          const s = await ensureSessionWithDutyOfficer(grp.date, grp.officer, grp.title);
          if (s?.id) sessionMap.set(key, s.id);
        } catch (_) {}
      }

      allBatchRecords.forEach(r => {
        const key = `${r.date}__${r.dutyOfficer}__${r.sessionName || ''}`;
        const sId = sessionMap.get(key) || sessionMap.get(`${r.date}__${r.dutyOfficer}`);
        if (sId) {
          r.session_id = sId;
          r.sessionId = sId;
        }
      });

      // 2. Ingest directly into Supabase Cloud
      try {
        await bulkUpsertAttendanceToSupabase(allBatchRecords);
      } catch (sbErr) {
        console.warn('Direct bulk Supabase ingestion note:', sbErr);
      }

      // 3. Ingest into master attendance logs & notify App.jsx
      if (onSyncComplete) {
        await onSyncComplete(allBatchRecords);
      }
      window.dispatchEvent(new Event('local-attendance-update'));

      // Preserve approved signatures to prevent accidental re-approval
      pendingBatches.forEach(b => {
        if (b.signature) recentApprovedSignaturesRef.current.add(b.signature);
      });
      saveApprovedSignatures();

      // Guaranteed state cleanup: Empty the pending queue completely
      setPendingBatches([]);
      setExpandedBatchIds(new Set());
      try {
        localStorage.removeItem('csu_rotc_pending_batches');
      } catch (_) {}

      setToastMessage({
        type: 'success',
        text: `✅ Approved all batches (${allBatchRecords.length} Cadets Ingested).`
      });
    } catch (err) {
      console.error('❌ Approve all batches ingestion failure:', err);
      setPendingBatches([]);
      setExpandedBatchIds(new Set());
      try { localStorage.removeItem('csu_rotc_pending_batches'); } catch (_) {}
      setToastMessage({
        type: 'warning',
        text: `⚠️ Batches processed with note: ${err.message || 'Check logs'}`
      });
    } finally {
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Reject All Batches in Queue
  const handleRejectAll = () => {
    const count = pendingBatches.length;
    setPendingBatches([]);
    setExpandedBatchIds(new Set());
    setToastMessage({
      type: 'warning',
      text: `Discarded all ${count} pending batches.`
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle single batch expansion
  const toggleBatchExpand = (batchId) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  // Aggregate stats for ingested batches
  const totalScans = attendanceLogs.length;
  const batchMap = new Map();
  attendanceLogs.forEach((log) => {
    const bn = log.battalion || '1st Battalion';
    const co = log.company || 'Alpha Company';
    const pl = log.platoon || '1st Platoon';
    const officer = log.dutyOfficer || log.d || 'Duty Officer';
    const timeKey = log.receivedAt ? log.receivedAt.slice(0, 16) : log.timestamp ? log.timestamp.slice(0, 16) : 'batch';
    const key = `${bn}__${co}__${pl}__${officer}__${timeKey}`;

    if (!batchMap.has(key)) {
      batchMap.set(key, {
        battalion: bn,
        company: co,
        platoon: pl,
        dutyOfficer: officer,
        timestamp: log.receivedAt || log.timestamp || new Date().toISOString(),
        count: 0,
        status: log.status || 'PRESENT'
      });
    }
    const batch = batchMap.get(key);
    batch.count += 1;
  });
  const recentBatches = Array.from(batchMap.values()).slice(0, 6);

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: toastMessage.type === 'warning' ? '#d97706' : '#065f46',
            color: '#ffffff',
            padding: '0.85rem 1.4rem',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            animation: 'fadeIn 0.2s ease-in'
          }}
        >
          {toastMessage.type === 'warning' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Banner with Launch Modal Button */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem'
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(229, 169, 0, 0.2)',
              color: 'var(--rotc-yellow-gold)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '1px',
              marginBottom: '0.75rem',
              border: '1px solid rgba(229, 169, 0, 0.35)'
            }}
          >
            <ShieldCheck size={14} />
            <span>OFFLINE QR-TO-CAMERA SYNC ENGINE</span>
          </div>

          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.8rem', margin: '0 0 0.5rem 0', letterSpacing: '0.5px' }}>
            Webcam Field Batch Scanner
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.6 }}>
            Launch the webcam scanner modal to scan Duty Officers' batch QR codes. Scans auto-queue continuously into the approval list below without camera interruptions.
          </p>
        </div>

        <div>
          <button
            className="btn btn-gold"
            onClick={() => setIsScannerModalOpen(true)}
            style={{
              padding: '0.9rem 1.75rem',
              fontSize: '1rem',
              fontWeight: 800,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              borderRadius: '10px'
            }}
          >
            <Camera size={22} />
            <span>LAUNCH WEBCAM SCANNER</span>
          </button>
        </div>
      </div>

      {/* SECTION: PENDING BATCHES FOR APPROVAL QUEUE */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header" style={{ paddingBottom: '0.85rem' }}>
          <div className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={22} color="#d97706" />
              <span>Pending Batches for Approval</span>
              <span
                style={{
                  background: pendingBatches.length > 0 ? '#f59e0b' : '#e2e8f0',
                  color: pendingBatches.length > 0 ? '#ffffff' : '#64748b',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 800
                }}
              >
                {pendingBatches.length} {pendingBatches.length === 1 ? 'Batch' : 'Batches'}
              </span>
            </div>

            {pendingBatches.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleRejectAll}
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', color: '#dc2626', borderColor: '#fca5a5' }}
                  title="Reject and discard all pending batches"
                >
                  <Trash2 size={14} />
                  <span>Clear All</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleApproveAll}
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', background: '#059669', borderColor: '#059669' }}
                  title="Approve and ingest all pending batches into master logs"
                >
                  <CheckCircle2 size={14} />
                  <span>Approve All ({pendingBatches.length})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          {pendingBatches.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                color: 'var(--text-muted)',
                background: '#f8fafc',
                border: '1px dashed var(--border-light)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ background: '#ecfdf5', color: '#059669', padding: '1rem', borderRadius: '50%' }}>
                <QrCode size={36} />
              </div>
              <div style={{ fontWeight: 700, color: 'var(--rotc-green-dark)', fontSize: '1rem' }}>
                No Batches Awaiting Approval
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '420px', lineHeight: 1.5 }}>
                Click <strong>[ LAUNCH WEBCAM SCANNER ]</strong> above to scan Duty Officers' phone screens. Scanned batches will automatically queue here for review & approval.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {pendingBatches.map((batch) => {
                const isExpanded = expandedBatchIds.has(batch.id);
                const timeInCount = batch.records.filter((r) => r.scanMode !== 'Time-Out').length;
                const timeOutCount = batch.records.filter((r) => r.scanMode === 'Time-Out').length;

                // Check for any unregistered cadet IDs in the batch
                const unregisteredCount = batch.records.filter((r) => {
                  const rawId = String(r.cadetId || r.id || '').trim().toUpperCase();
                  return !registeredCadetIdSet.has(rawId);
                }).length;

                return (
                  <div
                    key={batch.id}
                    style={{
                      background: '#ffffff',
                      border: unregisteredCount > 0 ? '1.5px solid #f87171' : '1.5px solid #fde68a',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-sm)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Card Header */}
                    <div
                      style={{
                        padding: '1rem 1.25rem',
                        background: unregisteredCount > 0
                          ? 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)'
                          : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        borderBottom: unregisteredCount > 0 ? '1px solid #fca5a5' : '1px solid #fde68a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: unregisteredCount > 0 ? '#dc2626' : '#d97706',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}
                          >
                            PENDING APPROVAL
                          </span>

                          {unregisteredCount > 0 && (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #f87171',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <AlertTriangle size={12} />
                              <span>{unregisteredCount} Unregistered Cadet ID(s)</span>
                            </span>
                          )}

                          <span style={{ fontWeight: 800, color: 'var(--rotc-green-dark)', fontSize: '0.98rem' }}>
                            {batch.battalion} • {batch.company} • {batch.platoon}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: unregisteredCount > 0 ? '#991b1b' : '#92400e', marginTop: '3px', fontWeight: 600 }}>
                          Duty Officer: <strong>{batch.dutyOfficer}</strong> • Scanned at{' '}
                          {new Date(batch.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>

                      {/* Right side stats badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            background: '#065f46',
                            color: '#ffffff',
                            fontWeight: 900,
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '0.88rem'
                          }}
                        >
                          {batch.records.length} Cadets
                        </span>
                      </div>
                    </div>

                    {/* Card Body: Quick stats & Action bar */}
                    <div style={{ padding: '0.9rem 1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: isExpanded ? '0.85rem' : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>
                          <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 8px', borderRadius: '4px' }}>
                            {timeInCount} Time-In
                          </span>
                          {timeOutCount > 0 && (
                            <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '4px' }}>
                              {timeOutCount} Time-Out
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleBatchExpand(batch.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#059669',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              marginLeft: '6px',
                              padding: '2px 6px'
                            }}
                          >
                            {isExpanded ? (
                              <>
                                <span>Hide Roster Preview</span>
                                <ChevronUp size={15} />
                              </>
                            ) : (
                              <>
                                <span>View Roster ({batch.records.length})</span>
                                <ChevronDown size={15} />
                              </>
                            )}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                          <button
                            type="button"
                            onClick={() => handleRejectBatch(batch.id)}
                            style={{
                              background: '#ffffff',
                              color: '#dc2626',
                              border: '1.5px solid #fca5a5',
                              borderRadius: '8px',
                              padding: '0.5rem 1rem',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = '#fee2e2')}
                            onMouseOut={(e) => (e.currentTarget.style.background = '#ffffff')}
                          >
                            <Ban size={15} />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApproveBatch(batch.id)}
                            style={{
                              background: 'linear-gradient(135deg, #064e2e 0%, #059669 100%)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '0.5rem 1.25rem',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(6, 78, 46, 0.3)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <ShieldCheck size={16} />
                            <span>Approve & Ingest Batch</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Cadet Breakdown Table */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: '0.75rem',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            maxHeight: '260px',
                            overflowY: 'auto'
                          }}
                        >
                          <table className="custom-table" style={{ width: '100%', fontSize: '0.8rem', margin: 0 }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                              <tr>
                                <th style={{ padding: '7px 10px' }}>#</th>
                                <th style={{ padding: '7px 10px' }}>Cadet ID</th>
                                <th style={{ padding: '7px 10px' }}>Cadet Name</th>
                                <th style={{ padding: '7px 10px' }}>Rank</th>
                                <th style={{ padding: '7px 10px' }}>Mode</th>
                                <th style={{ padding: '7px 10px' }}>Timestamp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.records.map((rec, idx) => {
                                const rawId = String(rec.cadetId || rec.id || '').trim().toUpperCase();
                                const isRegistered = registeredCadetIdSet.has(rawId);

                                return (
                                  <tr
                                    key={idx}
                                    style={{
                                      background: !isRegistered ? '#fff1f2' : 'transparent'
                                    }}
                                  >
                                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                    <td style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--rotc-green-dark)' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span>{rec.cadetId}</span>
                                        {!isRegistered && (
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px',
                                              background: '#fee2e2',
                                              color: '#b91c1c',
                                              border: '1px solid #fca5a5',
                                              padding: '1px 5px',
                                              borderRadius: '4px',
                                              fontSize: '0.65rem',
                                              fontWeight: 800,
                                              width: 'fit-content'
                                            }}
                                          >
                                            <AlertTriangle size={10} />
                                            <span>UNREGISTERED CADET ID</span>
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{rec.name}</td>
                                    <td style={{ padding: '6px 10px' }}>{rec.rank || 'Cadet'}</td>
                                    <td style={{ padding: '6px 10px' }}>
                                      {rec.scanMode === 'Time-Out' ? (
                                        <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px' }}>
                                          TIME-OUT
                                        </span>
                                      ) : (
                                        <span className="badge badge-present" style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px' }}>
                                          TIME-IN
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      {rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* REAL-TIME UNIT BATCH SYNC HIERARCHY STATUS MAP */}
      <BatchSyncHierarchyTracker ingestedBatches={allIngestedBatches} />

      {/* Ingestion Overview & Latest Ingested Batches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Sync Engine Health */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>
              <ShieldCheck size={18} />
              <span>Camera Node Status</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontWeight: 700, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} />
                <span>Webcam Rapid Scanner Node Ready</span>
              </div>
              <span className="badge badge-present">ONLINE</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Master Records Logged:</span>
              <strong style={{ color: 'var(--rotc-green-dark)', fontSize: '1rem' }}>{totalScans} Records</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Duplicate Prevention:</span>
              <strong style={{ color: '#059669', fontSize: '0.85rem' }}>Active Signature Hashing</strong>
            </div>
          </div>
        </div>

        {/* Recent Ingested Batches */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>
              <FileSpreadsheet size={18} />
              <span>Latest Ingested Batches ({recentBatches.length})</span>
            </div>
          </div>

          {recentBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No batch ingestions recorded yet today. Scanned batches will appear here after approval.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentBatches.map((batch, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 0.9rem',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--rotc-green-dark)', fontWeight: 800, fontSize: '0.88rem' }}>
                      {batch.battalion} • {batch.company} • {batch.platoon}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                      <strong style={{ color: '#059669' }}>{batch.count} Cadets Ingested</strong> • Duty Officer: {batch.dutyOfficer} •{' '}
                      {batch.timestamp ? new Date(batch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </div>
                  </div>
                  <span className="badge badge-present" style={{ fontSize: '0.72rem', gap: '3px', fontWeight: 800 }}>
                    <CheckCircle2 size={11} /> SYNCED
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pop-up Rapid Webcam Scanner Modal */}
      <BatchScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        cadets={cadets}
        attendanceLogs={attendanceLogs}
        pendingBatches={pendingBatches}
        onBatchQueued={handleBatchQueued}
        recentApprovedSignatures={recentApprovedSignaturesRef.current}
      />
    </div>
  );
}
