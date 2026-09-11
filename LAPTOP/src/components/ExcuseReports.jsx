import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Filter,
  Calendar,
  ShieldCheck,
  Clock,
  UserX,
  AlertCircle,
  Check,
  X,
  Edit3,
  CalendarDays,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { useAttendanceData } from '../hooks/useAttendanceData';
import {
  approveExcuseRequest,
  rejectExcuseRequest,
  fetchSettingsFromSupabase,
  fetchAttendanceSessionsFromSupabase,
  fetchDeclaredAbsentCadets
} from '../utils/supabaseClient';
import { toDateKey } from '../utils/attendanceRules';
import DutyOfficerActionModal from './DutyOfficerActionModal';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Format YYYY-MM-DD to friendly student/admin display
const formatFriendlyDate = (dateStr) => {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  try {
    const parts = String(dateStr).trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return dateStr;
  } catch (_) {
    return dateStr;
  }
};

// Calculate dynamic grace period status for pending excuse records
const getGracePeriodStatus = (record, gracePeriodDays = 3) => {
  if (!record || record.status !== 'EXCUSE_PENDING') {
    return { type: 'resolved', text: '—' };
  }

  const baseStr = record.date || (record.submittedAt ? toDateKey(new Date(record.submittedAt)) : null);
  if (!baseStr) {
    return { type: 'resolved', text: '—' };
  }

  try {
    const parts = String(baseStr).split('-');
    if (parts.length !== 3) return { type: 'resolved', text: '—' };

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    // Deadline is the end of the day after adding gracePeriodDays
    const deadline = new Date(year, month, day + Number(gracePeriodDays), 23, 59, 59, 999);
    const now = new Date();

    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) {
      return {
        type: 'expired',
        days: 0,
        label: '🔴 Expired (Auto-Absent)'
      };
    }

    // Check if expiring today (same calendar date as today)
    const today = new Date();
    const isSameDay = deadline.getFullYear() === today.getFullYear() &&
      deadline.getMonth() === today.getMonth() &&
      deadline.getDate() === today.getDate();

    if (isSameDay) {
      return {
        type: 'today',
        days: 0,
        label: '⚠️ Expiring Today'
      };
    }

    // Difference in calendar days
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfDeadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const daysLeft = Math.round((startOfDeadlineDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return {
        type: 'expired',
        days: 0,
        label: '🔴 Expired (Auto-Absent)'
      };
    }

    if (daysLeft === 1) {
      return {
        type: 'warning',
        days: 1,
        label: '⏳ 1 Day Left'
      };
    }

    return {
      type: 'pending',
      days: daysLeft,
      label: `⏳ ${daysLeft} Days Left`
    };
  } catch (_) {
    return { type: 'resolved', text: '—' };
  }
};

export default function ExcuseReports({
  cadets = [],
  attendanceLogs = [],
  onRefresh
}) {
  const { records: hookLogs = [], cadets: hookCadets = [] } = useAttendanceData();
  const effectiveLogs = Array.isArray(attendanceLogs) && attendanceLogs.length > 0 ? attendanceLogs : hookLogs;
  const effectiveCadets = Array.isArray(cadets) && cadets.length > 0 ? cadets : hookCadets;

  // Search & Filter state
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING' | 'EXCUSED' | 'ABSENT'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [selectedBattalion, setSelectedBattalion] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRecordForAction, setSelectedRecordForAction] = useState(null);

  // Grace Period (Days) from settings (default 3)
  const [gracePeriodDays, setGracePeriodDays] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.excuseGracePeriodDays !== undefined) {
          return Number(parsed.excuseGracePeriodDays);
        }
      }
    } catch (_) { }
    return 3;
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const sbSettings = await fetchSettingsFromSupabase();
        if (isMounted && sbSettings) {
          const days = sbSettings.excuse_grace_period_days ?? sbSettings.excuseGracePeriodDays;
          if (days !== undefined && !isNaN(Number(days))) {
            setGracePeriodDays(Number(days));
          }
        }
      } catch (_) { }
    })();
    return () => { isMounted = false; };
  }, []);

  // Build cadet lookup map by ID
  const cadetsMap = useMemo(() => {
    const map = new Map();
    effectiveCadets.forEach(c => {
      const cid = String(c.id || c.cadetId || '').trim().toUpperCase();
      if (cid) map.set(cid, c);
    });
    return map;
  }, [effectiveCadets]);

  // Official attendance sessions from Supabase
  const [dbSessions, setDbSessions] = useState([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    async function loadSessions() {
      setIsSessionsLoading(true);
      try {
        const sessions = await fetchAttendanceSessionsFromSupabase();
        if (!isCancelled && Array.isArray(sessions)) {
          setDbSessions(sessions);
        }
      } catch (err) {
        console.error('[ExcuseReports] Failed to fetch sessions:', err);
      } finally {
        if (!isCancelled) setIsSessionsLoading(false);
      }
    }
    loadSessions();
    return () => { isCancelled = true; };
  }, []);

  // Extract all report rows: EXCUSE_PENDING, EXCUSED, and DECLARED ABSENT
  const excuseRecords = useMemo(() => {
    if (!Array.isArray(effectiveLogs)) return [];

    // 1. Existing logs in attendance_logs (EXCUSE_PENDING, EXCUSED, ABSENT)
    const recordsFromLogs = effectiveLogs
      .filter(log => {
        const st = String(log.status || log.final_daily_status || log.finalDailyStatus || '').toUpperCase();
        return st === 'EXCUSE_PENDING' || st === 'EXCUSED' || st === 'ABSENT' || st.includes('ABSENT');
      })
      .map(log => {
        const cid = String(log.cadet_id || log.cadetId || '').trim().toUpperCase();
        const cadetMeta = cadetsMap.get(cid) || {};
        const rawDate = log.date || log.session_date || log.sessionDate || toDateKey(log.timestamp) || '';
        let st = String(log.status || log.final_daily_status || log.finalDailyStatus || '').toUpperCase();
        if (st.includes('ABSENT')) st = 'ABSENT';
        const cadetReason = log.reason || log.excuse_reason || log.excuseReason || '';

        return {
          id: log.id || `${cid}__${rawDate}`,
          logId: log.id,
          cadetId: cid,
          name: log.name && log.name !== 'UNREGISTERED CADET' ? log.name : (cadetMeta.name || `Cadet ${cid}`),
          rank: log.rank || cadetMeta.rank || 'Cadet',
          battalion: log.battalion || cadetMeta.battalion || '1st Battalion',
          company: log.company || cadetMeta.company || 'Alpha Company',
          platoon: log.platoon || cadetMeta.platoon || '1st Platoon',
          date: rawDate,
          status: st,
          reason: cadetReason || (st === 'ABSENT' ? 'Declared Absent / Excuse Rejected by HQ' : 'No reason provided'),
          excuseReason: cadetReason || (st === 'ABSENT' ? 'Declared Absent / Excuse Rejected by HQ' : 'No reason provided'),
          submittedAt: log.excuse_submitted_at || log.excuseSubmittedAt || log.submitted_at || log.updated_at || log.created_at || null,
          dutyOfficer: log.duty_officer || log.dutyOfficer || 'HQ Duty Officer'
        };
      });

    // 2. Identify registered cadets with unscanned absences on recorded formation sessions
    const sessionDates = Array.from(new Set((dbSessions || []).map(s => s.dateKey || s.session_date || s.sessionDate).filter(Boolean)));
    const existingLogKeys = new Set(effectiveLogs.map(l => {
      const cid = String(l.cadet_id || l.cadetId || '').trim().toUpperCase();
      const d = l.date || l.session_date || toDateKey(l.timestamp);
      return `${cid}_${d}`;
    }));

    const unscannedAbsentees = [];
    sessionDates.forEach(sessionDate => {
      effectiveCadets.forEach(cadet => {
        const cid = String(cadet.id || cadet.cadetId || '').trim().toUpperCase();
        if (!cid) return;
        const key = `${cid}_${sessionDate}`;
        if (!existingLogKeys.has(key)) {
          unscannedAbsentees.push({
            id: `unscanned_${cid}_${sessionDate}`,
            logId: null,
            cadetId: cid,
            name: cadet.name || `Cadet ${cid}`,
            rank: cadet.rank || 'Cadet',
            battalion: cadet.battalion || '1st Battalion',
            company: cadet.company || 'Alpha Company',
            platoon: cadet.platoon || '1st Platoon',
            date: sessionDate,
            status: 'ABSENT',
            reason: 'Unexcused Absence (Did Not Attend Formation)',
            excuseReason: 'Unexcused Absence (Did Not Attend Formation)',
            submittedAt: null,
            dutyOfficer: 'HQ Duty Officer'
          });
        }
      });
    });

    return [...recordsFromLogs, ...unscannedAbsentees].sort((a, b) => {
      const order = { 'EXCUSE_PENDING': 1, 'ABSENT': 2, 'EXCUSED': 3 };
      const diff = (order[a.status] || 99) - (order[b.status] || 99);
      if (diff !== 0) return diff;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [effectiveLogs, cadetsMap, dbSessions, effectiveCadets]);

  // Unique formation dates in excuse records for filter dropdown
  const uniqueDates = useMemo(() => {
    const dates = new Set();
    excuseRecords.forEach(r => { if (r.date) dates.add(r.date); });
    (dbSessions || []).forEach(s => {
      const dk = s.dateKey || s.session_date || s.sessionDate;
      if (dk) dates.add(dk);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [excuseRecords, dbSessions]);

  // Unique battalions for filter dropdown
  const uniqueBattalions = useMemo(() => {
    const bns = new Set();
    excuseRecords.forEach(r => { if (r.battalion) bns.add(r.battalion); });
    return Array.from(bns).sort();
  }, [excuseRecords]);

  // Summary counts
  const pendingCount = useMemo(() => excuseRecords.filter(r => r.status === 'EXCUSE_PENDING').length, [excuseRecords]);
  const excusedCount = useMemo(() => excuseRecords.filter(r => r.status === 'EXCUSED').length, [excuseRecords]);
  const absentCount = useMemo(() => excuseRecords.filter(r => r.status === 'ABSENT').length, [excuseRecords]);


  // Map of all recorded formation dates with metadata (from effectiveLogs, dbSessions, and excuseRecords)
  const recordedDatesMap = useMemo(() => {
    const map = new Map();

    // 1. From attendance logs
    effectiveLogs.forEach(log => {
      const rawDate = log.date || log.session_date || log.sessionDate || toDateKey(log.timestamp) || log.receivedAt;
      const key = toDateKey(rawDate);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          scansCount: 0,
          excusesCount: 0,
          pendingCount: 0
        });
      }
      const entry = map.get(key);
      entry.scansCount += 1;
    });

    // 2. From database sessions
    dbSessions.forEach(session => {
      const key = session.dateKey || (session.date ? toDateKey(session.date) : null);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          scansCount: 0,
          excusesCount: 0,
          pendingCount: 0
        });
      }
    });

    // 3. From excuse records
    excuseRecords.forEach(record => {
      const key = record.date;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          scansCount: 0,
          excusesCount: 0,
          pendingCount: 0
        });
      }
      const entry = map.get(key);
      entry.excusesCount += 1;
      if (record.status === 'EXCUSE_PENDING') {
        entry.pendingCount += 1;
      }
    });

    return map;
  }, [effectiveLogs, dbSessions, excuseRecords]);

  // List of all sorted recorded formation dates (most recent first)
  const recordedDatesList = useMemo(() => {
    return Array.from(recordedDatesMap.keys()).sort((a, b) => b.localeCompare(a));
  }, [recordedDatesMap]);

  const latestRecordedDate = recordedDatesList[0] || null;

  // Calendar popover & month navigator state
  const calendarPopoverRef = useRef(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (uniqueDates.length > 0) {
      const [y, m] = uniqueDates[0].split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const handleToggleCalendar = () => {
    if (!isCalendarOpen) {
      if (selectedDate && selectedDate !== 'ALL') {
        const [y, m] = selectedDate.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          setCalendarMonth(new Date(y, m - 1, 1));
        }
      } else if (recordedDatesList.length > 0) {
        const [y, m] = recordedDatesList[0].split('-').map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          setCalendarMonth(new Date(y, m - 1, 1));
        }
      }
    }
    setIsCalendarOpen(prev => !prev);
  };

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarPopoverRef.current && !calendarPopoverRef.current.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    }
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // Calendar rendering calculations
  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const handlePrevCalMonth = () => {
    setCalendarMonth(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextCalMonth = () => {
    setCalendarMonth(new Date(calYear, calMonth + 1, 1));
  };

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return excuseRecords.filter(item => {
      // Status filter
      if (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING') {
        if (item.status !== 'EXCUSE_PENDING') return false;
      } else if (statusFilter === 'EXCUSED') {
        if (item.status !== 'EXCUSED') return false;
      } else if (statusFilter === 'ABSENT') {
        if (item.status !== 'ABSENT') return false;
      }

      // Date filter
      if (selectedDate !== 'ALL' && item.date !== selectedDate) return false;

      // Battalion filter
      if (selectedBattalion !== 'ALL' && item.battalion !== selectedBattalion) return false;

      // Search query filter (cadet ID, name, company, platoon, reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = item.cadetId.toLowerCase().includes(q);
        const nameMatch = item.name.toLowerCase().includes(q);
        const coMatch = item.company.toLowerCase().includes(q);
        const plMatch = item.platoon.toLowerCase().includes(q);
        const reasonMatch = (item.excuseReason || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !coMatch && !plMatch && !reasonMatch) return false;
      }

      return true;
    });
  }, [excuseRecords, statusFilter, selectedDate, selectedBattalion, searchQuery]);

  // [✅ Approve Excuse] Action Handler
  const handleApprove = useCallback(async (record) => {
    const targetId = record.logId || record.id;
    if (!targetId) return;

    setActionLoadingId(targetId);
    try {
      await approveExcuseRequest(record.logId, record.cadetId, record.date);

      // Optimistically update localStorage to instantly update sidebar badge
      try {
        const local = localStorage.getItem('csu_rotc_master_attendance');
        if (local) {
          const parsed = JSON.parse(local);
          const updated = parsed.map(l => {
            const cidMatch = String(l.cadet_id || l.cadetId || '').toUpperCase() === record.cadetId;
            const dateMatch = (l.date || l.session_date) === record.date;
            if (cidMatch && dateMatch) {
              return { ...l, status: 'EXCUSED', final_daily_status: 'EXCUSED' };
            }
            return l;
          });
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(updated));
          window.dispatchEvent(new Event('local-attendance-update'));
        }
      } catch (_) { }

      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setActionLoadingId(null);
    }
  }, [onRefresh]);

  // [❌ Declare Absent] Action Handler
  const handleDeclareAbsent = useCallback(async (record) => {
    const targetId = record.logId || record.id;
    if (!targetId) return;

    setActionLoadingId(targetId);
    try {
      await rejectExcuseRequest(record.logId, record.cadetId, record.date);

      // Optimistically update localStorage to instantly update sidebar badge
      try {
        const local = localStorage.getItem('csu_rotc_master_attendance');
        if (local) {
          const parsed = JSON.parse(local);
          const updated = parsed.map(l => {
            const cidMatch = String(l.cadet_id || l.cadetId || '').toUpperCase() === record.cadetId;
            const dateMatch = (l.date || l.session_date) === record.date;
            if (cidMatch && dateMatch) {
              return { ...l, status: 'ABSENT', final_daily_status: 'ABSENT', excuse_reason: null };
            }
            return l;
          });
          localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(updated));
          window.dispatchEvent(new Event('local-attendance-update'));
        }
      } catch (_) { }

      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Declare absent error:', err);
    } finally {
      setActionLoadingId(null);
    }
  }, [onRefresh]);

  // Manual refresh trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Top Header Banner: Clean white card matching AttendanceHistory */}
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          padding: '1rem 1.25rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="bg-[#005a36] text-emerald-300 p-2.5 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: '#005a36',
              color: '#6ee7b7',
              padding: '0.625rem',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FileText size={22} className="text-emerald-300" />
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.35rem',
                fontWeight: 800,
                letterSpacing: '0.5px',
                margin: 0,
                color: '#005a36',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              EXCUSE REPORTS & VERIFICATION
              {pendingCount > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 800,
                    background: '#d97706',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    letterSpacing: '0'
                  }}
                >
                  {pendingCount} PENDING
                </span>
              )}
            </h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Official Duty Officer verification queue for cadet absence excuse letters.
            </p>
          </div>
        </div>


      </div>

      {/* Unit Hierarchy Style Tabs: Full-Width Edge-to-Edge Grid Container (2 Columns) */}
      <div
        className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm w-full"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          padding: '0.75rem',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div
          className="grid grid-cols-3 gap-3.5 w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0.875rem',
            width: '100%'
          }}
        >
          {/* 1. PENDING REVIEW */}
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`font-black rounded-xl py-3.5 px-5 transition-all border cursor-pointer flex items-center justify-center gap-3 ${statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING'
              ? 'bg-[#005a36] text-amber-400 border-[#005a36] shadow-md font-black'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '0.75rem',
              fontWeight: 900,
              fontSize: '0.86rem',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              border: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                ? '2px solid #005a36'
                : '1.5px solid #cbd5e1',
              backgroundColor: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                ? '#005a36'
                : '#ffffff',
              color: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                ? '#fbbf24'
                : '#1e293b',
              boxShadow: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                ? '0 4px 14px rgba(0, 90, 54, 0.35), 0 1px 3px rgba(0, 0, 0, 0.1)'
                : '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}
          >
            <Clock
              size={18}
              color={(statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING') ? '#fbbf24' : '#64748b'}
              strokeWidth={2.5}
            />
            <span style={{ whiteSpace: 'nowrap', fontWeight: 900 }}>PENDING REVIEW</span>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 900,
                padding: '2px 9px',
                borderRadius: '9999px',
                backgroundColor: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                  ? '#fbbf24'
                  : pendingCount > 0 ? '#fef3c7' : '#f1f5f9',
                color: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                  ? '#005a36'
                  : pendingCount > 0 ? '#b45309' : '#475569',
                border: (statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING')
                  ? '1px solid #fbbf24'
                  : pendingCount > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease'
              }}
            >
              {pendingCount}
            </span>
          </button>

          {/* 2. APPROVED */}
          <button
            type="button"
            onClick={() => setStatusFilter('EXCUSED')}
            className={`font-black rounded-xl py-3.5 px-5 transition-all border cursor-pointer flex items-center justify-center gap-3 ${statusFilter === 'EXCUSED'
              ? 'bg-[#005a36] text-amber-400 border-[#005a36] shadow-md font-black'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '0.75rem',
              fontWeight: 900,
              fontSize: '0.86rem',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              border: statusFilter === 'EXCUSED'
                ? '2px solid #005a36'
                : '1.5px solid #cbd5e1',
              backgroundColor: statusFilter === 'EXCUSED'
                ? '#005a36'
                : '#ffffff',
              color: statusFilter === 'EXCUSED'
                ? '#fbbf24'
                : '#1e293b',
              boxShadow: statusFilter === 'EXCUSED'
                ? '0 4px 14px rgba(0, 90, 54, 0.35), 0 1px 3px rgba(0, 0, 0, 0.1)'
                : '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}
          >
            <CheckCircle2
              size={18}
              color={statusFilter === 'EXCUSED' ? '#fbbf24' : '#64748b'}
              strokeWidth={2.5}
            />
            <span style={{ whiteSpace: 'nowrap', fontWeight: 900 }}>APPROVED</span>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 900,
                padding: '2px 9px',
                borderRadius: '9999px',
                backgroundColor: statusFilter === 'EXCUSED' ? '#fbbf24' : '#f1f5f9',
                color: statusFilter === 'EXCUSED' ? '#005a36' : '#475569',
                border: statusFilter === 'EXCUSED' ? '1px solid #fbbf24' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease'
              }}
            >
              {excusedCount}
            </span>
          </button>

          {/* 3. DECLARED ABSENT */}
          <button
            type="button"
            onClick={() => setStatusFilter('ABSENT')}
            className={`font-black rounded-xl py-3.5 px-5 transition-all border cursor-pointer flex items-center justify-center gap-3 ${statusFilter === 'ABSENT'
              ? 'bg-[#005a36] text-amber-400 border-[#005a36] shadow-md font-black'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '0.75rem',
              fontWeight: 900,
              fontSize: '0.86rem',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              border: statusFilter === 'ABSENT'
                ? '2px solid #005a36'
                : '1.5px solid #cbd5e1',
              backgroundColor: statusFilter === 'ABSENT'
                ? '#005a36'
                : '#ffffff',
              color: statusFilter === 'ABSENT'
                ? '#fbbf24'
                : '#1e293b',
              boxShadow: statusFilter === 'ABSENT'
                ? '0 4px 14px rgba(0, 90, 54, 0.35), 0 1px 3px rgba(0, 0, 0, 0.1)'
                : '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}
          >
            <UserX
              size={18}
              color={statusFilter === 'ABSENT' ? '#fbbf24' : '#64748b'}
              strokeWidth={2.5}
            />
            <span style={{ whiteSpace: 'nowrap', fontWeight: 900 }}>DECLARED ABSENT</span>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 900,
                padding: '2px 9px',
                borderRadius: '9999px',
                backgroundColor: statusFilter === 'ABSENT' ? '#fbbf24' : '#f1f5f9',
                color: statusFilter === 'ABSENT' ? '#005a36' : '#475569',
                border: statusFilter === 'ABSENT' ? '1px solid #fbbf24' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease'
              }}
            >
              {absentCount}
            </span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search Bar, Echelon & Date Selectors */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '0.75rem 1.15rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}
      >

        {/* Dropdowns & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Calendar Selector Trigger & Popover */}
          <div style={{ position: 'relative' }} ref={calendarPopoverRef}>
            <button
              type="button"
              onClick={handleToggleCalendar}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.42rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '7px',
                border: isCalendarOpen
                  ? '1.5px solid var(--rotc-green-dark, #064e2e)'
                  : selectedDate !== 'ALL'
                    ? '1.5px solid var(--rotc-green-dark, #064e2e)'
                    : '1px solid #cbd5e1',
                background: isCalendarOpen
                  ? '#ecfdf5'
                  : selectedDate !== 'ALL'
                    ? '#f0fdf4'
                    : '#ffffff',
                color: selectedDate !== 'ALL' ? 'var(--rotc-green-dark, #064e2e)' : 'var(--text-dark, #1e293b)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
              title="Open interactive formation calendar"
            >
              <CalendarDays size={15} color="var(--rotc-green-dark, #064e2e)" />
              <span>
                {selectedDate === 'ALL'
                  ? (isSessionsLoading ? 'Loading Sessions...' : 'Calendar Selector')
                  : formatFriendlyDate(selectedDate)}
              </span>
              {selectedDate !== 'ALL' && (
                <span
                  style={{
                    fontSize: '0.66rem',
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontWeight: 800
                  }}
                >
                  FILTERED
                </span>
              )}
              {isSessionsLoading
                ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <ChevronDown size={13} style={{ transform: isCalendarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              }
            </button>

            {/* Custom Restricted Calendar Dropdown Popover */}
            {isCalendarOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 1000,
                  width: '320px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #cbd5e1',
                  padding: '1rem',
                  animation: 'fadeIn 0.15s ease'
                }}
              >
                {/* Calendar Header with Month Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handlePrevCalMonth}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-dark, #1e293b)'
                    }}
                    title="Previous Month"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--rotc-green-dark, #064e2e)' }}>
                    {MONTH_NAMES[calMonth]} {calYear}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextCalMonth}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-dark, #1e293b)'
                    }}
                    title="Next Month"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                {/* Day of Week Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                    <div key={i} style={{ fontSize: '0.7rem', fontWeight: 700, color: i === 0 || i === 6 ? '#059669' : '#64748b' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days Grid: ONLY recorded formation dates are selectable; unrecorded dates disabled */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {/* Empty padding slots before day 1 */}
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <div key={`empty-${idx}`} style={{ height: '34px' }} />
                  ))}

                  {/* Month Days */}
                  {Array.from({ length: daysInCalMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dayKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isRecorded = recordedDatesMap.has(dayKey);
                    const isSelected = selectedDate === dayKey;
                    const meta = recordedDatesMap.get(dayKey);

                    if (isRecorded) {
                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dayKey);
                            setIsCalendarOpen(false);
                          }}
                          style={{
                            height: '34px',
                            borderRadius: '7px',
                            border: isSelected ? '2px solid var(--rotc-green-dark, #064e2e)' : '1px solid #10b981',
                            background: isSelected ? 'var(--rotc-green-dark, #064e2e)' : '#ecfdf5',
                            color: isSelected ? '#ffffff' : '#065f46',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            transition: 'transform 0.1s ease',
                            padding: 0
                          }}
                          title={`Recorded Formation: ${dayKey}${meta ? ` (${meta.excusesCount} excuse records, ${meta.scansCount} scans)` : ''}`}
                        >
                          <span>{dayNum}</span>
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: isSelected ? '#ffffff' : '#059669',
                              marginTop: '1px'
                            }}
                          />
                        </button>
                      );
                    }

                    // Disabled / Unrecorded Day
                    return (
                      <div
                        key={dayKey}
                        style={{
                          height: '34px',
                          borderRadius: '6px',
                          border: '1px solid transparent',
                          background: '#f8fafc',
                          color: '#cbd5e1',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'not-allowed',
                          userSelect: 'none'
                        }}
                        title="No formation recorded on this date"
                      >
                        {dayNum}
                      </div>
                    );
                  })}
                </div>

                {/* Calendar Footer: Clear / Show All Dates & Quick Jump */}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Clear / Show All Dates Reset Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('ALL');
                      setIsCalendarOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: selectedDate === 'ALL' ? '#ecfdf5' : '#f8fafc',
                      border: selectedDate === 'ALL' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: selectedDate === 'ALL' ? '#065f46' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Reset date filter to view all excuses across all dates"
                  >
                    <RotateCcw size={13} color={selectedDate === 'ALL' ? '#059669' : '#64748b'} />
                    <span>Clear / Show All Dates ({excuseRecords.length} records)</span>
                    {selectedDate === 'ALL' && (
                      <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                        ACTIVE
                      </span>
                    )}
                  </button>

                  {/* Jump to Most Recent Recorded Formation */}
                  {latestRecordedDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(latestRecordedDate);
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        color: '#15803d',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>⚡ Jump to Most Recent Formation ({formatFriendlyDate(latestRecordedDate)})</span>
                    </button>
                  )}

                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', marginTop: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
                      <span style={{ color: '#065f46', fontWeight: 600 }}>Formation Recorded</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} />
                      <span>No Formation</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Filter Pill with One-Click Clear */}
          {selectedDate !== 'ALL' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <CalendarCheck size={14} color="#059669" />
              <span>{formatFriendlyDate(selectedDate)}</span>
              <button
                type="button"
                onClick={() => setSelectedDate('ALL')}
                title="Clear date filter"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  cursor: 'pointer',
                  padding: '1px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Battalion Filter */}
          {uniqueBattalions.length > 1 && (
            <select
              value={selectedBattalion}
              onChange={e => setSelectedBattalion(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#334155',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Battalions</option>
              {uniqueBattalions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              minWidth: '220px'
            }}
          >
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by Cadet ID, name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.8rem',
                width: '100%',
                color: '#1e293b'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Focused Table View: Display ONLY cadets with excuse requests (EXCUSE_PENDING or EXCUSED) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            maxHeight: '600px',
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative'
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: '1050px',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.84rem'
            }}
          >
            <thead
              className="bg-[#005a36] text-white"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                backgroundColor: '#005a36',
                color: '#ffffff',
                borderBottom: '2px solid #004529',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <tr>
                <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cadet ID</th>
                <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cadet Name</th>
                <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Drill Date</th>
                <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  DATE FILED
                </th>
                {statusFilter === 'EXCUSED' || statusFilter === 'ABSENT' ? (
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', maxWidth: '320px' }}>Reasons</th>
                ) : (
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GRACE PERIOD REMAINING</th>
                )}
                <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                {(statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING') && (
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                    ACTION
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={(statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING') ? 7 : 6} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <FileText size={36} color="#94a3b8" />
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                        {statusFilter === 'ABSENT' ? 'No Declared Absent Cadets Found' : 'No Excuse Requests Found'}
                      </div>
                      <div style={{ fontSize: '0.82rem', maxWidth: '380px' }}>
                        {statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING'
                          ? 'There are currently no pending excuse requests awaiting Duty Officer verification.'
                          : statusFilter === 'ABSENT'
                          ? 'There are currently no cadets flagged as declared absent without excuse.'
                          : 'No excuse letter submissions match your current filters.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const isPending = record.status === 'EXCUSE_PENDING';
                  const isExcused = record.status === 'EXCUSED';
                  const isLoading = actionLoadingId === (record.logId || record.id);

                  return (
                    <tr
                      key={record.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'; }}
                    >
                      {/* Cadet ID */}
                      <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            color: '#064e2e',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          {record.cadetId}
                        </span>
                      </td>

                      {/* Cadet Name & Rank */}
                      <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                          {record.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {record.rank}
                        </div>
                      </td>

                      {/* Drill Date */}
                      <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
                          {formatFriendlyDate(record.date)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {record.date}
                        </div>
                      </td>

                      {/* Date Filed */}
                      <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                        {record.submittedAt ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
                              {new Date(record.submittedAt).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                              {new Date(record.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>—</span>
                        )}
                      </td>

                      {/* Approved / Absent View: Reason column / Pending View: Grace Period Remaining */}
                      {statusFilter === 'EXCUSED' || statusFilter === 'ABSENT' ? (
                        <td style={{ padding: '0.85rem 1.15rem', maxWidth: '320px' }}>
                          <div
                            style={{
                              fontSize: '0.84rem',
                              color: '#334155',
                              lineHeight: 1.4,
                              wordBreak: 'break-word'
                            }}
                            title={record.reason || record.excuseReason || 'No reason provided'}
                          >
                            {record.reason || record.excuseReason || 'No reason provided'}
                          </div>
                        </td>
                      ) : (
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const gp = getGracePeriodStatus(record, gracePeriodDays);
                            if (gp.type === 'resolved') {
                              return <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem' }}>—</span>;
                            }
                            if (gp.type === 'expired') {
                              return (
                                <span
                                  style={{
                                    color: '#b91c1c',
                                    fontWeight: 800,
                                    fontSize: '0.82rem'
                                  }}
                                >
                                  {gp.label}
                                </span>
                              );
                            }
                            if (gp.type === 'today') {
                              return (
                                <span
                                  style={{
                                    color: '#b45309',
                                    fontWeight: 800,
                                    fontSize: '0.82rem'
                                  }}
                                >
                                  {gp.label}
                                </span>
                              );
                            }
                            if (gp.type === 'warning') {
                              return (
                                <span
                                  style={{
                                    color: '#d97706',
                                    fontWeight: 800,
                                    fontSize: '0.82rem'
                                  }}
                                >
                                  {gp.label}
                                </span>
                              );
                            }
                            return (
                              <span
                                style={{
                                  color: '#334155',
                                  fontWeight: 700,
                                  fontSize: '0.82rem'
                                }}
                              >
                                {gp.label}
                              </span>
                            );
                          })()}
                        </td>
                      )}

                      {/* Status Badge */}
                      <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                        {isPending ? (
                          <span
                            className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-900 border border-purple-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                            style={{
                              background: '#faf5ff',
                              color: '#581c87',
                              borderColor: '#d8b4fe',
                              borderRadius: '9999px',
                              fontWeight: 900,
                              fontSize: '11px',
                              letterSpacing: '0.025em',
                              padding: '4px 12px'
                            }}
                          >
                            <Clock size={12} />
                            <span>EXCUSE PENDING</span>
                          </span>
                        ) : isExcused ? (
                          <span
                            className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-800 border border-sky-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                            style={{
                              background: '#f0f9ff',
                              color: '#075985',
                              borderColor: '#7dd3fc',
                              borderRadius: '9999px',
                              fontWeight: 900,
                              fontSize: '11px',
                              letterSpacing: '0.025em',
                              padding: '4px 12px'
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>EXCUSED</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                            style={{
                              background: '#fee2e2',
                              color: '#991b1b',
                              borderColor: '#fca5a5',
                              borderRadius: '9999px',
                              fontWeight: 900,
                              fontSize: '11px',
                              letterSpacing: '0.025em',
                              padding: '4px 12px'
                            }}
                          >
                            <UserX size={12} />
                            <span>ABSENT</span>
                          </span>
                        )}
                      </td>

                      {/* Action Column (Pending View Only) */}
                      {(statusFilter === 'PENDING' || statusFilter === 'EXCUSE_PENDING') && (
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedRecordForAction(record)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-colors shadow-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.38rem 0.75rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: '#047857',
                              backgroundColor: '#ecfdf5',
                              border: '1px solid rgba(167, 243, 208, 0.8)',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Open Duty Officer Verification Modal"
                          >
                            <Edit3 size={12} color="#047857" />
                            <span>Action</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: '#64748b'
          }}
        >
          <div>
            Showing <strong>{filteredRecords.length}</strong> of <strong>{excuseRecords.length}</strong> excuse requests
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Policy: Grace period and physical letter deadline enforced by HQ</span>
          </div>
        </div>
      </div>

      {/* Duty Officer Verification Modal */}
      {selectedRecordForAction && (
        <DutyOfficerActionModal
          isOpen={Boolean(selectedRecordForAction)}
          record={selectedRecordForAction}
          gracePeriodDays={gracePeriodDays}
          onClose={() => setSelectedRecordForAction(null)}
          onApprove={async (rec) => {
            await handleApprove(rec);
            setSelectedRecordForAction(null);
          }}
          onDeclareAbsent={async (rec) => {
            await handleDeclareAbsent(rec);
            setSelectedRecordForAction(null);
          }}
          isLoading={actionLoadingId === (selectedRecordForAction.logId || selectedRecordForAction.id)}
        />
      )}
    </div>
  );
}
