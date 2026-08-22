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
  Users,
  Sparkles
} from 'lucide-react';
import BatchScannerModal from './BatchScannerModal';

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

  // Sync Pending Batches to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(pendingBatches));
    } catch (_) {}
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
    } catch (_) {}
  }, [attendanceLogs]);

  // Listen to external clear / purge attendance events
  useEffect(() => {
    const handleLogsCleared = () => {
      try {
        const saved = localStorage.getItem('csu_rotc_master_attendance');
        const logs = saved ? JSON.parse(saved) : [];
        if (logs.length === 0) {
          recentApprovedSignaturesRef.current.clear();
          localStorage.removeItem('csu_rotc_recent_approved_signatures');
        }
      } catch (_) {}
    };

    window.addEventListener('storage', handleLogsCleared);
    window.addEventListener('local-attendance-update', handleLogsCleared);
    return () => {
      window.removeEventListener('storage', handleLogsCleared);
      window.removeEventListener('local-attendance-update', handleLogsCleared);
    };
  }, []);

  const saveApprovedSignatures = () => {
    try {
      localStorage.setItem(
        'csu_rotc_recent_approved_signatures',
        JSON.stringify(Array.from(recentApprovedSignaturesRef.current))
      );
    } catch (_) {}
  };

  // Audio synthesizer chime for approval
  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } catch (_) {}
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

  // In-Page Batch Approval
  const handleApproveBatch = (batchId) => {
    const batch = pendingBatches.find((b) => b.id === batchId);
    if (!batch) return;

    playSuccessBeep();

    const batchRecords = (batch.records || []).map((r) => {
      const cid = String(r.cadetId || r.cadet_id || r.id || r.i || '').trim().toUpperCase();
      const officer = r.dutyOfficer || r.duty_officer || batch.dutyOfficer || 'Duty Officer';
      return {
        ...r,
        cadetId: cid,
        cadet_id: cid,
        dutyOfficer: officer,
        duty_officer: officer,
        sessionName: r.sessionName || r.session_name || batch.sessionName || 'Formation Session',
        battalion: r.battalion || batch.battalion || '1st Battalion',
        company: r.company || batch.company || 'Alpha Company',
        platoon: r.platoon || batch.platoon || '1st Platoon'
      };
    });

    // Commit to master attendance logs
    if (onSyncComplete) {
      onSyncComplete(batchRecords);
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
      }).catch(() => {});
    } catch (_) {}

    if (batch.signature) {
      recentApprovedSignaturesRef.current.add(batch.signature);
      saveApprovedSignatures();
    }

    setPendingBatches((prev) => prev.filter((b) => b.id !== batchId));
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      next.delete(batchId);
      return next;
    });

    setToastMessage({
      type: 'success',
      text: `Approved batch from ${batch.dutyOfficer} (${batchRecords.length} Cadets Ingested).`
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // In-Page Batch Rejection
  const handleRejectBatch = (batchId) => {
    const batch = pendingBatches.find((b) => b.id === batchId);
    setPendingBatches((prev) => prev.filter((b) => b.id !== batchId));
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

  // Approve All Batches in Queue
  const handleApproveAll = () => {
    if (pendingBatches.length === 0) return;

    playSuccessBeep();

    let allEnrichedRecords = [];
    pendingBatches.forEach((batch) => {
      const batchRecords = (batch.records || []).map((r) => {
        const cid = String(r.cadetId || r.cadet_id || r.id || r.i || '').trim().toUpperCase();
        const officer = r.dutyOfficer || r.duty_officer || batch.dutyOfficer || 'Duty Officer';
        return {
          ...r,
          cadetId: cid,
          cadet_id: cid,
          dutyOfficer: officer,
          duty_officer: officer,
          sessionName: r.sessionName || r.session_name || batch.sessionName || 'Formation Session',
          battalion: r.battalion || batch.battalion || '1st Battalion',
          company: r.company || batch.company || 'Alpha Company',
          platoon: r.platoon || batch.platoon || '1st Platoon'
        };
      });

      allEnrichedRecords = allEnrichedRecords.concat(batchRecords);
      if (batch.signature) {
        recentApprovedSignaturesRef.current.add(batch.signature);
      }
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dutyOfficer: batch.dutyOfficer || 'Duty Officer',
            sessionName: batch.sessionName || 'Field Session',
            records: batchRecords
          })
        }).catch(() => {});
      } catch (_) {}
    });

    saveApprovedSignatures();

    if (onSyncComplete) {
      onSyncComplete(allEnrichedRecords);
    }
    window.dispatchEvent(new Event('local-attendance-update'));

    const count = pendingBatches.length;
    const totalRecords = allEnrichedRecords.length;

    setPendingBatches([]);
    setExpandedBatchIds(new Set());

    setToastMessage({
      type: 'success',
      text: `All ${count} pending batches approved (${totalRecords} Cadets Ingested).`
    });
    setTimeout(() => setToastMessage(null), 4000);
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

      {/* 3-Step Synchronization Guide (Placed above Pending Batches) */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '1.05rem' }}>
            <QrCode size={20} />
            <span>How Offline QR-to-Camera Sync Works</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Step 1 */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(6, 78, 46, 0.1)', color: 'var(--rotc-green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.75rem' }}>
              1
            </div>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
              Field Duty Officer Scans Cadets
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Duty Officers scan cadet ID cards in the field using their smartphone web app. Scans are saved securely in local phone storage.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(229, 169, 0, 0.15)', color: '#b48400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.75rem' }}>
              2
            </div>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
              Present Batch Sync QR Code
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Officer taps <strong>[ PRESENT BATCH SYNC QR ]</strong> on the phone. The phone generates a high-contrast, low-density QR code.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.15)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.75rem' }}>
              3
            </div>
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--rotc-green-dark)', fontSize: '0.95rem' }}>
              Auto-Queue & In-Page Approval
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Laptop webcam rapidly scans batches into the pending queue in the background. Admin reviews cadet rosters and clicks Approve or Reject on the page.
            </p>
          </div>
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

                return (
                  <div
                    key={batch.id}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #fde68a',
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
                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        borderBottom: '1px solid #fde68a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              background: '#d97706',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}
                          >
                            PENDING APPROVAL
                          </span>
                          <span style={{ fontWeight: 800, color: 'var(--rotc-green-dark)', fontSize: '0.98rem' }}>
                            {batch.battalion} • {batch.company} • {batch.platoon}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#92400e', marginTop: '3px', fontWeight: 600 }}>
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
                              {batch.records.map((rec, idx) => (
                                <tr key={idx}>
                                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--rotc-green-dark)' }}>{rec.cadetId}</td>
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
                              ))}
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
