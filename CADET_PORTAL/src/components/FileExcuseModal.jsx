import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText,
  X,
  XCircle,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Send,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { formatHumanDate, toDateKey } from '../utils/attendanceRules';
import { submitExcuseRequest, fetchSettingsFromSupabase, getSupabaseClient } from '../utils/supabaseClient';

/**
 * FileExcuseModal Component
 * 
 * Strictly checks system_settings.excuse_grace_period_days:
 * - Fetches grace_period_days directly from Supabase system_settings.
 * - Calculates the difference between CURRENT_DATE (Sept 18) and the drill date.
 * - Strictly excludes/disables any date where days_difference > grace_period_days.
 * - Automatically selects the first selectable/unsubmitted date (e.g. Sep 18, 2026).
 * - Protects unsubmitted input (reason text) from being wiped out during background refresh.
 */
function FileExcuseModal({
  isOpen,
  onClose,
  cadetId,
  isLight = false,
  settings = null,
  logs = [],
  evaluated = null,
  formationDates = [],
  dbSessions = [],
  eligibleAbsentDates = [],
  expiredAbsentDrillDates = [],
  pendingAbsentDrillDates = [],
  approvedAbsentDrillDates = [],
  rejectedAbsentDrillDates = [],
  rejectedExcuseDatesMap = new Map(),
  approvedExcuseDatesMap = new Map(),
  pendingExcuseDatesMap = new Map(),
  officialFormationDatesSet = new Set(),
  onSubmitSuccess
}) {
  // 1. Live Grace Period directly from system_settings table in Supabase (defaults to 3)
  const [directGracePeriod, setDirectGracePeriod] = useState(() => {
    const rawVal = settings?.excuse_grace_period_days ?? settings?.excuseGracePeriodDays;
    if (rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) && Number(rawVal) > 0) {
      return Number(rawVal);
    }
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const val = parsed?.excuse_grace_period_days ?? parsed?.excuseGracePeriodDays;
        if (val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) > 0) {
          return Number(val);
        }
      }
    } catch (_) { }
    return 3;
  });

  useEffect(() => {
    let isMounted = true;
    async function loadGracePeriodFromSupabase() {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('system_settings')
            .select('excuse_grace_period_days')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (isMounted && data && data.excuse_grace_period_days !== undefined && data.excuse_grace_period_days !== null) {
            const val = Number(data.excuse_grace_period_days);
            if (!isNaN(val) && val > 0) {
              setDirectGracePeriod(val);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Direct system_settings fetch error in FileExcuseModal:', err);
      }

      // Fallback: fetchSettingsFromSupabase
      try {
        const fresh = await fetchSettingsFromSupabase(true);
        if (isMounted && fresh) {
          const val = Number(fresh.excuse_grace_period_days ?? fresh.excuseGracePeriodDays);
          if (!isNaN(val) && val > 0) {
            setDirectGracePeriod(val);
          }
        }
      } catch (_) { }
    }

    loadGracePeriodFromSupabase();

    const handleSettingsUpdate = (e) => {
      const updated = e?.detail || e;
      const val = updated?.excuse_grace_period_days ?? updated?.excuseGracePeriodDays;
      if (val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) > 0) {
        setDirectGracePeriod(Number(val));
      }
    };

    window.addEventListener('csu_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('csu_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, [isOpen]);

  // Grace Period Days: Prioritize live Supabase value, then settings prop, then localStorage, then default 3
  const gracePeriodDays = useMemo(() => {
    if (directGracePeriod !== null && !isNaN(directGracePeriod) && directGracePeriod > 0) {
      return directGracePeriod;
    }
    const rawVal = settings?.excuse_grace_period_days ?? settings?.excuseGracePeriodDays;
    if (rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) && Number(rawVal) > 0) {
      return Number(rawVal);
    }
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const val = parsed?.excuse_grace_period_days ?? parsed?.excuseGracePeriodDays;
        if (val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) > 0) {
          return Number(val);
        }
      }
    } catch (_) { }
    return 3; // Official default 3-day grace window
  }, [directGracePeriod, settings]);

  // Form states
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Helper: calculate exact calendar days difference between CURRENT_DATE (Sept 18) and drill date
  // Formula: CURRENT_DATE - drill date
  const getDaysDiff = useCallback((targetDateStr) => {
    if (!targetDateStr) return 999;
    const now = new Date();
    // Midnight of current date in local time
    const currentMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Parse target date string into YYYY-MM-DD
    const cleanStr = toDateKey(targetDateStr) || String(targetDateStr).split('T')[0];
    const parts = cleanStr.trim().split('-');
    if (parts.length !== 3) return 999;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const targetMidnight = new Date(year, month, day).getTime();

    return Math.round((currentMidnight - targetMidnight) / (1000 * 60 * 60 * 24));
  }, []);

  // 2. Query actual formation dates strictly from official formation sessions & attendance records
  const { allOptions, eligibleOptions } = useMemo(() => {
    const drillDatesMap = new Map();

    // 1. From evaluated.dailyBreakdown (matches the FORMATION DRILL SCHEDULE table exactly)
    (evaluated?.dailyBreakdown || []).forEach(entry => {
      const dk = toDateKey(entry.date);
      if (dk) {
        drillDatesMap.set(dk, {
          date: dk,
          status: entry.status || entry.dayType || 'ABSENT',
          entry
        });
      }
    });

    // 2. From attendance_logs (cadet attendance records)
    (logs || []).forEach(l => {
      const dk = toDateKey(l.date || l.session_date || l.timestamp);
      if (dk) {
        const existing = drillDatesMap.get(dk);
        drillDatesMap.set(dk, {
          date: dk,
          status: l.status || l.final_daily_status || existing?.status || 'ABSENT',
          log: l,
          entry: existing?.entry
        });
      }
    });

    // 3. From dbSessions (attendance_sessions table from Supabase)
    (dbSessions || []).forEach(s => {
      const dk = toDateKey(s.session_date || s.dateKey || s.date);
      if (dk && !drillDatesMap.has(dk)) {
        drillDatesMap.set(dk, {
          date: dk,
          status: 'ABSENT',
          session: s
        });
      }
    });

    // 4. From formationDates
    (formationDates || []).forEach(fd => {
      const dk = toDateKey(fd);
      if (dk && !drillDatesMap.has(dk)) {
        drillDatesMap.set(dk, {
          date: dk,
          status: 'ABSENT'
        });
      }
    });

    // Helper to check if cadet attended on dateKey
    const isAttended = (dk) => {
      const log = (logs || []).find(l => toDateKey(l.date || l.session_date || l.timestamp) === dk);
      if (log) {
        const st = String(log.status || log.final_daily_status || '').toUpperCase();
        if (st.includes('PRESENT') || st.includes('LATE') || (log.time_in && log.time_out)) {
          return true;
        }
      }
      const b = (evaluated?.dailyBreakdown || []).find(entry => toDateKey(entry.date) === dk);
      if (b) {
        const st = String(b.status || b.dayType || '').toUpperCase();
        if (st.includes('PRESENT') || st.includes('LATE') || (b.hasTimeIn && b.hasTimeOut)) {
          return true;
        }
      }
      return false;
    };

    const eligible = [];
    const expired = [];
    const pending = [];
    const approved = [];
    const rejected = [];

    // Sort all verified drill dates descending (newest first)
    const sortedDrillDates = Array.from(drillDatesMap.keys()).sort((a, b) => b.localeCompare(a));

    sortedDrillDates.forEach(dk => {
      const daysDiff = getDaysDiff(dk);

      // 1. If officially approved / excused:
      if (approvedExcuseDatesMap?.has(dk)) {
        approved.push({
          date: dk,
          type: 'APPROVED',
          disabled: false,
          daysDiff,
          label: `${formatHumanDate(dk)} (Approved / Excused)`
        });
        return;
      }

      // 2. If already pending review:
      if (pendingExcuseDatesMap?.has(dk) || pendingAbsentDrillDates?.some(p => (toDateKey(p.date || p) || p.date || p) === dk)) {
        pending.push({
          date: dk,
          type: 'PENDING',
          disabled: false,
          daysDiff,
          label: `${formatHumanDate(dk)} (Pending Admin Review)`
        });
        return;
      }

      // 3. If rejected by HQ:
      if (rejectedExcuseDatesMap?.has(dk) || rejectedAbsentDrillDates?.some(r => (toDateKey(r.date || r) || r.date || r) === dk)) {
        rejected.push({
          date: dk,
          type: 'REJECTED',
          disabled: false,
          daysDiff,
          label: `${formatHumanDate(dk)} (Excuse Rejected by Admin)`
        });
        return;
      }

      // 4. If attended, skip
      if (isAttended(dk)) {
        return;
      }

      // Future dates cannot be filed yet
      if (daysDiff < 0) {
        return;
      }

      // 5. Strictly exclude/disable any date where days_difference > grace_period_days
      if (daysDiff > gracePeriodDays) {
        expired.push({
          date: dk,
          type: 'EXPIRED',
          disabled: false,
          daysDiff,
          label: `${formatHumanDate(dk)} (Expired — Past ${gracePeriodDays}-Day Window)`
        });
        return;
      }

      // 6. Within policy grace window (daysDiff <= gracePeriodDays): Eligible unexcused absence
      eligible.push({
        date: dk,
        type: 'ELIGIBLE',
        disabled: false,
        daysDiff,
        label: `${formatHumanDate(dk)} (Unexcused Absence)`
      });
    });

    // Also include any pending dates recorded in pendingExcuseDatesMap or pendingAbsentDrillDates if not already present
    if (pendingExcuseDatesMap) {
      pendingExcuseDatesMap.forEach((_, dk) => {
        if (!pending.some(p => p.date === dk)) {
          const daysDiff = getDaysDiff(dk);
          pending.push({
            date: dk,
            type: 'PENDING',
            disabled: false,
            daysDiff,
            label: `${formatHumanDate(dk)} (Pending Admin Review)`
          });
        }
      });
    }
    if (Array.isArray(pendingAbsentDrillDates)) {
      pendingAbsentDrillDates.forEach(p => {
        const dk = toDateKey(p.date || p) || p.date || p;
        if (dk && !pending.some(item => item.date === dk)) {
          const daysDiff = getDaysDiff(dk);
          pending.push({
            date: dk,
            type: 'PENDING',
            disabled: false,
            daysDiff,
            label: `${formatHumanDate(dk)} (Pending Admin Review)`
          });
        }
      });
    }

    // Also include any rejected dates recorded in rejectedExcuseDatesMap if not already present
    if (rejectedExcuseDatesMap) {
      rejectedExcuseDatesMap.forEach((_, dk) => {
        if (!rejected.some(r => r.date === dk)) {
          const daysDiff = getDaysDiff(dk);
          rejected.push({
            date: dk,
            type: 'REJECTED',
            disabled: false,
            daysDiff,
            label: `${formatHumanDate(dk)} (Excuse Rejected by Admin)`
          });
        }
      });
    }

    // Also include any approved dates recorded in approvedExcuseDatesMap if not already present
    if (approvedExcuseDatesMap) {
      approvedExcuseDatesMap.forEach((_, dk) => {
        if (!approved.some(a => a.date === dk)) {
          const daysDiff = getDaysDiff(dk);
          approved.push({
            date: dk,
            type: 'APPROVED',
            disabled: false,
            daysDiff,
            label: `${formatHumanDate(dk)} (Approved / Excused)`
          });
        }
      });
    }

    eligible.sort((a, b) => b.date.localeCompare(a.date));
    pending.sort((a, b) => b.date.localeCompare(a.date));
    expired.sort((a, b) => b.date.localeCompare(a.date));
    rejected.sort((a, b) => b.date.localeCompare(a.date));
    approved.sort((a, b) => b.date.localeCompare(a.date));

    // Combine: Eligible first, then Pending (for immediate review), Expired, Rejected, Approved
    const options = [...eligible, ...pending, ...expired, ...rejected, ...approved];

    return {
      allOptions: options,
      eligibleOptions: eligible
    };
  }, [
    logs,
    evaluated,
    dbSessions,
    formationDates,
    approvedExcuseDatesMap,
    pendingExcuseDatesMap,
    pendingAbsentDrillDates,
    rejectedExcuseDatesMap,
    rejectedAbsentDrillDates,
    approvedAbsentDrillDates,
    gracePeriodDays,
    getDaysDiff
  ]);

  // Track modal open transition to preserve cadet's typed reason during background data refresh
  const wasOpenRef = useRef(false);

  useEffect(() => {
    // ONLY initialize modal inputs when transitioning from closed to open
    if (isOpen && !wasOpenRef.current) {
      const firstEligible = allOptions.find(opt => opt.type === 'ELIGIBLE');
      if (firstEligible) {
        setSelectedDate(firstEligible.date);
      } else {
        const firstPending = allOptions.find(opt => opt.type === 'PENDING');
        if (firstPending) {
          setSelectedDate(firstPending.date);
        } else if (allOptions.length > 0) {
          setSelectedDate(allOptions[0].date);
        } else {
          setSelectedDate('');
        }
      }
      setReason('');
      setResult(null);
    } else if (!isOpen) {
      // Clear result banner when closing
      setResult(null);
    }
    wasOpenRef.current = Boolean(isOpen);
  }, [isOpen, allOptions]);

  // If modal was opened before allOptions finished loading, pick first eligible or first pending date
  useEffect(() => {
    if (isOpen && !selectedDate && allOptions.length > 0) {
      const firstEligible = allOptions.find(opt => opt.type === 'ELIGIBLE');
      if (firstEligible) {
        setSelectedDate(firstEligible.date);
      } else {
        const firstPending = allOptions.find(opt => opt.type === 'PENDING');
        if (firstPending) {
          setSelectedDate(firstPending.date);
        } else {
          setSelectedDate(allOptions[0].date);
        }
      }
    }
  }, [isOpen, selectedDate, allOptions]);

  // Determine current status of the manually selected date
  const selectedDateStatus = useMemo(() => {
    if (!selectedDate) return null;
    const dk = toDateKey(selectedDate) || selectedDate;
    const opt = allOptions.find(o => o.date === dk);

    // 1. Pending HQ Review strictly checked first
    if (
      opt?.type === 'PENDING' ||
      pendingExcuseDatesMap?.has(dk) ||
      pendingAbsentDrillDates?.some(p => (toDateKey(p.date || p) || p.date || p) === dk)
    ) {
      return 'PENDING';
    }

    // 2. Excuse Rejected by Admin
    if (
      opt?.type === 'REJECTED' ||
      rejectedExcuseDatesMap?.has(dk) ||
      rejectedAbsentDrillDates?.some(r => (toDateKey(r.date || r) || r.date || r) === dk)
    ) {
      return 'REJECTED';
    }

    // 3. Approved / Excused
    if (
      opt?.type === 'APPROVED' ||
      approvedExcuseDatesMap?.has(dk) ||
      approvedAbsentDrillDates?.some(a => (toDateKey(a.date || a) || a.date || a) === dk)
    ) {
      return 'APPROVED';
    }

    // 4. Filing Window Expired
    if (opt?.type === 'EXPIRED') {
      return 'EXPIRED';
    }

    // 5. Eligible unexcused absence
    if (opt?.type === 'ELIGIBLE' || eligibleOptions.some(d => d.date === dk)) {
      return 'ELIGIBLE';
    }

    return 'OTHER';
  }, [
    selectedDate,
    allOptions,
    pendingExcuseDatesMap,
    pendingAbsentDrillDates,
    rejectedExcuseDatesMap,
    rejectedAbsentDrillDates,
    approvedExcuseDatesMap,
    approvedAbsentDrillDates,
    eligibleOptions
  ]);

  // Look up submitted excuse info for the currently selected pending date
  const pendingExcuseInfo = useMemo(() => {
    if (selectedDateStatus !== 'PENDING' || !selectedDate) return null;
    const dk = toDateKey(selectedDate) || selectedDate;
    if (pendingExcuseDatesMap?.has(dk)) {
      return pendingExcuseDatesMap.get(dk);
    }
    const fromPendingArr = pendingAbsentDrillDates?.find(p => (toDateKey(p.date || p) || p.date || p) === dk);
    if (fromPendingArr) return fromPendingArr;
    const fromLogs = (logs || []).find(l => (toDateKey(l.date || l.session_date || l.timestamp) || l.date) === dk && (l.excuse_status || l.reason || l.excuse_reason));
    if (fromLogs) {
      return {
        date: dk,
        reason: fromLogs.excuse_reason || fromLogs.reason || '',
        status: 'EXCUSE_PENDING'
      };
    }
    return null;
  }, [selectedDateStatus, selectedDate, pendingExcuseDatesMap, pendingAbsentDrillDates, logs]);

  // Handle Form Submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!cadetId) {
      setResult({ success: false, message: 'Cadet ID not verified. Please log in again.' });
      return;
    }
    if (!selectedDate || !reason.trim()) {
      setResult({ success: false, message: 'Please select an eligible formation date and provide your reason for absence.' });
      return;
    }

    // Strict validation: check grace period difference
    const daysDiff = getDaysDiff(selectedDate);
    if (daysDiff > gracePeriodDays) {
      setResult({
        success: false,
        message: `Filing window expired. The selected drill date was ${daysDiff} days ago, which exceeds the official ${gracePeriodDays}-day grace period.`
      });
      return;
    }

    const isEligible = eligibleOptions.some(d => d.date === selectedDate);
    if (!isEligible) {
      setResult({
        success: false,
        message: `The selected formation date is not eligible for filing under the ${gracePeriodDays}-day policy window.`
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await submitExcuseRequest(cadetId, selectedDate, reason.trim(), null);
      if (res && !res.error) {
        setResult({
          success: true,
          message: res.message || 'Excuse request submitted successfully! It is now awaiting admin review.'
        });
        setReason('');
        if (onSubmitSuccess) {
          setTimeout(() => {
            onSubmitSuccess();
            onClose();
          }, 2200);
        }
      } else if (res?.error === 'ALREADY_REJECTED') {
        setResult({ success: false, message: 'An excuse request for this formation date was already rejected by  and cannot be re-filed.' });
      } else if (res?.error === 'ALREADY_EXCUSED') {
        setResult({ success: false, message: 'An official excuse for this formation has already been approved by .' });
      } else if (res?.error === 'ALREADY_PENDING') {
        setResult({ success: false, message: 'An excuse request for this formation date has already been submitted and is pending admin review.' });
      } else {
        setResult({ success: false, message: res?.message || 'Submission failed. Please check your connection and try again.' });
      }
    } catch (err) {
      setResult({ success: false, message: `Error submitting excuse: ${err?.message || 'Unexpected network error'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-excuse-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: isLight ? '#ffffff' : '#1e293b',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={18} color="#d97706" />
            </div>
            <div>
              <h2
                id="file-excuse-modal-title"
                style={{
                  margin: 0,
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  color: isLight ? '#1e293b' : '#f1f5f9',
                  fontFamily: 'inherit'
                }}
              >
                File Excuse Request
              </h2>
              <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                For formation absence on an official drill date
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isLight ? '#64748b' : '#94a3b8',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Date Selection Dropdown */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label
              htmlFor="excuse-formation-date-select"
              style={{ fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#374151' : '#cbd5e1' }}
            >
              Formation Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {/* Dynamic policy badge pulling directly from system_settings.excuse_grace_period_days */}
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: isLight ? '#b45309' : '#fbbf24',
                background: isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.2)',
                border: `1px solid ${isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.4)'}`,
                padding: '2px 8px',
                borderRadius: '9999px',
                letterSpacing: '0.02em'
              }}
            >
              Policy: {gracePeriodDays} {gracePeriodDays === 1 ? 'Day' : 'Days'} Filing Window
            </span>
          </div>

          <select
            id="excuse-formation-date-select"
            value={selectedDate}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDate(val);
              setResult(null);
            }}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.15)',
              background: isLight ? '#f9fafb' : '#0f172a',
              color: isLight ? '#1e293b' : '#f8fafc',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          >
            {allOptions.length === 0 ? (
              <option value="" disabled>No formation absence records found</option>
            ) : (
              allOptions.map(opt => (
                <option
                  key={opt.date}
                  value={opt.date}
                  style={{
                    color: opt.type !== 'ELIGIBLE' ? (isLight ? '#64748b' : '#94a3b8') : (isLight ? '#1e293b' : '#f8fafc'),
                    background: isLight ? '#ffffff' : '#1e293b',
                    fontWeight: opt.type === 'ELIGIBLE' ? 700 : 500
                  }}
                >
                  {opt.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Dynamic Contextual View based on the selected date */}
        {selectedDateStatus === 'PENDING' ? (
          /* 1. PENDING REVIEW VIEW: Excuse Request Pending HQ Review */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '1.75rem 1.25rem',
              background: isLight
                ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.14) 100%)',
              border: isLight ? '1.5px solid #fde68a' : '1.5px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '14px',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.2)',
                border: isLight ? '2px solid #fcd34d' : '2px solid rgba(251, 191, 36, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
              }}
            >
              <Clock size={28} color={isLight ? '#d97706' : '#fbbf24'} />
            </div>

            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isLight ? '#92400e' : '#fbbf24' }}>
                Excuse Request Pending Admin Review
              </div>
              <div style={{ fontSize: '0.78rem', color: isLight ? '#b45309' : '#fde68a', marginTop: '2px', fontWeight: 600 }}>
                Formation Date: {formatHumanDate(selectedDate)}
              </div>
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: isLight ? '#92400e' : '#fde68a',
                background: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.25)',
                border: `1px solid ${isLight ? '#fde68a' : 'rgba(245, 158, 11, 0.45)'}`,
                padding: '3px 12px',
                borderRadius: '9999px'
              }}
            >
              STATUS: PENDING HQ REVIEW
            </span>

            <div style={{ fontSize: '0.82rem', color: isLight ? '#78350f' : '#fde68a', lineHeight: 1.5, maxWidth: '420px' }}>
              Your excuse request for this formation date has been submitted online and is currently awaiting verification and review by the Duty Officer / Unit Headquarters.
            </div>

            {pendingExcuseInfo?.reason && (
              <div
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.6)',
                  border: isLight ? '1px solid #fde68a' : '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.78rem',
                  color: isLight ? '#92400e' : '#fde68a',
                  textAlign: 'left',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Submitted Reason:
                </div>
                <div style={{ fontStyle: 'italic', wordBreak: 'break-word' }}>
                  "{pendingExcuseInfo.reason}"
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: '0.72rem',
                color: isLight ? '#b45309' : '#d97706',
                background: isLight ? 'rgba(254, 243, 199, 0.5)' : 'rgba(245, 158, 11, 0.1)',
                padding: '6px 10px',
                borderRadius: '6px',
                lineHeight: 1.4
              }}
            >
              Physical Proof Requirement: Please present supporting documentation (e.g., medical certificate or official excuse letter) to the Duty Officer for final approval.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}>
              {eligibleOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(eligibleOptions[0].date)}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: isLight ? '#d97706' : '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                  }}
                >
                  Switch to Eligible Date ({formatHumanDate(eligibleOptions[0].date)})
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: isLight ? '1px solid #d1d5db' : '1px solid #475569',
                  background: isLight ? '#ffffff' : '#334155',
                  color: isLight ? '#374151' : '#f1f5f9',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : selectedDateStatus === 'EXPIRED' ? (
          /* 2. EXPIRED CARD (When user inspects an expired date beyond grace period) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '1.75rem 1.25rem',
              background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.08)',
              border: isLight ? '1.5px solid #fecaca' : '1.5px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '14px',
              gap: '10px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)',
                border: isLight ? '2px solid #fca5a5' : '2px solid rgba(248, 113, 113, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertOctagon size={28} color={isLight ? '#dc2626' : '#f87171'} />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#991b1b' : '#f87171' }}>
              Filing Window Expired
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: isLight ? '#991b1b' : '#fca5a5',
                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.25)',
                border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.45)'}`,
                padding: '3px 10px',
                borderRadius: '9999px'
              }}
            >
              STATUS: DEADLINE EXCEEDED
            </span>

            <div style={{ fontSize: '0.82rem', color: isLight ? '#7f1d1d' : '#fca5a5', lineHeight: 1.5 }}>
              The official {gracePeriodDays}-day filing window for {formatHumanDate(selectedDate)} has elapsed ({getDaysDiff(selectedDate)} days old). Online excuses can no longer be submitted for this drill date.
            </div>

            {eligibleOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDate(eligibleOptions[0].date)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isLight ? '#d97706' : '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                }}
              >
                Switch to Eligible Date ({formatHumanDate(eligibleOptions[0].date)})
              </button>
            )}
          </div>
        ) : selectedDateStatus === 'REJECTED' ? (
          /* 3. REJECTION VIEW: ONLY shown if user manually selects a rejected date */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '1.75rem 1.25rem',
              background: isLight
                ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.14) 100%)',
              border: isLight ? '1.5px solid #fecaca' : '1.5px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '14px',
              gap: '10px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)',
                border: isLight ? '2px solid #fca5a5' : '2px solid rgba(248, 113, 113, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <XCircle size={28} color={isLight ? '#dc2626' : '#f87171'} />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#991b1b' : '#f87171' }}>
              Excuse Request Rejected
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: isLight ? '#991b1b' : '#fca5a5',
                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.25)',
                border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.45)'}`,
                padding: '3px 10px',
                borderRadius: '9999px'
              }}
            >
              STATUS: ABSENT / REJECTED
            </span>

            <div style={{ fontSize: '0.82rem', color: isLight ? '#7f1d1d' : '#fca5a5', lineHeight: 1.5 }}>
              The excuse request for {formatHumanDate(selectedDate)} was officially reviewed and REJECTED by Admin. Under ROTC regulations, rejected sessions are officially declared ABSENT and cannot be re-filed.
            </div>

            {eligibleOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDate(eligibleOptions[0].date)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isLight ? '#d97706' : '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                }}
              >
                Switch to Eligible Date ({formatHumanDate(eligibleOptions[0].date)})
              </button>
            )}
          </div>
        ) : selectedDateStatus === 'APPROVED' ? (
          /* 4. APPROVED VIEW */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '1.75rem 1.25rem',
              background: isLight
                ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.14) 100%)',
              border: isLight ? '1.5px solid #a7f3d0' : '1.5px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '14px',
              gap: '10px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: isLight ? '#d1fae5' : 'rgba(16, 185, 129, 0.2)',
                border: isLight ? '2px solid #6ee7b7' : '2px solid rgba(52, 211, 153, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle2 size={28} color={isLight ? '#059669' : '#34d399'} />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#065f46' : '#34d399' }}>
              Officially Excused
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: isLight ? '#065f46' : '#34d399',
                background: isLight ? '#d1fae5' : 'rgba(16, 185, 129, 0.25)',
                border: `1px solid ${isLight ? '#6ee7b7' : 'rgba(52, 211, 153, 0.45)'}`,
                padding: '3px 10px',
                borderRadius: '9999px'
              }}
            >
              STATUS: OFFICIALLY EXCUSED
            </span>

            <div style={{ fontSize: '0.82rem', color: isLight ? '#047857' : '#a7f3d0', lineHeight: 1.5 }}>
              The excuse request for {formatHumanDate(selectedDate)} has already been approved by Admin.
            </div>

            {eligibleOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDate(eligibleOptions[0].date)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isLight ? '#059669' : '#10b981',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Switch to Eligible Date ({formatHumanDate(eligibleOptions[0].date)})
              </button>
            )}
          </div>
        ) : eligibleOptions.length === 0 ? (
          /* 5. NO ELIGIBLE ABSENCES CARD (When cadet has no unexcused absences within grace period) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '1.75rem 1.25rem',
              background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.5)',
              border: isLight ? '1.5px solid #e2e8f0' : '1.5px solid #334155',
              borderRadius: '14px',
              gap: '10px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.15)',
                border: isLight ? '2px solid #fca5a5' : '2px solid rgba(248, 113, 113, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertOctagon size={28} color={isLight ? '#dc2626' : '#f87171'} />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#1e293b' : '#f1f5f9' }}>
              No Eligible Absences to File
            </div>

            <div style={{ fontSize: '0.82rem', color: isLight ? '#64748b' : '#94a3b8', lineHeight: 1.5 }}>
              All recorded absences have exceeded the official {gracePeriodDays}-day filing policy window. Online excuse requests must be filed within {gracePeriodDays} days of the formation drill date.
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: '0.5rem',
                padding: '0.55rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: isLight ? '#64748b' : '#475569',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Close Window
            </button>
          </div>
        ) : (
          /* 6. ACTIVE FILING FORM (Default state when cadet has an eligible date selected) */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Reason for Absence Textarea */}
            <div>
              <label
                htmlFor="excuse-reason-textarea"
                style={{ fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#374151' : '#cbd5e1', display: 'block', marginBottom: '6px' }}
              >
                Reason for Absence <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="excuse-reason-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State specific reason for absence (e.g., Medical illness with doctor's certificate, family emergency, academic requirement)..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.15)',
                  background: isLight ? '#f9fafb' : '#0f172a',
                  color: isLight ? '#1e293b' : '#f8fafc',
                  fontSize: '0.84rem',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            {/* Status message */}
            {result && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: result.success
                    ? (isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.15)')
                    : (isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)'),
                  color: result.success
                    ? (isLight ? '#166534' : '#86efac')
                    : (isLight ? '#991b1b' : '#fca5a5'),
                  border: `1px solid ${result.success ? '#a7f3d0' : '#fecaca'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {result.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{result.message}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedDate ||
                !reason.trim() ||
                selectedDateStatus !== 'ELIGIBLE' ||
                getDaysDiff(selectedDate) > gracePeriodDays
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: (
                  isSubmitting ||
                  !selectedDate ||
                  !reason.trim() ||
                  selectedDateStatus !== 'ELIGIBLE' ||
                  getDaysDiff(selectedDate) > gracePeriodDays
                ) ? 'not-allowed' : 'pointer',
                background: (
                  isSubmitting ||
                  !selectedDate ||
                  !reason.trim() ||
                  selectedDateStatus !== 'ELIGIBLE' ||
                  getDaysDiff(selectedDate) > gracePeriodDays
                )
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: (
                  isSubmitting ||
                  !selectedDate ||
                  !reason.trim() ||
                  selectedDateStatus !== 'ELIGIBLE' ||
                  getDaysDiff(selectedDate) > gracePeriodDays
                ) ? 'none' : '0 4px 14px rgba(217, 119, 6, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={15} />
              {isSubmitting ? 'Submitting...' : 'Submit Excuse Request'}
            </button>

            <p style={{ margin: 0, fontSize: '0.72rem', color: isLight ? '#94a3b8' : '#64748b', textAlign: 'center' }}>
              Your request will be reviewed by your unit's commanding officer. You will be notified of the outcome.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default React.memo(FileExcuseModal);
