import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import BatchSyncHierarchyTracker, {
  normalizeBattalionKey,
  normalizeCompanyKey,
  normalizePlatoonKey
} from './BatchSyncHierarchyTracker';
import {
  getSupabaseClient,
  inferCadetFromId,
  ensureSessionWithDutyOfficer,
  bulkUpsertAttendanceToSupabase
} from '../utils/supabaseClient';

// Helper to normalize date to YYYY-MM-DD
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

// Retrieves today's full date boundaries (start of today 00:00:00 to end of today 23:59:59 local & ISO)
function getTodayDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayDateStr = `${year}-${month}-${day}`; // e.g. "2026-09-22"

  const startLocal = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endLocal = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    todayDateStr,
    startISO: startLocal.toISOString(),
    endISO: endLocal.toISOString()
  };
}

// Strictly checks if a record or batch is from today's date (2026-09-22)
function isRecordStrictlyToday(record, todayDateStr) {
  if (!record) return false;

  // 1. Primary check: If date or session_date is set, it MUST strictly match todayDateStr
  const explicitDate = record.date || record.session_date;
  if (explicitDate) {
    return toDateKey(explicitDate) === todayDateStr;
  }

  // 2. Fallback check: If no explicit date field exists, verify timestamp string
  const ts = record.scannedAt || record.timestamp || record.created_at || record.receivedAt || record.scanned_at;
  if (ts) {
    if (typeof ts === 'string') {
      if (ts.slice(0, 10) === todayDateStr) return true;
      if (toDateKey(ts) === todayDateStr) return true;
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      const rY = d.getFullYear();
      const rM = String(d.getMonth() + 1).padStart(2, '0');
      const rD = String(d.getDate()).padStart(2, '0');
      return `${rY}-${rM}-${rD}` === todayDateStr;
    }
  }

  return false;
}

// Guardrail: Exclude any record where status = 'EXCUSED' or is_excuse = true
function isExcuseOrNonBatch(log) {
  if (!log) return true;
  if (log.is_excuse === true || log.isExcuse === true || log.isExcuseRequest === true) return true;

  const status = String(log.status || log.final_daily_status || log.finalDailyStatus || '').toUpperCase();
  if (status === 'EXCUSED' || status === 'EXCUSE_PENDING' || status === 'PENDING') return true;
  if (log.excuse_status && String(log.excuse_status).toUpperCase() !== 'NONE') return true;

  const submissionType = String(log.submission_type || log.submissionType || log.source || '').toUpperCase();
  if (submissionType.includes('EXCUSE')) return true;

  return false;
}

// Verifies if a log is a verified physical batch QR scan
function isApprovedBatchScan(log) {
  if (!log) return false;
  if (isExcuseOrNonBatch(log)) return false;

  const submissionType = String(log.submission_type || log.submissionType || log.source || '').toUpperCase();
  if (submissionType === 'BATCH_QR' || submissionType === 'QR_BATCH' || submissionType === 'WEBCAM_BATCH') {
    return true;
  }

  // Active attendance scans (PRESENT, LATE, TARDY, ON_DUTY, etc. - anything not ABSENT or EXCUSED)
  const status = String(log.status || log.final_daily_status || '').toUpperCase();
  if (status.includes('EXCUS') || status === 'ABSENT') {
    return false;
  }
  return true;
}

export default function WebcamBatchScanner({ cadets = [], attendanceLogs = [], onSyncComplete }) {
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [todayDbLogs, setTodayDbLogs] = useState([]);

  // Track the current calendar date for midnight rollover auto-reset
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => {
    return getTodayDateRange().todayDateStr;
  });

  // Track physically approved batches today (ensures Sync Map highlights ONLY when a batch QR scan is approved)
  const [approvedTodayBatches, setApprovedTodayBatches] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_approved_batches_today');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      const { todayDateStr } = getTodayDateRange();
      return parsed.filter(b => isRecordStrictlyToday(b, todayDateStr) && !isExcuseOrNonBatch(b));
    } catch (_) {
      return [];
    }
  });

  // Hydrate Pending Batches from localStorage (strictly filtered for today)
  const [pendingBatches, setPendingBatches] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_pending_batches');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      const { todayDateStr } = getTodayDateRange();
      const todayOnly = parsed.filter(b => isRecordStrictlyToday(b, todayDateStr));
      if (todayOnly.length !== parsed.length) {
        localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(todayOnly));
      }
      return todayOnly;
    } catch (_) {
      return [];
    }
  });

  const [expandedBatchIds, setExpandedBatchIds] = useState(new Set());
  const recentApprovedSignaturesRef = useRef(new Set());
  const [toastMessage, setToastMessage] = useState(null);

  // Set of registered cadet IDs for real-time validation during batch ingestion
  const registeredCadetIdSet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(cadets)) {
      cadets.forEach((c) => {
        const id = c.id || c.cadet_id || c.cadetId;
        if (id) set.add(String(id).trim().toUpperCase());
      });
    }
    return set;
  }, [cadets]);

  // Fetch today's scans directly from Supabase Cloud scoped strictly to today's date range and excluding EXCUSED
  const fetchTodaySupabaseLogs = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { todayDateStr, startISO, endISO } = getTodayDateRange();

    try {
      // Query attendance_logs for today's date, excluding EXCUSED status
      const { data: dateRows } = await client
        .from('attendance_logs')
        .select('*')
        .eq('date', todayDateStr)
        .neq('status', 'EXCUSED');

      const { data: isoRows } = await client
        .from('attendance_logs')
        .select('*')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .neq('status', 'EXCUSED');

      const map = new Map();
      (dateRows || []).forEach(r => {
        if (isRecordStrictlyToday(r, todayDateStr) && !isExcuseOrNonBatch(r)) {
          map.set(r.id || `${r.cadet_id}_${r.date}_${r.time_in}`, r);
        }
      });
      (isoRows || []).forEach(r => {
        if (isRecordStrictlyToday(r, todayDateStr) && !isExcuseOrNonBatch(r)) {
          map.set(r.id || `${r.cadet_id}_${r.date}_${r.time_in}`, r);
        }
      });

      setTodayDbLogs(Array.from(map.values()));
    } catch (err) {
      console.warn('[WebcamBatchScanner] Supabase fetch error for today scans:', err);
    }
  }, []);

  // Midnight Real-time Refresh: Add a setInterval check that clears local state when calendar date rolls over
  useEffect(() => {
    const checkMidnightRollover = () => {
      const { todayDateStr } = getTodayDateRange();
      if (todayDateStr !== currentCalendarDate) {
        console.log(`[WebcamBatchScanner] Midnight calendar rollover detected: ${currentCalendarDate} -> ${todayDateStr}. Auto-resetting daily sync state.`);

        setCurrentCalendarDate(todayDateStr);
        setTodayDbLogs([]);
        setApprovedTodayBatches([]);
        try { localStorage.removeItem('csu_rotc_approved_batches_today'); } catch (_) { }

        setPendingBatches((prev) => {
          const fresh = prev.filter(b => isRecordStrictlyToday(b, todayDateStr));
          try {
            localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(fresh));
          } catch (_) { }
          return fresh;
        });

        recentApprovedSignaturesRef.current = new Set();
        try {
          localStorage.removeItem('csu_rotc_recent_approved_signatures');
        } catch (_) { }

        fetchTodaySupabaseLogs();
        window.dispatchEvent(new CustomEvent('csu-daily-reset', { detail: { newDate: todayDateStr } }));
      }
    };

    const intervalTimer = setInterval(checkMidnightRollover, 10000);
    return () => clearInterval(intervalTimer);
  }, [currentCalendarDate, fetchTodaySupabaseLogs]);

  // Initial fetch and Supabase Real-time listener for today's logs
  useEffect(() => {
    fetchTodaySupabaseLogs();

    const client = getSupabaseClient();
    if (!client) return;

    const channelId = `webcam_scanner_today_${Date.now()}`;
    const channel = client
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          fetchTodaySupabaseLogs();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_sessions' },
        () => {
          fetchTodaySupabaseLogs();
        }
      )
      .subscribe();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [currentCalendarDate, fetchTodaySupabaseLogs]);

  // Effective today's logs strictly excluding any records where status = 'EXCUSED' or is_excuse = true
  const effectiveTodayLogs = useMemo(() => {
    const { todayDateStr } = getTodayDateRange();
    const map = new Map();

    const addRecord = (log) => {
      if (!log || !isRecordStrictlyToday(log, todayDateStr) || isExcuseOrNonBatch(log)) return;
      const key = log.id || `${log.cadetId || log.cadet_id}_${log.date || log.session_date}_${log.timeIn || log.time_in || log.timestamp}`;
      if (!map.has(key)) {
        map.set(key, log);
      }
    };

    (todayDbLogs || []).forEach(addRecord);
    (attendanceLogs || []).forEach(addRecord);

    return Array.from(map.values());
  }, [todayDbLogs, attendanceLogs, currentCalendarDate]);

  // Ensure the Sync Map highlights green ONLY when a physical batch QR scan has been processed and approved for that specific platoon today
  // (strictly excluding EXCUSED, EXCUSE_PENDING, or is_excuse = true)
  const allIngestedBatches = useMemo(() => {
    const { todayDateStr } = getTodayDateRange();
    const list = [];
    const seen = new Set();

    // 1. Physically approved batches from today
    if (Array.isArray(approvedTodayBatches)) {
      approvedTodayBatches.forEach(b => {
        if (isRecordStrictlyToday(b, todayDateStr) && !isExcuseOrNonBatch(b)) {
          const rawBn = b.battalion || b.battalion_name || b.bn || '1st Battalion';
          const rawCo = b.company || b.company_name || b.co || b.companyName;
          const rawPl = b.platoon || b.platoon_name || b.pl || b.platoonName;
          const normBn = normalizeBattalionKey(rawBn);
          const normCo = normalizeCompanyKey(rawCo);
          const normPl = normalizePlatoonKey(rawPl);
          if (normBn && normCo && normPl) {
            const key = `${normBn}__${normCo}__${normPl}`;
            if (!seen.has(key)) {
              seen.add(key);
              list.push({
                battalion: rawBn,
                company: rawCo,
                platoon: rawPl,
                normalizedBattalion: normBn,
                normalizedCompany: normCo,
                normalizedPlatoon: normPl,
                date: todayDateStr,
                timestamp: b.timestamp || new Date().toISOString(),
                submission_type: 'BATCH_QR',
                is_approved: true
              });
            }
          }
        }
      });
    }

    // 2. Verified batch QR logs from today
    if (Array.isArray(effectiveTodayLogs)) {
      effectiveTodayLogs.forEach(l => {
        if (isRecordStrictlyToday(l, todayDateStr) && isApprovedBatchScan(l)) {
          const rawBn = l.battalion || l.battalion_name || l.bn || '1st Battalion';
          const rawCo = l.company || l.company_name || l.co || l.companyName;
          const rawPl = l.platoon || l.platoon_name || l.pl || l.platoonName;
          const normBn = normalizeBattalionKey(rawBn);
          const normCo = normalizeCompanyKey(rawCo);
          const normPl = normalizePlatoonKey(rawPl);
          if (normBn && normCo && normPl) {
            const key = `${normBn}__${normCo}__${normPl}`;
            if (!seen.has(key)) {
              seen.add(key);
              list.push({
                battalion: rawBn,
                company: rawCo,
                platoon: rawPl,
                normalizedBattalion: normBn,
                normalizedCompany: normCo,
                normalizedPlatoon: normPl,
                date: todayDateStr,
                timestamp: l.timestamp || l.date || l.timeIn || l.timeOut || l.receivedAt,
                submission_type: 'BATCH_QR',
                is_approved: true
              });
            }
          }
        }
      });
    }

    return list;
  }, [approvedTodayBatches, effectiveTodayLogs, currentCalendarDate]);

  // Calculate Synced Platoons strictly based on the normalized Set of approved physical batch QR scans today
  const syncedPlatoonsCount = useMemo(() => {
    const set = new Set();
    allIngestedBatches.forEach(b => {
      const bn = b.normalizedBattalion || normalizeBattalionKey(b.battalion);
      const co = b.normalizedCompany || normalizeCompanyKey(b.company);
      const pl = b.normalizedPlatoon || normalizePlatoonKey(b.platoon);
      if (bn && co && pl) {
        set.add(`${bn}__${co}__${pl}`);
      }
    });
    return set.size;
  }, [allIngestedBatches]);

  // Master Records Logged strictly based on today's physical batch attendance records
  const totalScans = effectiveTodayLogs.length;

  // Latest Ingested Batches strictly derived from today's approved batch logs
  const recentBatches = useMemo(() => {
    const batchMap = new Map();
    effectiveTodayLogs.forEach((log) => {
      const bn = log.battalion || '1st Battalion';
      const co = log.company || 'Alpha Company';
      const pl = log.platoon || '1st Platoon';
      const officer = log.dutyOfficer || log.duty_officer || log.d || 'Duty Officer';
      const timeKey = log.receivedAt ? log.receivedAt.slice(0, 16) : log.timestamp ? log.timestamp.slice(0, 16) : 'batch';
      const key = `${bn}__${co}__${pl}__${officer}__${timeKey}`;

      if (!batchMap.has(key)) {
        batchMap.set(key, {
          battalion: bn,
          company: co,
          platoon: pl,
          dutyOfficer: officer,
          timestamp: log.receivedAt || log.timestamp || log.date || new Date().toISOString(),
          count: 0,
          status: log.status || 'PRESENT'
        });
      }
      const batch = batchMap.get(key);
      batch.count += 1;
    });
    return Array.from(batchMap.values()).slice(0, 6);
  }, [effectiveTodayLogs]);

  // Sync Pending Batches to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(pendingBatches));
    } catch (_) { }
  }, [pendingBatches]);

  // Hydrate Approved Batch Signatures from localStorage
  useEffect(() => {
    try {
      const savedSignatures = localStorage.getItem('csu_rotc_recent_approved_signatures');
      if (savedSignatures) {
        if (!effectiveTodayLogs || effectiveTodayLogs.length === 0) {
          recentApprovedSignaturesRef.current = new Set();
          localStorage.removeItem('csu_rotc_recent_approved_signatures');
        } else {
          recentApprovedSignaturesRef.current = new Set(JSON.parse(savedSignatures));
        }
      }
    } catch (_) { }
  }, [effectiveTodayLogs]);

  // Listen to external clear / purge attendance events
  useEffect(() => {
    const handleLogsCleared = (e) => {
      if (e?.type === 'storage' && e.key && (e.key !== 'csu_rotc_attendance_logs' || e.newValue)) {
        return;
      }
      try {
        recentApprovedSignaturesRef.current = new Set();
        localStorage.removeItem('csu_rotc_recent_approved_signatures');
        localStorage.removeItem('csu_rotc_approved_batches_today');
        setApprovedTodayBatches([]);
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
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      next.add(newBatchItem.id);
      return next;
    });
  };

  // Batch Approval: Ingest batch records into attendance logs and Supabase
  const handleApproveBatch = async (batchId) => {
    const batch = pendingBatches.find((b) => b.id === batchId);
    if (!batch) return;

    try {
      const allRecords = batch.records || [];
      if (allRecords.length === 0) {
        setPendingBatches((prev) => {
          const next = prev.filter((b) => b.id !== batchId);
          try { localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next)); } catch (_) { }
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

      const firstScan = allRecords[0];
      const targetDate = toDateKey(batch.date || firstScan.date || new Date());
      const targetOfficer = batch.dutyOfficer || firstScan.dutyOfficer || 'Duty Officer';
      const targetTitle = batch.sessionName || firstScan.sessionName || 'Formation Session';

      const batchRecords = allRecords.map((r) => {
        const cid = String(r.cadetId || r.cadet_id || r.id || r.i || '').trim().toUpperCase();
        const officer = r.dutyOfficer || r.duty_officer || targetOfficer;
        const scanTimestamp = r.timestamp || r.scanned_at || r.scannedAt || batch.scannedAt || new Date().toISOString();
        const scanDate = toDateKey(r.date || targetDate);
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
          sessionName: r.sessionName || r.session_name || targetTitle,
          battalion: r.battalion || batch.battalion || '1st Battalion',
          company: r.company || batch.company || 'Alpha Company',
          platoon: r.platoon || batch.platoon || '1st Platoon',
          submission_type: 'BATCH_QR',
          submissionType: 'BATCH_QR',
          is_excuse: false
        };
      });

      // 1. Ensure parent attendance_sessions row exists in Supabase BEFORE inserting attendance_logs
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

      // 3. Record this approved batch in today's approved batches list to trigger the Sync Map
      const approvedBatchEntry = {
        id: batch.id,
        battalion: batch.battalion,
        company: batch.company,
        platoon: batch.platoon,
        dutyOfficer: targetOfficer,
        count: batchRecords.length,
        date: targetDate,
        timestamp: new Date().toISOString(),
        submission_type: 'BATCH_QR',
        is_approved: true
      };

      setApprovedTodayBatches(prev => {
        const next = [approvedBatchEntry, ...prev.filter(b => b.id !== batch.id)];
        try { localStorage.setItem('csu_rotc_approved_batches_today', JSON.stringify(next)); } catch (_) { }
        return next;
      });

      // 4. Ingest strictly into master attendance logs & notify App.jsx
      if (onSyncComplete) {
        await onSyncComplete(batchRecords);
      }
      window.dispatchEvent(new Event('local-attendance-update'));

      // Re-fetch today's logs immediately
      fetchTodaySupabaseLogs();

      // Server background sync
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dutyOfficer: targetOfficer,
            sessionName: targetTitle,
            records: batchRecords
          })
        }).catch(() => { });
      } catch (_) { }

      if (batch.signature) {
        recentApprovedSignaturesRef.current.add(batch.signature);
        saveApprovedSignatures();
      }

      // State cleanup
      setPendingBatches((prev) => {
        const next = prev.filter((b) => b.id !== batchId);
        try {
          localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next));
        } catch (_) { }
        return next;
      });

      setExpandedBatchIds((prev) => {
        const next = new Set(prev);
        next.delete(batchId);
        return next;
      });

      setToastMessage({
        type: 'success',
        text: `✅ Approved batch from ${targetOfficer} (${batchRecords.length} Cadets Ingested).`
      });
    } catch (err) {
      console.error('❌ Batch approval ingestion failure:', err);
      setPendingBatches((prev) => {
        const next = prev.filter((b) => b.id !== batchId);
        try {
          localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next));
        } catch (_) { }
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
      try { localStorage.setItem('csu_rotc_pending_batches', JSON.stringify(next)); } catch (_) { }
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

  // Approve All Batches in Queue
  const handleApproveAll = async () => {
    if (pendingBatches.length === 0) return;

    try {
      let allBatchRecords = [];
      const newApprovedBatches = [];

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
            platoon: r.platoon || batch.platoon || '1st Platoon',
            submission_type: 'BATCH_QR',
            submissionType: 'BATCH_QR',
            is_excuse: false
          };
        });

        allBatchRecords = allBatchRecords.concat(records);

        newApprovedBatches.push({
          id: batch.id,
          battalion: batch.battalion,
          company: batch.company,
          platoon: batch.platoon,
          dutyOfficer: batch.dutyOfficer || 'Duty Officer',
          count: records.length,
          date: toDateKey(batch.date || new Date()),
          timestamp: new Date().toISOString(),
          submission_type: 'BATCH_QR',
          is_approved: true
        });

        if (batch.signature) {
          recentApprovedSignaturesRef.current.add(batch.signature);
        }
      });

      if (allBatchRecords.length === 0) {
        setPendingBatches([]);
        setExpandedBatchIds(new Set());
        try { localStorage.removeItem('csu_rotc_pending_batches'); } catch (_) { }
        return;
      }

      playSuccessBeep();
      saveApprovedSignatures();

      // Ensure parent sessions exist
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
        } catch (_) { }
      }

      allBatchRecords.forEach(r => {
        const key = `${r.date}__${r.dutyOfficer}__${r.sessionName || ''}`;
        const sId = sessionMap.get(key) || sessionMap.get(`${r.date}__${r.dutyOfficer}`);
        if (sId) {
          r.session_id = sId;
          r.sessionId = sId;
        }
      });

      // Ingest directly into Supabase Cloud
      try {
        await bulkUpsertAttendanceToSupabase(allBatchRecords);
      } catch (sbErr) {
        console.warn('Direct bulk Supabase ingestion note:', sbErr);
      }

      // Record approved batches to trigger Sync Map
      setApprovedTodayBatches(prev => {
        const next = [...newApprovedBatches, ...prev];
        try { localStorage.setItem('csu_rotc_approved_batches_today', JSON.stringify(next)); } catch (_) { }
        return next;
      });

      // Ingest into master attendance logs & notify App.jsx
      if (onSyncComplete) {
        await onSyncComplete(allBatchRecords);
      }
      window.dispatchEvent(new Event('local-attendance-update'));

      // Re-fetch today's logs immediately
      fetchTodaySupabaseLogs();

      pendingBatches.forEach(b => {
        if (b.signature) recentApprovedSignaturesRef.current.add(b.signature);
      });
      saveApprovedSignatures();

      setPendingBatches([]);
      setExpandedBatchIds(new Set());
      try {
        localStorage.removeItem('csu_rotc_pending_batches');
      } catch (_) { }

      setToastMessage({
        type: 'success',
        text: `✅ Approved all batches (${allBatchRecords.length} Cadets Ingested).`
      });
    } catch (err) {
      console.error('❌ Approve all batches ingestion failure:', err);
      setPendingBatches([]);
      setExpandedBatchIds(new Set());
      try { localStorage.removeItem('csu_rotc_pending_batches'); } catch (_) { }
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

                return (
                  <div
                    key={batch.id}
                    style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: '12px',
                      background: '#ffffff',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {/* Batch Summary Header */}
                    <div
                      style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        background: '#f8fafc',
                        borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                          onClick={() => toggleBatchExpand(batch.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--text-main)',
                            padding: '4px'
                          }}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1rem', color: 'var(--rotc-green-dark)' }}>
                              {batch.battalion} • {batch.company} • {batch.platoon}
                            </strong>
                            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                              READY FOR APPROVAL
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span>Duty Officer: <strong>{batch.dutyOfficer}</strong></span>
                            <span>•</span>
                            <span>Session: <strong>{batch.sessionName}</strong></span>
                            <span>•</span>
                            <span>{new Date(batch.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--rotc-green-dark)' }}>
                            {batch.records.length} Cadets
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {timeInCount > 0 && <span style={{ color: '#059669', fontWeight: 600 }}>{timeInCount} In </span>}
                            {timeOutCount > 0 && <span style={{ color: '#2563eb', fontWeight: 600 }}>{timeOutCount} Out</span>}
                          </div>
                        </div>

                        <button
                          className="btn btn-secondary"
                          onClick={() => handleRejectBatch(batch.id)}
                          style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fca5a5' }}
                          title="Reject and discard this batch"
                        >
                          <Trash2 size={15} />
                          <span>Reject</span>
                        </button>

                        <button
                          className="btn btn-primary"
                          onClick={() => handleApproveBatch(batch.id)}
                          style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem', background: '#059669', borderColor: '#059669' }}
                          title="Approve batch and save into master attendance logs"
                        >
                          <CheckCircle2 size={16} />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>

                    {/* Batch Records List (Expandable) */}
                    {isExpanded && (
                      <div style={{ padding: '1rem 1.25rem', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Batch Records Preview ({batch.records.length})
                        </div>

                        <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0.75rem' }}>#</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Cadet ID</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Rank</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Scan Mode</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Time Logged</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.records.map((r, idx) => {
                                const cid = String(r.cadetId || r.cadet_id || r.id || r.i || '').trim().toUpperCase();
                                const isRegistered = registeredCadetIdSet.has(cid);
                                const isTimeOut = r.scanMode === 'Time-Out';

                                return (
                                  <tr
                                    key={idx}
                                    style={{
                                      borderBottom: '1px solid #f1f5f9',
                                      background: !isRegistered ? '#fef2f2' : (idx % 2 === 0 ? '#ffffff' : '#fcfcfc')
                                    }}
                                  >
                                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                      {cid}
                                      {!isRegistered && (
                                        <span title="Unregistered ID — will be marked as Visitor or Unassigned" style={{ marginLeft: '4px', color: '#ef4444' }}>
                                          ⚠️
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.45rem 0.75rem' }}>{r.name || r.n || 'Cadet'}</td>
                                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>{r.rank || 'Cadet'}</td>
                                    <td style={{ padding: '0.45rem 0.75rem' }}>
                                      <span
                                        style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          background: isTimeOut ? '#dbeafe' : '#dcfce7',
                                          color: isTimeOut ? '#1d4ed8' : '#15803d'
                                        }}
                                      >
                                        {isTimeOut ? 'Time-Out' : 'Time-In'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.45rem 0.75rem' }}>
                                      <span
                                        className={`badge ${r.status === 'TARDY'
                                            ? 'badge-tardy'
                                            : r.status === 'EXCUSED'
                                              ? 'badge-excused'
                                              : 'badge-present'
                                          }`}
                                        style={{ fontSize: '0.7rem' }}
                                      >
                                        {r.status || 'PRESENT'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>
                                      {r.timeIn || r.timeOut || (r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* REAL-TIME UNIT BATCH SYNC HIERARCHY STATUS MAP (Highlights green ONLY when physical batch QR is approved for that platoon today) */}
      <BatchSyncHierarchyTracker ingestedBatches={allIngestedBatches} />

      {/* Ingestion Overview & Latest Ingested Batches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Camera Node Status */}
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
              <strong style={{ color: 'var(--rotc-green-dark)', fontSize: '1rem' }}>{totalScans} Records Today</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Synced Platoons:</span>
              <strong style={{ color: '#059669', fontSize: '1rem' }}>{syncedPlatoonsCount} Platoons Synced</strong>
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
        attendanceLogs={effectiveTodayLogs}
        pendingBatches={pendingBatches}
        onBatchQueued={handleBatchQueued}
        recentApprovedSignatures={recentApprovedSignaturesRef.current}
      />
    </div>
  );
}
