import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Shield,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  LogOut,
  X,
  Award,
  BookOpen,
  RefreshCw,
  Search,
  ChevronRight,
  Activity,
  HelpCircle,
  MapPin,
  FileText,
  Sun,
  Moon,
  Phone,
  GraduationCap,
  Users,
  Info,
  Download,
  Printer,
  Send,
  Upload
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  fetchCadetAttendanceHistory,
  fetchSettingsFromSupabase,
  fetchMandatoryFormationDates,
  fetchAttendanceSessionsFromSupabase,
  fetchCadetByCadetId,
  submitExcuseRequest,
  subscribeToPortalRealtime
} from '../utils/supabaseClient';
import CadetPortalHeader from './CadetPortalHeader';
import { evaluateCadetAttendance, calculateCadetAbsences, toDateKey } from '../utils/attendanceRules';
import { formatDisplayTime, parseTimeToMinutes, parseCutoffMinutes } from '../utils/attendanceStatus';
import IDCardPreview from './IDCardPreview';
import MilitaryLoader from './MilitaryLoader';
import FormationCalendarSelector from './FormationCalendarSelector';

// Format YYYY-MM-DD into a friendly, student-readable date (e.g., "Thu, Sep 3, 2026")
const formatFriendlyDate = (dateStr) => {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
  } catch (_) { }
  return dateStr;
};

// Format cutoff time string into 12-hour format (e.g., "20:00" -> "08:00 PM", "16:00" -> "04:00 PM", "07:30" -> "07:30 AM")
const formatCutoffDisplay = (cutoffStr) => {
  if (!cutoffStr) return '07:30 AM';
  const str = String(cutoffStr).trim();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const ampmSpec = ampmMatch[3];
    if (ampmSpec) {
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampmSpec.toUpperCase()}`;
    }
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return str;
};

export default function CadetPortal({ cadet, onLogout }) {
  const cid = cadet?.id || cadet?.cadetId || cadet?.cadet_id || cadet?.student_id;
  const [cadetProfile, setCadetProfile] = useState(cadet || {});
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      try {
        localStorage.removeItem('csu_rotc_cadet_session');
      } catch (_) { }
      if (onLogout) {
        onLogout();
      }
    }, 750);
  };

  // 1. Instant Cache Initialization (0ms UI render)
  const [logs, setLogs] = useState(() => {
    if (!cid) return [];
    try {
      const cached = localStorage.getItem(`csu_rotc_cadet_logs_${cid}`);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const [formationDates, setFormationDates] = useState(() => {
    try {
      const cached = localStorage.getItem('csu_rotc_formation_dates');
      const parsed = cached ? JSON.parse(cached) : [];
      if (Array.isArray(parsed) && parsed.length >= 6 && parsed.includes('2026-08-22')) {
        localStorage.removeItem('csu_rotc_formation_dates');
        return [];
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });

  const [dbSessions, setDbSessions] = useState(() => {
    try {
      const cached = localStorage.getItem('csu_rotc_db_sessions');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  // Only show blocking loader if we have ZERO cached logs to display
  const [loadingLogs, setLoadingLogs] = useState(() => {
    if (!cid) return true;
    try {
      const cached = localStorage.getItem(`csu_rotc_cadet_logs_${cid}`);
      return !cached || JSON.parse(cached).length === 0;
    } catch (_) {
      return true;
    }
  });

  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const passCardRef = useRef(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchDate, setSearchDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAlertDetails, setShowAlertDetails] = useState(false);

  // Excuse Request Modal state
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [excuseForm, setExcuseForm] = useState({ targetDate: '', reason: '' });
  const [excuseSubmitting, setExcuseSubmitting] = useState(false);
  const [excuseResult, setExcuseResult] = useState(null); // { success: bool, message: string }




  // Dark / Light Mode state persisted in localStorage
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('csu_rotc_cadet_theme') || 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('csu_rotc_cadet_theme', nextTheme);
    } catch (_) { }
  };

  const isLight = theme === 'light';

  // Theme Design Tokens
  const t = {
    bg: isLight ? '#f1f5f9' : '#0b1320',
    cardBg: isLight ? '#ffffff' : '#162032',
    cardBorder: isLight ? '#e2e8f0' : '#283548',
    cardShadow: isLight ? '0 2px 10px rgba(0, 0, 0, 0.05)' : '0 4px 20px rgba(0, 0, 0, 0.2)',
    insetBg: isLight ? '#f8fafc' : '#0f172a',
    insetBorder: isLight ? '#cbd5e1' : '#334155',
    textMain: isLight ? '#0f172a' : '#f8fafc',
    textMuted: isLight ? '#64748b' : '#94a3b8',
    textSubtle: isLight ? '#94a3b8' : '#64748b',
    headerBg: '#064e2e',
    tableHeadBg: isLight ? '#f8fafc' : '#0f172a',
    tableRowBorder: isLight ? '#e2e8f0' : '#283548',
    tableAltRow: isLight ? '#fcfdfd' : 'rgba(255, 255, 255, 0.015)',
    filterPillInactiveBg: isLight ? '#f1f5f9' : '#1e293b',
    filterPillInactiveBorder: isLight ? '#cbd5e1' : '#334155',
    filterStripBg: isLight ? '#f8fafc' : '#0f172a'
  };

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const loadData = async (isManual = false) => {
    const activeCid = cadet?.id || cadet?.cadetId || cadet?.cadet_id || cadet?.student_id;
    if (!activeCid) return;

    // If cached data is present, sync quietly without blocking the screen
    if (logs.length > 0 && !isManual) {
      setIsBackgroundSyncing(true);
    } else {
      setLoadingLogs(true);
    }

    try {
      const [historyLogs, sbSettings, mDates, sessionsRes, liveCadetRes] = await Promise.allSettled([
        fetchCadetAttendanceHistory(activeCid, true), // Always fetch fresh attendance & excuse status from cloud
        fetchSettingsFromSupabase(true), // Always fetch fresh settings from cloud to immediately adopt admin changes
        fetchMandatoryFormationDates(isManual),
        fetchAttendanceSessionsFromSupabase(true), // Always fetch fresh sessions from cloud
        fetchCadetByCadetId(activeCid)
      ]);

      if (historyLogs.status === 'fulfilled' && Array.isArray(historyLogs.value)) {
        setLogs(historyLogs.value);
        try {
          localStorage.setItem(`csu_rotc_cadet_logs_${activeCid}`, JSON.stringify(historyLogs.value));
        } catch (_) { }
      }
      if (sbSettings.status === 'fulfilled' && sbSettings.value) {
        setSettings(sbSettings.value);
      }
      if (mDates.status === 'fulfilled' && Array.isArray(mDates.value)) {
        setFormationDates(mDates.value);
      }
      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)) {
        setDbSessions(sessionsRes.value);
      }
      if (liveCadetRes.status === 'fulfilled' && liveCadetRes.value) {
        setCadetProfile(prev => ({ ...prev, ...liveCadetRes.value }));
      }
    } catch (err) {
      console.warn('Error loading cadet portal data:', err);
    } finally {
      setLoadingLogs(false);
      setRefreshing(false);
      setIsBackgroundSyncing(false);
    }
  };

  useEffect(() => {
    // Initial mount data load
    loadData(false);

    // 1. Cross-tab local sync (0ms instant sync if admin changes settings in another tab)
    const handleStorageOrLocalUpdate = (e) => {
      if (e?.type === 'csu_settings_updated' && e?.detail) {
        setSettings(e.detail);
      }
      loadData(true);
    };

    window.addEventListener('storage', handleStorageOrLocalUpdate);
    window.addEventListener('csu_settings_updated', handleStorageOrLocalUpdate);

    // 2. Supabase Realtime: instant push notification when Admin updates system_settings or sessions
    const realtimeChannel = subscribeToPortalRealtime({
      onSettingsChange: (payload) => {
        if (payload?.new) {
          setSettings(payload.new);
        }
        loadData(true);
      },
      onSessionsChange: () => {
        loadData(true);
      },
      onAttendanceChange: () => {
        loadData(true);
      }
    });

    // 3. Tab visibility / window focus: refresh immediately when student switches back to portal tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 4. Fallback heartbeat (every 15s while tab is visible) to guarantee zero desynchronization
    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('storage', handleStorageOrLocalUpdate);
      window.removeEventListener('csu_settings_updated', handleStorageOrLocalUpdate);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(heartbeatTimer);
      if (realtimeChannel && typeof realtimeChannel.unsubscribe === 'function') {
        realtimeChannel.unsubscribe();
      }
    };
  }, [cadet?.id, cadet?.cadetId, cadet?.cadet_id, cadet?.student_id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleStatusCardClick = (status) => {
    setStatusFilter(prev => prev === status ? 'ALL' : status);
  };

  // Map each formation date to its actual dynamic session cut-off time configured in the database
  const sessionCutoffsByDate = useMemo(() => {
    const map = new Map();
    // 1. From database attendance_sessions (primary source matching Admin HQ)
    (dbSessions || []).forEach(s => {
      const dk = s.dateKey || s.session_date || s.sessionDate;
      const cutoff = s.cutoffTime || s.cutoff_time;
      if (dk && cutoff) {
        map.set(dk, cutoff);
      }
    });
    // 2. From logs if individual scan payload recorded cutoff_time
    (logs || []).forEach(l => {
      const rawD = l.date || l.session_date || l.timestamp;
      const dk = toDateKey ? toDateKey(rawD) : rawD;
      const cutoff = l.cutoff_time || l.cutoffTime;
      if (dk && cutoff && !map.has(dk)) {
        map.set(dk, cutoff);
      }
    });
    return map;
  }, [dbSessions, logs]);

  // Reconcile logs with dynamic sessionCutoffsByDate so updating the cutoff time immediately re-evaluates Present vs Late
  const reconciledLogs = useMemo(() => {
    const globalCutoff = settings?.formation_cutoff_time || settings?.morningCutoffTime || settings?.formationCutoffTime || '07:30';
    const todayStr = toDateKey ? toDateKey(new Date()) : new Date().toISOString().slice(0, 10);

    return (logs || []).map(log => {
      const rawD = log.date || log.session_date || log.timestamp;
      const dk = toDateKey ? toDateKey(rawD) : rawD;

      // Dynamic Cutoff resolution:
      // For today: always prioritize live admin settings override or today's session cutoff
      let dynamicCutoff = null;
      if (dk === todayStr) {
        dynamicCutoff = globalCutoff || sessionCutoffsByDate.get(dk);
      } else {
        dynamicCutoff = sessionCutoffsByDate.get(dk) || log.cutoff_time || log.cutoffTime || globalCutoff;
      }
      if (!dynamicCutoff) dynamicCutoff = globalCutoff || '07:30';

      const timeInVal = log.time_in || log.timeIn;

      if (dynamicCutoff && timeInVal) {
        const timeInMins = parseTimeToMinutes(timeInVal);
        const cutoffMins = parseCutoffMinutes(dynamicCutoff);
        if (!isNaN(timeInMins) && !isNaN(cutoffMins)) {
          const isActuallyLate = timeInMins > cutoffMins;
          const currentStatus = String(log.final_daily_status || log.status || '').toUpperCase();
          if (!currentStatus.includes('EXCUSE')) {
            const hasOut = Boolean(log.time_out || log.timeOut);
            const newStatus = isActuallyLate
              ? (hasOut ? 'LATE (Complete)' : 'LATE / NO TIME-OUT')
              : (hasOut ? 'PRESENT (Complete)' : 'NO TIME-OUT');
            return {
              ...log,
              cutoff_time: dynamicCutoff,
              isLate: isActuallyLate,
              status: isActuallyLate ? 'LATE' : 'PRESENT',
              final_daily_status: newStatus
            };
          }
        }
      }
      return log;
    });
  }, [logs, sessionCutoffsByDate, settings?.formation_cutoff_time, settings?.morningCutoffTime, settings?.formationCutoffTime]);

  // 1. Official ROTC Rule Engine Evaluation
  const evaluated = useMemo(() => {
    return calculateCadetAbsences(
      {
        ...cadet,
        attendance_logs: reconciledLogs
      },
      formationDates
    );
  }, [cadet, reconciledLogs, formationDates]);

  // Determine official drop, warning, and penalty states
  const isDropped = Boolean(
    evaluated?.status === 'DROPPED' ||
    cadet?.status === 'DROPPED' ||
    cadet?.enrollment_status === 'DROPPED' ||
    cadet?.is_dropped
  );

  const isPenalty = !isDropped && Boolean(
    evaluated?.status === 'PENALTY / WARNING' ||
    evaluated?.status?.includes('PENALTY') ||
    evaluated?.badgeLabel?.startsWith('Penalized')
  );

  const isWarning = !isDropped && !isPenalty && Boolean(
    evaluated?.status === 'WARNING' ||
    (evaluated?.totalAbsences || 0) >= 2 ||
    cadet?.status === 'WARNING'
  );

  // 2. Synchronized Attendance Metrics
  const metrics = useMemo(() => {
    const daily = evaluated?.dailyBreakdown || [];
    // Total Drill Sessions: Total drill events published in Supabase
    const totalFormations = evaluated?.totalFormations || daily.length || formationDates.length || logs.length || 0;

    const onTimeCount = daily.filter(d =>
      d.isRecorded && String(d.status || '').toUpperCase() === 'PRESENT'
    ).length;

    const lateCount = daily.filter(d =>
      d.isRecorded && String(d.status || '').toUpperCase().includes('LATE')
    ).length;

    // Converted Absences: Raw Absences + ⌊Missing Scans/4⌋ + ⌊Interval Lates/4⌋ + ⌊Consecutive Lates/3⌋
    const convertedAbsences = evaluated?.convertedAbsences ?? evaluated?.totalAbsences ?? 0;
    const unexcused = evaluated?.rawAbsences ?? evaluated?.unexcusedAbsences ?? 0;
    const lates = lateCount || evaluated?.totalIntervalLates || 0;
    const missingScans = evaluated?.totalIntervalMissingScans || 0;
    const maxConsecutive = evaluated?.maxConsecutiveAbsences || 0;

    // Adjusted Attendance Rate: ((Total Formations - Converted Absences) / Total Formations) * 100
    const complianceRate = evaluated?.adjustedAttendanceRate ?? (
      totalFormations > 0
        ? Math.max(0, Math.min(100, Math.round(((totalFormations - convertedAbsences) / totalFormations) * 100)))
        : 100
    );

    return {
      totalFormations,
      attendedSessions: Math.max(0, totalFormations - convertedAbsences),
      presentDays: onTimeCount,
      lates: lateCount,
      missingScans,
      absences: convertedAbsences,
      unexcused,
      maxConsecutive,
      complianceRate,
      status: isDropped ? 'DROPPED' : isPenalty ? (evaluated?.badgeLabel || 'PENALTY / WARNING') : isWarning ? 'WARNING' : 'GOOD',
      reason: evaluated?.reason
    };
  }, [evaluated, formationDates, logs, isDropped, isPenalty, isWarning]);

  const isValidTime = useCallback((val) => {
    if (!val) return false;
    const s = String(val).trim().toUpperCase();
    return s !== '' && s !== '—' && s !== '-' && s !== 'NO TIME-OUT' && s !== 'NO TIME-IN' && s !== 'NULL' && s !== 'UNDEFINED';
  }, []);

  const isExcuseRecord = useCallback((s) => {
    if (!s) return false;
    const st = String(s.status || s.dayType || s.attendanceStatus || '').toUpperCase();
    return Boolean(s.isExcuse || s.is_excuse || st === 'EXCUSED' || st === 'APPROVED' || st === 'EXCUSE_PENDING' || st === 'PENDING' || st.includes('EXCUSE'));
  }, []);

  const checkIsLate = useCallback((s) => {
    if (!s || !s.isRecorded) return false;
    if (isExcuseRecord(s)) return false;

    const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
    if (!hasIn) return false;

    const st = String(s.status || s.dayType || s.final_daily_status || '').toUpperCase();
    // Matches compound statuses like 'LATE / NO TIME-OUT', 'LATE (COMPLETE)', 'LATE (TARDY)', etc.
    if (st.includes('LATE') || s.dayType === 'LATE' || Boolean(s.isLate)) return true;

    // Dynamic cutoff evaluation fallback
    const rawDate = s.date || s.session_date;
    const todayStr = toDateKey ? toDateKey(new Date()) : new Date().toISOString().slice(0, 10);
    const activeCutoffTime = settings?.formation_cutoff_time || settings?.formationCutoffTime || settings?.morningCutoffTime || '07:30';
    const sessionCutoff = (rawDate === todayStr ? activeCutoffTime : (sessionCutoffsByDate?.get(rawDate) || s.cutoffTime || s.cutoff_time || activeCutoffTime)) || activeCutoffTime;

    if (sessionCutoff && s.timeIn) {
      try {
        const timeInMins = parseTimeToMinutes(s.timeIn);
        const cutoffMins = parseCutoffMinutes(sessionCutoff);
        if (!isNaN(timeInMins) && !isNaN(cutoffMins)) {
          return timeInMins > cutoffMins;
        }
      } catch (_) { }
    }
    return false;
  }, [isExcuseRecord, isValidTime, sessionCutoffsByDate, settings?.formation_cutoff_time, settings?.formationCutoffTime, settings?.morningCutoffTime]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const all = evaluated?.dailyBreakdown || [];

    const excused = all.filter(s => isExcuseRecord(s)).length;

    const present = all.filter(s => {
      if (!s.isRecorded || isExcuseRecord(s)) return false;
      const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
      const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
      const st = String(s.status || s.dayType || '').toUpperCase();
      return hasIn && hasOut && !checkIsLate(s) && !st.includes('ABSENT');
    }).length;

    const late = all.filter(s => checkIsLate(s)).length;

    // Incomplete Scans: Captures BOTH missing Time-In (!hasTimeIn && hasTimeOut) and missing Time-Out (hasTimeIn && !hasTimeOut)
    const noTimeOut = all.filter(s => {
      if (!s.isRecorded || isExcuseRecord(s)) return false;
      const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
      const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
      const st = String(s.status || s.dayType || '').toUpperCase();
      const isMissingTimeOut = (hasIn && !hasOut) || st.includes('NO TIME-OUT') || s.dayType === 'NO TIME-OUT';
      const isMissingTimeIn = (!hasIn && hasOut) || st.includes('NO TIME-IN') || s.dayType === 'NO TIME-IN';
      return isMissingTimeOut || isMissingTimeIn;
    }).length;

    // Converted Absences reflected in absent count (excluding excused sessions)
    const absent = evaluated?.convertedAbsences !== undefined
      ? evaluated.convertedAbsences
      : (evaluated?.totalAbsences ?? all.filter(s => {
        if (isExcuseRecord(s)) return false;
        if (!s.isRecorded) return true;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return (!hasIn && !hasOut) || st.includes('ABSENT') || s.dayType === 'UNRECORDED' || s.dayType === 'ABSENT';
      }).length);

    return { all: all.length, present, late, noTimeOut, absent, excused };
  }, [evaluated, isExcuseRecord, isValidTime, checkIsLate]);

  // Grace Period Days from system settings (Policy: 4-Day Filing Window)
  const gracePeriodDays = useMemo(() => {
    if (settings?.excuse_grace_period_days !== undefined && !isNaN(Number(settings.excuse_grace_period_days))) {
      return Number(settings.excuse_grace_period_days);
    }
    if (settings?.excuseGracePeriodDays !== undefined && !isNaN(Number(settings.excuseGracePeriodDays))) {
      return Number(settings.excuseGracePeriodDays);
    }
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const val = parsed.excuse_grace_period_days ?? parsed.excuseGracePeriodDays;
        if (val !== undefined && !isNaN(Number(val))) return Number(val);
      }
    } catch (_) { }
    return 4; // Policy: 4-Day Filing Window
  }, [settings]);

  // Cutoff Date string: Today's date minus GRACE_PERIOD_DAYS
  const graceCutoffDateStr = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - gracePeriodDays);
    const y = cutoff.getFullYear();
    const m = String(cutoff.getMonth() + 1).padStart(2, '0');
    const d = String(cutoff.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [gracePeriodDays]);

  // Collect all drill dates that have an active excuse request pending admin review (status: EXCUSE_PENDING or PENDING)
  // CRITICAL REQUIREMENT: Do NOT flag APPROVED or EXCUSED requests as pending!
  const pendingExcuseDatesMap = useMemo(() => {
    const map = new Map();
    // 1. Raw / Reconciled attendance logs
    (logs || []).forEach(l => {
      const rawD = l.date || l.session_date || l.timestamp;
      const dk = toDateKey ? toDateKey(rawD) : (rawD ? String(rawD).slice(0, 10) : '');
      if (!dk) return;
      const st = String(l.status || l.final_daily_status || '').trim().toUpperCase();
      const exSt = String(l.excuse_status || l.excuseStatus || '').trim().toUpperCase();
      // Skip if approved or excused
      if (st === 'APPROVED' || st === 'EXCUSED' || exSt === 'APPROVED' || exSt === 'EXCUSED') {
        return;
      }
      if (st === 'EXCUSE_PENDING' || st === 'PENDING' || exSt === 'EXCUSE_PENDING' || exSt === 'PENDING') {
        map.set(dk, { date: dk, status: 'EXCUSE_PENDING', reason: l.excuse_reason || l.reason || '' });
      }
    });
    // 2. Evaluated daily breakdown records
    (evaluated?.dailyBreakdown || []).forEach(entry => {
      const dk = toDateKey ? toDateKey(entry.date) : (entry.date ? String(entry.date).slice(0, 10) : '');
      if (!dk) return;
      const st = String(entry.status || entry.dayType || entry.final_daily_status || '').trim().toUpperCase();
      const exSt = String(entry.excuse_status || entry.excuseStatus || '').trim().toUpperCase();
      // Skip if approved or excused
      if (st === 'APPROVED' || st === 'EXCUSED' || exSt === 'APPROVED' || exSt === 'EXCUSED') {
        return;
      }
      if (st === 'EXCUSE_PENDING' || st === 'PENDING' || exSt === 'EXCUSE_PENDING' || exSt === 'PENDING') {
        if (!map.has(dk)) {
          map.set(dk, { date: dk, status: 'EXCUSE_PENDING', reason: entry.excuseReason || '' });
        }
      }
    });
    return map;
  }, [logs, evaluated?.dailyBreakdown]);

  // Backward compatibility alias for submittedExcuseDatesMap pointing strictly to pending dates
  const submittedExcuseDatesMap = pendingExcuseDatesMap;

  // Collect all drill dates where excuse request was APPROVED or EXCUSED by Admin HQ
  const approvedExcuseDatesMap = useMemo(() => {
    const map = new Map();
    // 1. Raw / Reconciled attendance logs
    (logs || []).forEach(l => {
      const rawD = l.date || l.session_date || l.timestamp;
      const dk = toDateKey ? toDateKey(rawD) : (rawD ? String(rawD).slice(0, 10) : '');
      if (!dk) return;
      const st = String(l.status || l.final_daily_status || '').trim().toUpperCase();
      const exSt = String(l.excuse_status || l.excuseStatus || '').trim().toUpperCase();
      if (st === 'APPROVED' || st === 'EXCUSED' || exSt === 'APPROVED' || exSt === 'EXCUSED') {
        map.set(dk, { date: dk, status: 'EXCUSED', reason: l.excuse_reason || l.reason || 'Approved by Admin HQ' });
      }
    });
    // 2. Evaluated daily breakdown records
    (evaluated?.dailyBreakdown || []).forEach(entry => {
      const dk = toDateKey ? toDateKey(entry.date) : (entry.date ? String(entry.date).slice(0, 10) : '');
      if (!dk) return;
      const st = String(entry.status || entry.dayType || entry.final_daily_status || '').trim().toUpperCase();
      const exSt = String(entry.excuse_status || entry.excuseStatus || '').trim().toUpperCase();
      if (st === 'APPROVED' || st === 'EXCUSED' || exSt === 'APPROVED' || exSt === 'EXCUSED') {
        if (!map.has(dk)) {
          map.set(dk, { date: dk, status: 'EXCUSED', reason: entry.excuseReason || entry.reason || 'Approved by Admin HQ' });
        }
      }
    });
    return map;
  }, [logs, evaluated?.dailyBreakdown]);

  // Collect all drill dates where excuse request was REJECTED, DECLINED, or DECLARED_ABSENT by Admin HQ
  const rejectedExcuseDatesMap = useMemo(() => {
    const map = new Map();
    const isRejected = (val) => {
      if (!val) return false;
      const s = String(val).trim().toUpperCase();
      return s === 'REJECTED' || s === 'DECLINED' || s === 'DECLARED_ABSENT' || s === 'DECLARED ABSENT' || s === 'EXCUSE_REJECTED';
    };

    // 1. Raw / Reconciled attendance logs
    (logs || []).forEach(l => {
      const rawD = l.date || l.session_date || l.timestamp;
      const dk = toDateKey ? toDateKey(rawD) : (rawD ? String(rawD).slice(0, 10) : '');
      if (!dk) return;

      // If already approved, do not treat as rejected
      if (approvedExcuseDatesMap.has(dk)) return;

      const st = String(l.status || l.final_daily_status || '').trim().toUpperCase();
      const exSt = String(l.excuse_status || l.excuseStatus || '').trim().toUpperCase();
      const penalty = String(l.penaltyLabel || l.penalty || '').toLowerCase();

      if (
        isRejected(st) ||
        isRejected(exSt) ||
        penalty.includes('excuse rejected') ||
        penalty.includes('declared absent')
      ) {
        map.set(dk, {
          date: dk,
          status: isRejected(exSt) ? exSt : (isRejected(st) ? st : 'REJECTED'),
          reason: l.excuse_reason || l.reason || l.remarks || ''
        });
      }
    });

    // 2. Evaluated daily breakdown records
    (evaluated?.dailyBreakdown || []).forEach(entry => {
      const dk = toDateKey ? toDateKey(entry.date) : (entry.date ? String(entry.date).slice(0, 10) : '');
      if (!dk) return;

      // If already approved, do not treat as rejected
      if (approvedExcuseDatesMap.has(dk)) return;

      const st = String(entry.status || entry.dayType || entry.final_daily_status || '').trim().toUpperCase();
      const exSt = String(entry.excuse_status || entry.excuseStatus || '').trim().toUpperCase();
      const penalty = String(entry.penaltyLabel || '').toLowerCase();

      if (
        isRejected(st) ||
        isRejected(exSt) ||
        penalty.includes('excuse rejected') ||
        penalty.includes('declared absent')
      ) {
        if (!map.has(dk)) {
          map.set(dk, {
            date: dk,
            status: isRejected(exSt) ? exSt : (isRejected(st) ? st : 'REJECTED'),
            reason: entry.excuseReason || entry.reason || ''
          });
        }
      }
    });

    return map;
  }, [logs, evaluated?.dailyBreakdown, approvedExcuseDatesMap]);

  // Official Formation Dates Set: Strictly from Supabase attendance_sessions (primary) or formationDates
  const officialFormationDatesSet = useMemo(() => {
    const s = new Set();
    if (Array.isArray(dbSessions) && dbSessions.length > 0) {
      dbSessions.forEach(sess => {
        const dk = sess.dateKey || sess.session_date || sess.sessionDate;
        const cleanKey = toDateKey ? toDateKey(dk) : (dk ? String(dk).slice(0, 10) : '');
        if (cleanKey) s.add(cleanKey);
      });
    } else if (Array.isArray(formationDates) && formationDates.length > 0) {
      formationDates.forEach(fDate => {
        const cleanKey = toDateKey ? toDateKey(fDate) : (fDate ? String(fDate).slice(0, 10) : '');
        if (cleanKey) s.add(cleanKey);
      });
    }
    return s;
  }, [dbSessions, formationDates]);

  // Filter Eligible Dates: Only dates where cadet is ABSENT, within grace period filing window,
  // EXCLUDING drill dates if cadet already has an existing excuse request with status of EXCUSE_PENDING, APPROVED, or EXCUSED,
  // and EXCLUDING drill dates if Admin HQ rejected/declined or declared absent (REJECTED, DECLINED, DECLARED_ABSENT).
  const {
    eligibleAbsentDates,
    absentDrillDates,
    expiredAbsentDrillDates,
    pendingAbsentDrillDates,
    approvedAbsentDrillDates,
    rejectedAbsentDrillDates,
    submittedAbsentDrillDates
  } = useMemo(() => {
    if (!evaluated?.dailyBreakdown) {
      return {
        eligibleAbsentDates: [],
        absentDrillDates: [],
        expiredAbsentDrillDates: [],
        pendingAbsentDrillDates: [],
        approvedAbsentDrillDates: [],
        rejectedAbsentDrillDates: [],
        submittedAbsentDrillDates: []
      };
    }

    const eligible = [];
    const expired = [];
    const pending = [];
    const approved = [];
    const rejected = [];
    const now = new Date();

    const allAbsent = evaluated.dailyBreakdown.filter(entry => {
      const rawStatus = String(entry.status || entry.dayType || entry.final_daily_status || '').toUpperCase();
      const exStatus = String(entry.excuse_status || entry.excuseStatus || '').toUpperCase();
      const penalty = String(entry.penaltyLabel || '').toLowerCase();
      const drillDateKey = toDateKey ? toDateKey(entry.date) : (entry.date ? String(entry.date).slice(0, 10) : '');

      // Strict requirement: Formation date MUST be an official formation session scheduled/conducted by HQ
      if (!drillDateKey || !officialFormationDatesSet.has(drillDateKey)) {
        return false;
      }

      // Exclude drill dates if Admin HQ already rejected, declined, or declared absent
      if (
        rawStatus === 'REJECTED' ||
        rawStatus === 'DECLINED' ||
        rawStatus === 'DECLARED_ABSENT' ||
        rawStatus === 'DECLARED ABSENT' ||
        rawStatus === 'EXCUSE_REJECTED' ||
        exStatus === 'REJECTED' ||
        exStatus === 'DECLINED' ||
        exStatus === 'DECLARED_ABSENT' ||
        exStatus === 'DECLARED ABSENT' ||
        penalty.includes('excuse rejected') ||
        penalty.includes('declared absent') ||
        (drillDateKey && rejectedExcuseDatesMap.has(drillDateKey))
      ) {
        return false;
      }

      // Exclude drill dates if already approved or excused by HQ
      if (
        rawStatus === 'APPROVED' ||
        rawStatus === 'EXCUSED' ||
        exStatus === 'APPROVED' ||
        exStatus === 'EXCUSED' ||
        (drillDateKey && approvedExcuseDatesMap.has(drillDateKey))
      ) {
        return false;
      }

      // Exclude drill dates if already pending admin review
      if (
        rawStatus === 'EXCUSE_PENDING' ||
        rawStatus === 'PENDING' ||
        exStatus === 'EXCUSE_PENDING' ||
        exStatus === 'PENDING' ||
        (drillDateKey && pendingExcuseDatesMap.has(drillDateKey))
      ) {
        return false;
      }

      // Cadets who are LATE (including compound statuses like LATE / NO TIME-OUT) are NOT absent
      if (checkIsLate(entry) || rawStatus.includes('LATE') || entry.dayType === 'LATE') return false;

      // Cadets who are PRESENT are NOT absent
      const hasIn = entry.hasTimeIn !== undefined ? (entry.hasTimeIn && isValidTime(entry.timeIn)) : isValidTime(entry.timeIn);
      const hasOut = entry.hasTimeOut !== undefined ? (entry.hasTimeOut && isValidTime(entry.timeOut)) : isValidTime(entry.timeOut);
      if (hasIn && (rawStatus === 'PRESENT' || rawStatus.includes('PRESENT'))) return false;

      // Both time-in and time-out recorded -> attended -> NOT absent
      if (hasIn && hasOut) return false;

      // True unexcused absence conditions:
      // 1. Neither time-in nor time-out
      // 2. Explicit ABSENT status
      // 3. UNRECORDED formation session
      const isAbsent = (!hasIn && !hasOut) ||
        rawStatus.includes('ABSENT') ||
        entry.dayType === 'UNRECORDED' ||
        entry.dayType === 'ABSENT';

      return isAbsent;
    });

    allAbsent.forEach(entry => {
      const drillDateKey = entry.date || '';
      if (!drillDateKey) return;

      const parts = String(drillDateKey).trim().split('-');
      if (parts.length !== 3) return;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      // Resolve formation session cut-off time
      const sessionCutoff = sessionCutoffsByDate?.get(drillDateKey) ||
        settings?.formation_cutoff_time ||
        settings?.morningCutoffTime ||
        settings?.formationCutoffTime ||
        '07:30';

      let cutoffHour = 7;
      let cutoffMin = 30;
      if (sessionCutoff) {
        const match = String(sessionCutoff).match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
        if (match) {
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const meridiem = match[3]?.toUpperCase();
          if (meridiem === 'PM' && h < 12) h += 12;
          if (meridiem === 'AM' && h === 12) h = 0;
          cutoffHour = h;
          cutoffMin = m;
        }
      }

      // Deadline: 4 days after formation date at the cut-off time
      const deadline = new Date(year, month, day + Number(gracePeriodDays), cutoffHour, cutoffMin, 0, 0);

      // Formation cutoff check for today
      const formationCutoffToday = new Date(year, month, day, cutoffHour, cutoffMin, 0, 0);
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDateOnly = new Date(year, month, day);

      // Future dates cannot be excused yet
      if (targetDateOnly.getTime() > todayDateOnly.getTime()) return;

      // If formation is today, muster cut-off must have elapsed for it to be an unexcused absence
      if (targetDateOnly.getTime() === todayDateOnly.getTime() && now.getTime() < formationCutoffToday.getTime()) return;

      // Within 4-day policy window considering cut-off time
      if (now.getTime() <= deadline.getTime()) {
        eligible.push({ ...entry, deadline, sessionCutoff });
      } else {
        expired.push({ ...entry, deadline, sessionCutoff });
      }
    });

    // Populate all pending dates (only EXCUSE_PENDING / PENDING)
    pendingExcuseDatesMap.forEach((val, dateKey) => {
      pending.push({ date: dateKey, status: val.status, reason: val.reason });
    });

    // Populate all approved dates
    approvedExcuseDatesMap.forEach((val, dateKey) => {
      approved.push({ date: dateKey, status: val.status, reason: val.reason });
    });

    // Populate all rejected dates
    rejectedExcuseDatesMap.forEach((val, dateKey) => {
      rejected.push({ date: dateKey, status: val.status, reason: val.reason });
    });

    eligible.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    expired.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    pending.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    approved.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    rejected.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return {
      eligibleAbsentDates: eligible,
      absentDrillDates: eligible,
      expiredAbsentDrillDates: expired,
      pendingAbsentDrillDates: pending,
      approvedAbsentDrillDates: approved,
      rejectedAbsentDrillDates: rejected,
      submittedAbsentDrillDates: pending
    };
  }, [
    evaluated?.dailyBreakdown,
    officialFormationDatesSet,
    pendingExcuseDatesMap,
    approvedExcuseDatesMap,
    rejectedExcuseDatesMap,
    checkIsLate,
    isValidTime,
    sessionCutoffsByDate,
    settings,
    gracePeriodDays
  ]);

  // Check if selected date has already been submitted and is pending review
  const isAlreadyPending = useMemo(() => {
    if (!excuseForm.targetDate) return false;
    const dk = toDateKey ? toDateKey(excuseForm.targetDate) : excuseForm.targetDate;
    return pendingExcuseDatesMap.has(dk);
  }, [excuseForm.targetDate, pendingExcuseDatesMap]);

  // Backward compatibility alias: only matches pending submissions
  const isAlreadySubmitted = isAlreadyPending;

  // Check if selected date was already approved / excused by Admin HQ
  const isAlreadyApproved = useMemo(() => {
    if (!excuseForm.targetDate) return false;
    const dk = toDateKey ? toDateKey(excuseForm.targetDate) : excuseForm.targetDate;
    return approvedExcuseDatesMap.has(dk);
  }, [excuseForm.targetDate, approvedExcuseDatesMap]);

  // Check if selected date was already rejected / declined by Admin HQ
  const isAlreadyRejected = useMemo(() => {
    if (!excuseForm.targetDate) return false;
    const dk = toDateKey ? toDateKey(excuseForm.targetDate) : excuseForm.targetDate;
    return rejectedExcuseDatesMap.has(dk);
  }, [excuseForm.targetDate, rejectedExcuseDatesMap]);

  // Only consider no remaining unsubmitted dates when there ARE pending requests awaiting review
  const hasNoRemainingUnsubmitted = useMemo(() => {
    return eligibleAbsentDates.length === 0 && pendingAbsentDrillDates.length > 0;
  }, [eligibleAbsentDates.length, pendingAbsentDrillDates.length]);

  // Cadet has 0 active absences (all recorded absences are officially excused/approved by HQ)
  const isAllExcusedCompliant = useMemo(() => {
    const zeroActiveAbsences = (counts?.absent === 0) || (eligibleAbsentDates.length === 0 && pendingAbsentDrillDates.length === 0);
    const hasExcusedRecords = approvedAbsentDrillDates.length > 0 || (counts?.excused > 0);
    return Boolean(zeroActiveAbsences && hasExcusedRecords && pendingAbsentDrillDates.length === 0);
  }, [counts?.absent, counts?.excused, eligibleAbsentDates.length, pendingAbsentDrillDates.length, approvedAbsentDrillDates.length]);

  const showAlreadySubmittedBadge = Boolean(isAlreadyPending || (hasNoRemainingUnsubmitted && !isAlreadyRejected && pendingAbsentDrillDates.length > 0));

  // Combined dates for the calendar dropdown in Excuse modal
  const excuseCalendarRecordedDates = useMemo(() => {
    const dates = new Set();
    eligibleAbsentDates.forEach(d => dates.add(d.date));
    pendingAbsentDrillDates.forEach(d => dates.add(d.date));
    approvedAbsentDrillDates.forEach(d => dates.add(d.date));
    rejectedAbsentDrillDates.forEach(d => dates.add(d.date));
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [eligibleAbsentDates, pendingAbsentDrillDates, approvedAbsentDrillDates, rejectedAbsentDrillDates]);

  const excuseCalendarPendingDates = useMemo(() => {
    return pendingAbsentDrillDates.map(d => d.date);
  }, [pendingAbsentDrillDates]);

  const excuseCalendarApprovedDates = useMemo(() => {
    return approvedAbsentDrillDates.map(d => d.date);
  }, [approvedAbsentDrillDates]);

  const excuseCalendarSubmittedDates = excuseCalendarPendingDates;

  const excuseCalendarRejectedDates = useMemo(() => {
    return rejectedAbsentDrillDates.map(d => d.date);
  }, [rejectedAbsentDrillDates]);

  // Keep excuseForm.targetDate synchronized with eligible absent dates when modal is active
  useEffect(() => {
    if (showExcuseModal) {
      if (eligibleAbsentDates.length > 0) {
        if (
          !excuseForm.targetDate ||
          (!eligibleAbsentDates.some(d => d.date === excuseForm.targetDate) &&
            !pendingExcuseDatesMap.has(excuseForm.targetDate) &&
            !approvedExcuseDatesMap.has(excuseForm.targetDate) &&
            !rejectedExcuseDatesMap.has(excuseForm.targetDate))
        ) {
          setExcuseForm(prev => ({ ...prev, targetDate: eligibleAbsentDates[0].date }));
        }
      } else if (pendingAbsentDrillDates.length > 0 && !isAlreadyRejected) {
        if (!excuseForm.targetDate || (!pendingExcuseDatesMap.has(excuseForm.targetDate) && !rejectedExcuseDatesMap.has(excuseForm.targetDate))) {
          setExcuseForm(prev => ({ ...prev, targetDate: pendingAbsentDrillDates[0].date }));
        }
      } else if (approvedAbsentDrillDates.length > 0) {
        if (!excuseForm.targetDate || !approvedExcuseDatesMap.has(excuseForm.targetDate)) {
          setExcuseForm(prev => ({ ...prev, targetDate: approvedAbsentDrillDates[0].date }));
        }
      } else if (rejectedAbsentDrillDates.length > 0) {
        if (!excuseForm.targetDate || !rejectedExcuseDatesMap.has(excuseForm.targetDate)) {
          setExcuseForm(prev => ({ ...prev, targetDate: rejectedAbsentDrillDates[0].date }));
        }
      } else {
        setExcuseForm(prev => ({ ...prev, targetDate: '' }));
      }
    }
  }, [
    showExcuseModal,
    eligibleAbsentDates,
    pendingAbsentDrillDates,
    approvedAbsentDrillDates,
    rejectedAbsentDrillDates,
    pendingExcuseDatesMap,
    approvedExcuseDatesMap,
    rejectedExcuseDatesMap,
    isAlreadyRejected
  ]);

  const handleSubmitExcuse = useCallback(async () => {
    if (isAlreadyRejected || (excuseForm.targetDate && rejectedExcuseDatesMap.has(excuseForm.targetDate))) {
      setExcuseResult({
        success: false,
        message: 'An excuse request for this formation date was already rejected by HQ and cannot be re-filed.'
      });
      return;
    }

    if (isAlreadyApproved || (excuseForm.targetDate && approvedExcuseDatesMap.has(excuseForm.targetDate))) {
      setExcuseResult({
        success: false,
        message: 'An official excuse for this formation has already been approved by HQ.'
      });
      return;
    }

    if (isAlreadyPending || (excuseForm.targetDate && pendingExcuseDatesMap.has(excuseForm.targetDate))) {
      setExcuseResult({
        success: false,
        message: 'An excuse request for this formation date has already been submitted and is pending admin review.'
      });
      return;
    }

    if (eligibleAbsentDates.length === 0) {
      setExcuseResult({ success: false, message: 'No eligible absent records found within the filing window.' });
      return;
    }

    if (!excuseForm.targetDate || !excuseForm.reason.trim()) {
      setExcuseResult({ success: false, message: 'Please select an eligible Drill Date and provide the Reason for absence.' });
      return;
    }

    if (!officialFormationDatesSet.has(excuseForm.targetDate)) {
      setExcuseResult({
        success: false,
        message: 'No official formation event was scheduled or conducted by Headquarters on this date. Excuses can only be filed for verified formation dates.'
      });
      return;
    }

    const isEligible = eligibleAbsentDates.some(d => d.date === excuseForm.targetDate);
    if (!isEligible) {
      setExcuseResult({
        success: false,
        message: `The selected formation date is not an eligible absent record under the ${gracePeriodDays}-day filing policy window (considering cut-off time).`
      });
      return;
    }

    setExcuseSubmitting(true);
    setExcuseResult(null);
    try {
      const result = await submitExcuseRequest(cid, excuseForm.targetDate, excuseForm.reason.trim(), null);
      if (result && !result.error) {
        setExcuseResult({ success: true, message: result.message || 'Excuse request submitted successfully! It is now awaiting admin review.' });
        setExcuseForm({ targetDate: '', reason: '' });
        // Refresh data so the new EXCUSE_PENDING shows up
        setTimeout(() => { handleRefresh(); setShowExcuseModal(false); setExcuseResult(null); }, 2500);
      } else if (result?.error === 'NON_FORMATION_DATE') {
        setExcuseResult({ success: false, message: result.message || 'No official formation event was scheduled or conducted on this date.' });
      } else if (result?.error === 'ALREADY_REJECTED') {
        setExcuseResult({ success: false, message: result.message || 'An excuse request for this formation date was already rejected by HQ and cannot be re-filed.' });
      } else if (result?.error === 'ALREADY_EXCUSED') {
        setExcuseResult({ success: false, message: result.message || 'An official excuse for this formation has already been approved by HQ.' });
      } else if (result?.error === 'ALREADY_PENDING') {
        setExcuseResult({ success: false, message: result.message || 'An excuse request for this formation date has already been submitted and is pending admin review.' });
      } else {
        setExcuseResult({ success: false, message: result?.message || 'Submission failed. Please verify your connection or try again.' });
      }
    } catch (err) {
      setExcuseResult({ success: false, message: `Error: ${err?.message || 'Unexpected error. Please try again.'}` });
    } finally {
      setExcuseSubmitting(false);
    }
  }, [
    isAlreadyRejected,
    isAlreadyApproved,
    isAlreadyPending,
    excuseForm.targetDate,
    excuseForm.reason,
    rejectedExcuseDatesMap,
    approvedExcuseDatesMap,
    pendingExcuseDatesMap,
    eligibleAbsentDates,
    officialFormationDatesSet,
    gracePeriodDays,
    cid,
    handleRefresh
  ]);

  // Combined recorded formation dates for the Formation Calendar Selector
  const allRecordedFormationDates = useMemo(() => {
    const datesSet = new Set();
    (formationDates || []).forEach(d => {
      const k = toDateKey(d);
      if (k) datesSet.add(k);
    });
    (dbSessions || []).forEach(s => {
      const k = toDateKey(s.date || s.session_date || s.dateKey);
      if (k) datesSet.add(k);
    });
    (evaluated?.dailyBreakdown || []).forEach(b => {
      const k = toDateKey(b.date);
      if (k) datesSet.add(k);
    });
    (logs || []).forEach(l => {
      const k = toDateKey(l.date || l.dateKey || l.created_at);
      if (k) datesSet.add(k);
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [formationDates, dbSessions, evaluated?.dailyBreakdown, logs]);

  // 3. Filtered Formation Schedule
  const displaySchedule = useMemo(() => {
    const rawBreakdown = evaluated?.dailyBreakdown || [];
    let sessions = [...rawBreakdown].sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));

    if (statusFilter === 'PRESENT') {
      sessions = sessions.filter(s => {
        if (!s.isRecorded || isExcuseRecord(s)) return false;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return hasIn && hasOut && !checkIsLate(s) && !st.includes('ABSENT');
      });
    } else if (statusFilter === 'LATE') {
      sessions = sessions.filter(s => checkIsLate(s));
    } else if (statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-IN') {
      sessions = sessions.filter(s => {
        if (!s.isRecorded || isExcuseRecord(s)) return false;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        const isMissingTimeOut = (hasIn && !hasOut) || st.includes('NO TIME-OUT') || s.dayType === 'NO TIME-OUT';
        const isMissingTimeIn = (!hasIn && hasOut) || st.includes('NO TIME-IN') || s.dayType === 'NO TIME-IN';
        return isMissingTimeOut || isMissingTimeIn;
      });
    } else if (statusFilter === 'ABSENT') {
      sessions = sessions.filter(s => {
        if (isExcuseRecord(s)) return false;
        if (!s.isRecorded) return true;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return (!hasIn && !hasOut) || st.includes('ABSENT') || s.dayType === 'UNRECORDED' || s.dayType === 'ABSENT';
      });
    } else if (statusFilter === 'EXCUSED' || statusFilter === 'EXCUSE' || statusFilter === 'EXCUSE_PENDING') {
      sessions = sessions.filter(s => isExcuseRecord(s));
    }

    if (searchDate && searchDate.trim()) {
      const rawQuery = searchDate.trim().toLowerCase();
      const queryKey = toDateKey(searchDate.trim());
      const queryFriendly = queryKey ? formatFriendlyDate(queryKey).toLowerCase() : '';

      sessions = sessions.filter(s => {
        const rawDate = String(s.date || '').toLowerCase();
        const friendly = formatFriendlyDate(s.date).toLowerCase();
        const sessionKey = toDateKey(s.date);

        // 1. Direct substring match against raw date or friendly date
        if (rawDate.includes(rawQuery) || friendly.includes(rawQuery)) {
          return true;
        }

        // 2. Normalized key match (e.g., input type="date" value '2026-09-04' against sessionKey '2026-09-04')
        if (queryKey && sessionKey && queryKey === sessionKey) {
          return true;
        }

        // 3. Match against friendly formatted representation of the date
        if (queryFriendly && (friendly.includes(queryFriendly) || rawDate.includes(queryFriendly))) {
          return true;
        }

        return false;
      });
    }

    return sessions;
  }, [evaluated?.dailyBreakdown, statusFilter, searchDate, isExcuseRecord, isValidTime, checkIsLate]);

  // 4. Synthetic Breakdown Rows for Converted Absences (Rules 5, 6, 7)
  const conversionRows = useMemo(() => {
    if (statusFilter !== 'ABSENT' || searchDate) return [];
    const rows = [];

    const missingScans = Number(evaluated?.missingScans ?? evaluated?.totalIntervalMissingScans ?? 0);
    const intervalLates = Number(evaluated?.intervalLates ?? evaluated?.totalIntervalLates ?? 0);
    const consecutiveLateConversions = Number(evaluated?.consecutiveLateConversions ?? 0);

    const missingScanConversions = Math.floor(missingScans / 4);
    const intervalLateConversions = Math.floor(intervalLates / 4);

    // Rule 7: 4 Missing Scans (No Time-In / Time-Out) -> 1 Converted Absent
    if (missingScanConversions > 0) {
      const rem = missingScans % 4;
      const progressText = rem > 0
        ? `${missingScans} Missing Scans Total = ${missingScanConversions} Converted Absent + ${rem}/4 toward next penalty`
        : `${missingScans} Missing Scans Total = ${missingScanConversions} Converted Absent (4/4 penalty threshold met)`;

      rows.push({
        id: 'rule-7-conversion',
        ruleCode: 'Rule 7 Conversion',
        title: 'Rule 7: 4 Cumulative Missing Scans',
        conversions: missingScanConversions,
        totalEvents: missingScans,
        progress: progressText,
        detail: `Rule 7 Conversion: 4 Cumulative Missing Scans → +${missingScanConversions} Converted Absent`,
        explanation: 'Automated conversion: Every 4 incomplete scans (missing Time-In or Time-Out) add 1 official absence.'
      });
    }

    // Rule 6: 4 Interval Lates -> 1 Converted Absent
    if (intervalLateConversions > 0) {
      const rem = intervalLates % 4;
      const progressText = rem > 0
        ? `${intervalLates} Interval Lates Total = ${intervalLateConversions} Converted Absent + ${rem}/4 toward next penalty`
        : `${intervalLates} Interval Lates Total = ${intervalLateConversions} Converted Absent (4/4 penalty threshold met)`;

      rows.push({
        id: 'rule-6-conversion',
        ruleCode: 'Rule 6 Conversion',
        title: 'Rule 6: 4 Interval Lates',
        conversions: intervalLateConversions,
        totalEvents: intervalLates,
        progress: progressText,
        detail: `Rule 6 Conversion: 4 Cumulative Lates → +${intervalLateConversions} Converted Absent`,
        explanation: 'Automated conversion: Every 4 cumulative late formations add 1 official absence.'
      });
    }

    // Rule 5: 3 Consecutive Lates -> 1 Converted Absent
    if (consecutiveLateConversions > 0) {
      rows.push({
        id: 'rule-5-conversion',
        ruleCode: 'Rule 5 Conversion',
        title: 'Rule 5: 3 Consecutive Lates',
        conversions: consecutiveLateConversions,
        totalEvents: consecutiveLateConversions * 3,
        progress: `3 Consecutive Late Formations Streak = +${consecutiveLateConversions} Converted Absent`,
        detail: `Rule 5 Conversion: 3 Consecutive Lates → +${consecutiveLateConversions} Converted Absent`,
        explanation: 'Automated conversion: 3 consecutive late formations add 1 official absence.'
      });
    }

    return rows;
  }, [statusFilter, searchDate, evaluated]);

  const activeCadet = { ...cadet, ...cadetProfile };
  const cadetId = activeCadet.cadetId || activeCadet.cadet_id || activeCadet.id || 'N/A';
  const fullName = activeCadet.name || 'CADET NAME';
  const rank = activeCadet.rank || 'Cadet';
  const battalion = activeCadet.battalion || '1st Battalion';
  const company = activeCadet.company || 'Alpha Company';
  const platoon = activeCadet.platoon || '1st Platoon';

  // Profile fields: Department, Academic Program, Gender, Permanent Address, Contact Number, Religion
  const department = activeCadet.department || activeCadet.college || activeCadet.dept || 'N/A';
  const program = activeCadet.program || activeCadet.course || 'N/A';
  const gender = activeCadet.gender || activeCadet.sex || 'N/A';
  const contactNumber = activeCadet.contact_number || activeCadet.contactNumber || activeCadet.phone || activeCadet.emergency_contact || '—';
  const religion = activeCadet.religion || '—';

  const permanentAddress = (() => {
    if (activeCadet.permanent_address || activeCadet.permanentAddress) {
      return activeCadet.permanent_address || activeCadet.permanentAddress;
    }
    if (activeCadet.address) return activeCadet.address;
    const parts = [activeCadet.barangay, activeCadet.city, activeCadet.province]
      .map(p => String(p || '').trim())
      .filter(p => Boolean(p) && p !== 'null' && p !== 'undefined');
    if (parts.length > 0) return parts.join(', ');
    return '—';
  })();

  const cardPayload = {
    ...activeCadet,
    id: cadetId,
    cadetId: cadetId,
    name: fullName,
    lastName: activeCadet.lastName || activeCadet.last_name || '',
    rank: rank,
    battalion: battalion,
    company: company,
    platoon: platoon,
    course: program,
    department: department,
    college: department,
    studentId: activeCadet.studentId || activeCadet.student_id || '',
    signatoryName: settings?.id_signatory_name || settings?.commanding_officer,
    signatoryTitle: settings?.id_signatory_title || settings?.commanding_officer_title,
    signatureUrl: settings?.id_signature_url
  };

  const handleDownloadPdf = async () => {
    const cardElem = passCardRef.current;
    if (!cardElem) return;

    try {
      setIsExportingPdf(true);

      const canvas = await html2canvas(cardElem, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // Standard A4 document in portrait mode positioned at top-left
      // Matching Admin pass dimensions (44mm width) and 8mm page margin positioning
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const cardWidthMm = 44;
      const cardHeightMm = (canvas.height / canvas.width) * cardWidthMm;

      pdf.addImage(imgData, 'PNG', 8, 8, cardWidthMm, cardHeightMm);

      const safeLastName = (activeCadet.lastName || activeCadet.last_name || '').toUpperCase().trim();
      const fallbackLastName = (activeCadet.name || 'CADET').split(',')[0].trim().toUpperCase();
      const finalName = (safeLastName || fallbackLastName || 'CADET').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeId = (cadetId || 'ID').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`ROTC_QR_PASS_${finalName}_${safeId}.pdf`);
    } catch (err) {
      console.error('Failed to export QR pass to PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintPass = () => {
    const cardElem = passCardRef.current;
    if (!cardElem) return;

    const safeLastName = (activeCadet.lastName || activeCadet.last_name || '').toUpperCase().trim();
    const fallbackLastName = (activeCadet.name || 'CADET').split(',')[0].trim().toUpperCase();
    const printTitle = `Official ROTC QR Pass - ${safeLastName || fallbackLastName || cadetId}`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${printTitle}</title>
            <style>
              @page {
                size: portrait;
                margin: 8mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100%;
                height: 100%;
                background: #ffffff !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              }
              .print-container {
                position: absolute;
                top: 0;
                left: 0;
                margin: 0;
                padding: 0;
                display: block;
              }
              #printable-qr-pass,
              #cadet-digital-qr-pass,
              .qr-pass-tile {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                margin: 0 !important;
                width: 164px !important;
                max-width: 168px !important;
                box-shadow: none !important;
                border: 1.5px solid #1a3a2a !important;
                border-radius: 6px !important;
                padding: 10px 8px !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                box-sizing: border-box !important;
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${cardElem.outerHTML}
            </div>
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      window.print();
    }
  };

  return (
    <>
      {isLoggingOut && (
        <MilitaryLoader
          mode="cadet"
          variant="fullscreen"
          staticPhrase="Terminating Cadet Session..."
        />
      )}
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: t.bg,
          color: t.textMain,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          transition: 'background-color 0.2s ease, color 0.2s ease'
        }}
      >
        {/* 1. Header Navigation Bar (Modular CadetPortalHeader with dedicated File Excuse action) */}
        <CadetPortalHeader
          t={t}
          isLight={isLight}
          toggleTheme={toggleTheme}
          fullName={fullName}
          cadetId={cadetId}
          isLoggingOut={isLoggingOut}
          handleLogoutClick={handleLogoutClick}
          onOpenFileExcuse={() => {
            const defaultTarget = eligibleAbsentDates.length > 0
              ? eligibleAbsentDates[0].date
              : (pendingAbsentDrillDates.length > 0
                  ? pendingAbsentDrillDates[0].date
                  : (approvedAbsentDrillDates.length > 0
                      ? approvedAbsentDrillDates[0].date
                      : (rejectedAbsentDrillDates.length > 0 ? rejectedAbsentDrillDates[0].date : '')));
            setExcuseForm(prev => ({
              targetDate: prev.targetDate || defaultTarget,
              reason: ''
            }));
            setExcuseResult(null);
            setShowExcuseModal(true);
          }}
        />

        {/* 2. Main Content Area */}
        <main
          className="cadet-main-sections w-full max-w-6xl mx-auto px-4 space-y-3 sm:space-y-4"
          style={{
            flex: 1,
            padding: 'clamp(1rem, 2vw, 1.5rem) 1rem',
            maxWidth: '1152px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 10
          }}
        >

          {/* ============================================================ */}
          {/* EMPATHETIC, CLEAR ATTENDANCE STATUS ALERT BANNER              */}
          {/* ============================================================ */}
          {isDropped && (
            <div
              style={{
                background: isLight
                  ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
                  : 'linear-gradient(135deg, rgba(225, 29, 72, 0.12) 0%, rgba(159, 18, 57, 0.18) 100%)',
                border: '1.5px solid #f43f5e',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                boxShadow: isLight ? '0 4px 15px rgba(244, 63, 94, 0.15)' : '0 6px 20px rgba(225, 29, 72, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div
                className="dropped-alert-container"
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                  <div
                    style={{
                      background: '#e11d48',
                      color: '#ffffff',
                      borderRadius: '12px',
                      padding: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <AlertOctagon size={26} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: '#e11d48',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: 'clamp(1.15rem, 4.5vw, 1.45rem)',
                          letterSpacing: '0.5px',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}
                      >
                        DROPPED STATUS
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="dropped-alert-btn"
                  onClick={() => setShowAlertDetails(!showAlertDetails)}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                    border: isLight ? '1px solid #fecdd3' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: isLight ? '#9f1239' : '#f8fafc',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {showAlertDetails ? 'Hide Resolution Steps' : 'View Resolution Steps'}
                </button>
              </div>

              {/* Clear, Helpful Steps to Appeal or Reinstate */}
              {showAlertDetails && (
                <div
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.6)',
                    border: isLight ? '1px solid #fecdd3' : '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    fontSize: '0.82rem',
                    color: isLight ? '#1e293b' : '#e2e8f0',
                    lineHeight: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ fontWeight: 800, color: isLight ? '#be123c' : '#fecdd3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HelpCircle size={15} color="#e11d48" />
                    <span>How to Resolve This & Appeal:</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginTop: '4px' }}>
                    <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                      <strong>1. Report to Admin Office:</strong> Visit the <strong>ROTC OFFICE</strong> on Caraga State University, Ampayon Campus to verify your records.
                    </div>
                    <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                      <strong>2. Submit Excuse Letters:</strong> Coordinate with your <strong>Platoon Leader</strong> and submit valid medical/academic excuses.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isPenalty && !isDropped && (
            <div
              style={{
                background: isLight
                  ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                  : 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(194, 65, 12, 0.18) 100%)',
                border: '1.5px solid #ea580c',
                borderRadius: '16px',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: isLight ? '0 4px 15px rgba(234, 88, 12, 0.12)' : 'none'
              }}
            >
              <div style={{ background: '#ea580c', color: '#ffffff', borderRadius: '10px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isLight ? '#9a3412' : '#fdba74' }}>
                  Attendance Penalty Alert: {evaluated.badgeLabel || evaluated.reason || 'Converted Absences Applied'}
                </div>
                <div style={{ fontSize: '0.8rem', color: isLight ? '#c2410c' : '#fed7aa', marginTop: '2px' }}>
                  Accumulated late arrivals or incomplete scans have converted to <strong>{metrics.absences} Converted Absent</strong> on your standing. Please ensure complete and timely check-ins.
                </div>
              </div>
            </div>
          )}

          {isWarning && (
            <div
              style={{
                background: isLight
                  ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                  : 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(180, 83, 9, 0.18) 100%)',
                border: '1.5px solid #f59e0b',
                borderRadius: '16px',
                padding: '1.15rem 1.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: isLight ? '0 4px 15px rgba(245, 158, 11, 0.12)' : 'none'
              }}
            >
              <div style={{ background: '#f59e0b', color: '#0b0f19', borderRadius: '10px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isLight ? '#92400e' : '#fbbf24' }}>
                  Attendance Warning: {metrics.absences} Absences Recorded
                </div>
                <div style={{ fontSize: '0.8rem', color: isLight ? '#b45309' : '#fef3c7', marginTop: '2px' }}>
                  You are approaching the drop limit. Accumulating 3 consecutive unrecorded formations or more than 3 total absences triggers an administrative drop.
                </div>
              </div>
            </div>
          )}

          {!isDropped && !isWarning && !isPenalty && (
            <div
              style={{
                background: isLight
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                  : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)',
                border: '1.5px solid #10b981',
                borderRadius: '16px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: isLight ? '0 4px 15px rgba(16, 185, 129, 0.1)' : 'none'
              }}
            >
              <div style={{ background: '#10b981', color: '#ffffff', borderRadius: '10px', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isLight ? '#065f46' : '#34d399' }}>
                  Attendance Status: Good Standing
                </div>
                <div style={{ fontSize: '0.8rem', color: isLight ? '#047857' : '#a7f3d0', marginTop: '2px' }}>
                  Your formation drill attendance is within compliant parameters. Keep up the active participation!
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. HERO CADET PROFILE & FORMATION BREADCRUMB CARD            */}
          {/* ============================================================ */}
          <div
            className="cadet-profile-card"
            style={{
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: '16px',
              boxShadow: t.cardShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}
          >
            <div className="cadet-profile-header-container">
              {/* Cadet Avatar & Identity - Clean Horizontal Layout */}
              <div className="cadet-profile-identity">
                <div
                  style={{
                    width: 'clamp(54px, 12vw, 68px)',
                    height: 'clamp(54px, 12vw, 68px)',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #064e2e 0%, #032b19 100%)',
                    border: '2.5px solid #e5a900',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#facc15',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}
                >
                  {cadet.photoUrl || cadet.photo_url ? (
                    <img
                      src={cadet.photoUrl || cadet.photo_url}
                      alt={fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <User size={30} />
                  )}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span
                      style={{
                        background: 'rgba(229, 169, 0, 0.15)',
                        color: isLight ? '#b45309' : '#facc15',
                        border: '1px solid rgba(229, 169, 0, 0.35)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {rank}
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        background: t.insetBg,
                        color: t.textMuted,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${t.insetBorder}`,
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ID: {cadetId}
                    </span>
                  </div>

                  <h1
                    className="cadet-profile-name text-lg sm:text-xl"
                    style={{
                      color: t.textMain
                    }}
                  >
                    {fullName}
                  </h1>
                </div>
              </div>

              {/* Digital QR Pass Button */}
              <button
                type="button"
                className="cadet-profile-id-btn"
                onClick={() => setShowIdModal(true)}
                style={{
                  background: '#e5a900',
                  color: '#0b0f19',
                  border: 'none',
                  padding: '0.7rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(229, 169, 0, 0.25)',
                  transition: 'background-color 0.15s ease',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#e5a900'; }}
              >
                <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>🔲</span> View Digital QR Pass
              </button>
            </div>

            {/* Cadet Detailed Profile Metadata Strip (2-Column Grid: grid-cols-2) */}
            <div
              className="cadet-profile-details-grid grid-cols-2"
              style={{
                background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`
              }}
            >
              {/* Department */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <BookOpen size={12} color="#e5a900" />
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Department</span>
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', wordBreak: 'break-word' }}>
                  {department}
                </div>
              </div>

              {/* Academic Program */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <GraduationCap size={13} color="#e5a900" />
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Program</span>
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', wordBreak: 'break-word' }}>
                  {program}
                </div>
              </div>

              {/* Gender */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <User size={12} color="#e5a900" />
                  <span>Gender</span>
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', wordBreak: 'break-word' }}>
                  {gender}
                </div>
              </div>

              {/* Contact Number */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Phone size={12} color="#e5a900" />
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Contact</span>
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                  {contactNumber}
                </div>
              </div>

              {/* Religion */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Shield size={12} color="#e5a900" />
                  <span>Religion</span>
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', wordBreak: 'break-word' }}>
                  {religion}
                </div>
              </div>

              {/* Row 2: Permanent Address (Full Width across 2 columns) */}
              <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`, paddingTop: '0.85rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={12} color="#e5a900" />
                  <span>Permanent Address</span>
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', wordBreak: 'break-word' }}>
                  {permanentAddress}
                </div>
              </div>
            </div>

            {/* Unit Echelon Breadcrumb Strip */}
            <div
              className="cadet-formation-strip"
              style={{
                borderTop: `1px solid ${t.cardBorder}`
              }}
            >
              <div
                className="cadet-formation-label"
                style={{
                  fontSize: '0.74rem',
                  color: t.textMuted,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0
                }}
              >
                Assigned Formation:
              </div>
              <div
                className="cadet-formation-tags-wrap"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  whiteSpace: 'nowrap',
                  gap: '6px'
                }}
              >
                <div
                  className="cadet-formation-pill cadet-formation-pill-battalion"
                  style={{
                    background: isLight ? '#dbeafe' : 'rgba(30, 58, 138, 0.35)',
                    border: isLight ? '1px solid #bfdbfe' : '1px solid rgba(96, 165, 250, 0.4)',
                    color: isLight ? '#1d4ed8' : '#93c5fd',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {battalion}
                </div>
                <ChevronRight size={13} color={t.textSubtle} style={{ flexShrink: 0 }} />
                <div
                  className="cadet-formation-pill cadet-formation-pill-company"
                  style={{
                    background: isLight ? '#d1fae5' : 'rgba(6, 78, 46, 0.35)',
                    border: isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.4)',
                    color: isLight ? '#065f46' : '#6ee7b7',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {company}
                </div>
                <ChevronRight size={13} color={t.textSubtle} style={{ flexShrink: 0 }} />
                <div
                  className="cadet-formation-pill cadet-formation-pill-platoon"
                  style={{
                    background: isLight ? '#fef3c7' : 'rgba(120, 53, 15, 0.35)',
                    border: isLight ? '1px solid #fcd34d' : '1px solid rgba(245, 158, 11, 0.4)',
                    color: isLight ? '#78350f' : '#fde68a',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {platoon}
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 4. ATTENDANCE STANDING & PERFORMANCE STATUS BANNER           */}
          {/* ============================================================ */}
          <div
            className="cadet-standing-card"
            style={{
              background: t.cardBg,
              border: `1.5px solid ${isDropped ? '#f43f5e' : isPenalty ? '#ea580c' : isWarning ? '#f59e0b' : '#10b981'}`,
              boxShadow: t.cardShadow
            }}
          >
            <div className="cadet-standing-info">
              <div
                style={{
                  width: 'clamp(34px, 8vw, 42px)',
                  height: 'clamp(34px, 8vw, 42px)',
                  borderRadius: '10px',
                  background: isDropped
                    ? 'rgba(244, 63, 94, 0.12)'
                    : isPenalty
                      ? 'rgba(234, 88, 12, 0.12)'
                      : isWarning
                        ? 'rgba(245, 158, 11, 0.12)'
                        : 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDropped ? '#f43f5e' : isPenalty ? '#ea580c' : isWarning ? '#f59e0b' : '#10b981',
                  flexShrink: 0
                }}
              >
                <Activity size={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.68rem', color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                  ROTC Standing
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'nowrap' }}>
                  <span
                    style={{
                      background: isDropped
                        ? 'rgba(244, 63, 94, 0.15)'
                        : isPenalty
                          ? 'rgba(234, 88, 12, 0.15)'
                          : isWarning
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                      color: isDropped ? '#e11d48' : isPenalty ? '#ea580c' : isWarning ? '#d97706' : '#059669',
                      border: `1px solid ${isDropped ? 'rgba(244, 63, 94, 0.3)' : isPenalty ? 'rgba(234, 88, 12, 0.3)' : isWarning ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {isDropped ? 'DROPPED' : isPenalty ? (evaluated.badgeLabel || 'PENALTY / WARNING') : isWarning ? 'WARNING' : 'GOOD STANDING'}
                  </span>
                  <span
                    className="cadet-standing-subtitle"
                    style={{
                      fontSize: '0.78rem',
                      color: t.textMuted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isDropped
                      ? 'Threshold of allowable absences exceeded.'
                      : isPenalty
                        ? (evaluated.reason || 'Converted penalty absences applied to record.')
                        : isWarning
                          ? 'Approaching allowable absence limit.'
                          : 'Compliant with military drill regulations.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="cadet-standing-rate-container" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.3px' }}>
                  Rate
                </div>
                <div
                  style={{
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: 'clamp(1.2rem, 3.8vw, 1.55rem)',
                    fontWeight: 900,
                    color: isDropped ? '#e11d48' : isPenalty ? '#ea580c' : isWarning ? '#d97706' : '#059669',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {metrics.complianceRate}%
                </div>
              </div>
              <div
                className="cadet-standing-progress-bar"
                style={{
                  background: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'block'
                }}
              >
                <div
                  style={{
                    width: `${metrics.complianceRate}%`,
                    height: '100%',
                    background: isDropped ? '#e11d48' : isPenalty ? '#ea580c' : isWarning ? '#d97706' : '#059669',
                    borderRadius: '999px',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 5. INTERACTIVE SUMMARY CARDS (MATCHING ADMIN UI)             */}
          {/* ============================================================ */}
          <section
            className="cadet-stats-section overflow-hidden"
            style={{
              overflow: 'hidden',
              width: '100%',
              position: 'relative'
            }}
          >
            <div
              className="cadet-stats-grid grid-cols-2 md:grid-cols-4"
              style={{
                display: 'grid',
                gap: '0.75rem',
                width: '100%'
              }}
            >
              {/* Row 1, Card 1: Total Formations (Full Width on mobile / Spans 2 cols on desktop) */}
              <div
                className="cadet-stat-card-total col-span-2 md:col-span-2"
                style={{
                  background: statusFilter === 'ALL'
                    ? (isLight ? '#f0fdf4' : 'rgba(6, 78, 46, 0.25)')
                    : t.cardBg,
                  border: `1px solid ${statusFilter === 'ALL' ? '#064e2e' : t.cardBorder}`,
                  borderLeft: `5px solid ${statusFilter === 'ALL' ? '#064e2e' : (isLight ? '#cbd5e1' : '#334155')}`,
                  borderRadius: '12px',
                  padding: 'clamp(0.85rem, 2.5vw, 1.1rem) clamp(0.85rem, 2.5vw, 1.25rem)',
                  cursor: 'pointer',
                  outline: statusFilter === 'ALL' ? '2px solid #064e2e' : 'none',
                  boxShadow: t.cardShadow,
                  transition: 'all 0.15s ease',
                  minWidth: 0
                }}
                onClick={() => handleStatusCardClick('ALL')}
                title="Click to show all formation drill sessions"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(6, 78, 46, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isLight ? '#064e2e' : '#34d399',
                      flexShrink: 0
                    }}
                  >
                    <Users size={20} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Formations
                    </div>
                    <div style={{ fontSize: 'clamp(1.25rem, 4vw, 1.45rem)', fontWeight: 800, color: t.textMain }}>
                      {counts.all} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted }}>
                  {statusFilter === 'ALL' ? '✓ Showing all drill dates' : 'Click to filter'}
                </div>
              </div>

              {/* Row 1, Card 2: PRESENT (Full Width on mobile / Spans 2 cols on desktop) */}
              <div
                className="cadet-stat-card-present col-span-2 md:col-span-2"
                style={{
                  background: statusFilter === 'PRESENT'
                    ? (isLight ? '#f0fdf4' : 'rgba(5, 150, 105, 0.2)')
                    : t.cardBg,
                  border: `1px solid ${statusFilter === 'PRESENT' ? '#059669' : t.cardBorder}`,
                  borderLeft: `5px solid ${statusFilter === 'PRESENT' ? '#059669' : (isLight ? '#d1fae5' : '#065f46')}`,
                  borderRadius: '12px',
                  padding: 'clamp(0.85rem, 2.5vw, 1.1rem) clamp(0.85rem, 2.5vw, 1.25rem)',
                  cursor: 'pointer',
                  outline: statusFilter === 'PRESENT' ? '2px solid #059669' : 'none',
                  boxShadow: t.cardShadow,
                  transition: 'all 0.15s ease',
                  minWidth: 0
                }}
                onClick={() => handleStatusCardClick('PRESENT')}
                title="Click to filter table: Present (On-Time) sessions only"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(5, 150, 105, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#059669',
                      flexShrink: 0
                    }}
                  >
                    <CheckCircle2 size={20} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Present
                    </div>
                    <div style={{ fontSize: 'clamp(1.25rem, 4vw, 1.45rem)', fontWeight: 800, color: isLight ? '#065f46' : '#34d399', whiteSpace: 'nowrap' }}>
                      {counts.present} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {statusFilter === 'PRESENT' ? '✓ Filtering by Present' : 'Click to filter'}
                </div>
              </div>

              {/* Row 2/3, Card 3: ABSENT (Left on mobile Row 3 / 1 col on desktop Row 2) */}
              <div
                className="cadet-stat-card-absent col-span-1 md:col-span-1"
                style={{
                  background: statusFilter === 'ABSENT'
                    ? (isLight ? '#fef2f2' : 'rgba(220, 38, 38, 0.2)')
                    : t.cardBg,
                  border: `1px solid ${statusFilter === 'ABSENT' ? '#dc2626' : t.cardBorder}`,
                  borderLeft: `5px solid ${statusFilter === 'ABSENT' ? '#dc2626' : (isLight ? '#fecaca' : '#7f1d1d')}`,
                  borderRadius: '12px',
                  padding: 'clamp(0.75rem, 2vw, 1.1rem) clamp(0.75rem, 2vw, 1.25rem)',
                  cursor: 'pointer',
                  outline: statusFilter === 'ABSENT' ? '2px solid #dc2626' : 'none',
                  boxShadow: t.cardShadow,
                  transition: 'all 0.15s ease',
                  minWidth: 0
                }}
                onClick={() => handleStatusCardClick('ABSENT')}
                title="Click to filter table: Absent / Missed sessions only"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(220, 38, 38, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#dc2626',
                      flexShrink: 0
                    }}
                  >
                    <AlertTriangle size={19} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Absent
                    </div>
                    <div style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.45rem)', fontWeight: 800, color: isLight ? '#b91c1c' : '#f87171', whiteSpace: 'nowrap' }}>
                      {counts.absent} <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 600 }}>Absences</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {statusFilter === 'ABSENT' ? '✓ Filtering by Absent' : 'Click to filter'}
                </div>
              </div>

              {/* Row 2/3, Card 4: EXCUSED (Right on mobile Row 3 / 1 col on desktop Row 2) */}
              <div
                className="cadet-stat-card-excused col-span-1 md:col-span-1"
                style={{
                  background: (statusFilter === 'EXCUSED' || statusFilter === 'EXCUSE')
                    ? (isLight ? '#faf5ff' : 'rgba(124, 58, 237, 0.2)')
                    : t.cardBg,
                  border: `1px solid ${(statusFilter === 'EXCUSED' || statusFilter === 'EXCUSE') ? '#7c3aed' : t.cardBorder}`,
                  borderLeft: `5px solid ${(statusFilter === 'EXCUSED' || statusFilter === 'EXCUSE') ? '#7c3aed' : (isLight ? '#ddd6fe' : '#5b21b6')}`,
                  borderRadius: '12px',
                  padding: 'clamp(0.75rem, 2vw, 1.1rem) clamp(0.75rem, 2vw, 1.25rem)',
                  cursor: 'pointer',
                  outline: (statusFilter === 'EXCUSED' || statusFilter === 'EXCUSE') ? '2px solid #7c3aed' : 'none',
                  boxShadow: t.cardShadow,
                  transition: 'all 0.15s ease',
                  minWidth: 0
                }}
                onClick={() => handleStatusCardClick('EXCUSED')}
                title="Click to filter table: Excused and pending excuse requests only"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(124, 58, 237, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#7c3aed',
                      flexShrink: 0
                    }}
                  >
                    <FileText size={19} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Excused
                    </div>
                    <div style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.45rem)', fontWeight: 800, color: isLight ? '#6d28d9' : '#c084fc', whiteSpace: 'nowrap' }}>
                      {counts.excused} <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(statusFilter === 'EXCUSED' || statusFilter === 'EXCUSE') ? '✓ Filtering by Excused' : 'Click to filter'}
                </div>
              </div>

              {/* Row 2/4, Card 5: LATE (Left on mobile Row 4 / 1 col on desktop Row 2) */}
              <div
                className="cadet-stat-card-late col-span-1 md:col-span-1"
                style={{
                  background: statusFilter === 'LATE'
                    ? (isLight ? '#fffbeb' : 'rgba(217, 119, 6, 0.2)')
                    : t.cardBg,
                  border: `1px solid ${statusFilter === 'LATE' ? '#d97706' : t.cardBorder}`,
                  borderLeft: `5px solid ${statusFilter === 'LATE' ? '#d97706' : (isLight ? '#fde68a' : '#78350f')}`,
                  borderRadius: '12px',
                  padding: 'clamp(0.75rem, 2vw, 1.1rem) clamp(0.75rem, 2vw, 1.25rem)',
                  cursor: 'pointer',
                  outline: statusFilter === 'LATE' ? '2px solid #d97706' : 'none',
                  boxShadow: t.cardShadow,
                  transition: 'all 0.15s ease',
                  minWidth: 0
                }}
                onClick={() => handleStatusCardClick('LATE')}
                title="Click to filter table: Late / Tardy sessions only"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(217, 119, 6, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#d97706',
                      flexShrink: 0
                    }}
                  >
                    <Clock size={19} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Late
                    </div>
                    <div style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.45rem)', fontWeight: 800, color: isLight ? '#92400e' : '#fbbf24', whiteSpace: 'nowrap' }}>
                      {counts.late} <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {statusFilter === 'LATE' ? '✓ Filtering by Late' : 'Click to filter'}
                </div>
              </div>

              {/* Row 2/4, Card 6: NO TIME IN/OUT (Right on mobile Row 4 / 1 col on desktop Row 2) */}
              <div
                className="cadet-stat-card-notime col-span-1 md:col-span-1"
                style={{
                  background: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME-IN')
                    ? (isLight ? '#fff7ed' : 'rgba(234, 88, 12, 0.2)')
                    : t.cardBg,
                  border: `1px solid ${(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME-IN') ? '#ea580c' : t.cardBorder}`,
                  borderLeft: `5px solid ${(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME-IN') ? '#ea580c' : (isLight ? '#fed7aa' : '#7c2d12')}`,
                  borderRadius: '12px',
                  padding: 'clamp(0.75rem, 2vw, 1.1rem) clamp(0.75rem, 2vw, 1.25rem)',
                  cursor: 'pointer',
                  outline: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME-IN') ? '2px solid #ea580c' : 'none',
                  boxShadow: t.cardShadow,
                  transition: 'all 0.15s ease',
                  minWidth: 0
                }}
                onClick={() => handleStatusCardClick('NO TIME IN/OUT')}
                title="Click to filter table: Incomplete time-in or time-out records"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(234, 88, 12, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ea580c',
                      flexShrink: 0
                    }}
                  >
                    <Activity size={19} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      No Time In/Out
                    </div>
                    <div style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.45rem)', fontWeight: 800, color: isLight ? '#9a3412' : '#fb923c', whiteSpace: 'nowrap' }}>
                      {counts.noTimeOut} <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME-IN') ? '✓ Incomplete only' : 'Click to filter'}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* 6. FORMATION DRILL SCHEDULE (STUDENT-FRIENDLY TABLE)          */}
          {/* ============================================================ */}
          <div
            className="overflow-visible relative"
            style={{
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: '16px',
              overflow: 'visible',
              position: 'relative',
              boxShadow: t.cardShadow,
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}
          >
            {/* Card Header & Controls */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: `1px solid ${t.cardBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: t.textMain, letterSpacing: '0.3px' }}>
                  FORMATION DRILL SCHEDULE
                </div>
                <div style={{ fontSize: '0.76rem', color: t.textMuted, marginTop: '2px' }}>
                  Official drill dates with verified time-in and time-out recordings
                </div>
              </div>

              <div className="cadet-drill-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>



                {/* Action row stretching 100% on mobile */}
                <div
                  className="cadet-drill-action-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    minWidth: '220px'
                  }}
                >
                  {/* Custom Formation Calendar Selector matching Admin Attendance History */}
                  <FormationCalendarSelector
                    selectedDate={searchDate}
                    onSelectDate={setSearchDate}
                    recordedDates={allRecordedFormationDates}
                    isLight={isLight}
                    isSessionsLoading={loadingLogs}
                    t={t}
                  />

                  {/* Background Cloud Syncing Status */}
                  {isBackgroundSyncing && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.72rem',
                        color: '#e5a900',
                        background: 'rgba(229, 169, 0, 0.1)',
                        border: '1px solid rgba(229, 169, 0, 0.25)',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '8px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      <RefreshCw size={11} className="animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  )}

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing || loadingLogs}
                    style={{
                      background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                      border: `1px solid ${t.cardBorder}`,
                      color: t.textMain,
                      padding: '0.42rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Friendly Data Table (Scrollable Container with Sticky Header & Horizontal Scroll) */}
            <div
              className="cadet-drill-table-container overflow-x-auto max-h-[420px] overflow-y-auto w-full"
              style={{
                maxHeight: '420px',
                overflowY: 'auto',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                position: 'relative',
                width: '100%'
              }}
            >
              <table
                className="cadet-drill-table"
                style={{
                  width: '100%',
                  minWidth: '640px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.84rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: t.tableHeadBg,
                    boxShadow: isLight ? '0 1px 3px rgba(0, 0, 0, 0.08)' : '0 2px 6px rgba(0, 0, 0, 0.35)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <tr style={{ background: t.tableHeadBg, borderBottom: `1px solid ${t.tableRowBorder}`, whiteSpace: 'nowrap' }}>
                    <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg, whiteSpace: 'nowrap' }}>Drill Date</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg, whiteSpace: 'nowrap' }}>Time-In</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg, whiteSpace: 'nowrap' }}>Time-Out</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg, whiteSpace: 'nowrap' }}>Attendance Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg, whiteSpace: 'nowrap' }}>Remarks / Rule Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '3.5rem', textAlign: 'center', color: t.textMuted, whiteSpace: 'nowrap' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#e5a900' }} />
                        <div>Loading attendance evaluation records...</div>
                      </td>
                    </tr>
                  ) : (displaySchedule.length === 0 && conversionRows.length === 0) ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: t.textMuted, whiteSpace: 'nowrap' }}>
                        <Calendar size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                        <div style={{ fontWeight: 700, color: t.textMain }}>No matching formation entries</div>
                        <div style={{ fontSize: '0.76rem', marginTop: '4px' }}>
                          {statusFilter === 'ALL'
                            ? 'No formation drill sessions recorded yet.'
                            : `No entries matching category "${statusFilter}".`}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* Synthetic Breakdown Rows for Converted Absences (Rules 5, 6, 7) */}
                      {conversionRows.map((row) => (
                        <tr
                          key={row.id}
                          style={{
                            borderBottom: `1px solid ${t.tableRowBorder}`,
                            background: isLight ? 'rgba(254, 242, 242, 0.7)' : 'rgba(239, 68, 68, 0.08)',
                            borderLeft: '4px solid #ef4444',
                            transition: 'background-color 0.15s ease',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {/* Drill Date Column */}
                          <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  color: isLight ? '#b45309' : '#fbbf24',
                                  background: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.18)',
                                  border: `1px solid ${isLight ? '#fde68a' : 'rgba(245, 158, 11, 0.4)'}`,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <AlertTriangle size={12} />
                                {row.ruleCode}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '4px', whiteSpace: 'nowrap' }}>
                              Automated Penalty Conversion
                            </div>
                          </td>

                          {/* Time In Column */}
                          <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: t.textSubtle,
                                fontStyle: 'italic',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              — Penalty System —
                            </span>
                          </td>

                          {/* Time Out Column */}
                          <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: t.textSubtle,
                                fontStyle: 'italic',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              — Rule Engine —
                            </span>
                          </td>

                          {/* Attendance Status Column */}
                          <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.18)',
                                border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.4)'}`,
                                color: isLight ? '#b91c1c' : '#f87171',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <AlertOctagon size={13} />
                              <span style={{ whiteSpace: 'nowrap' }}>CONVERTED ABSENT (+{row.conversions})</span>
                            </span>
                          </td>

                          {/* Remarks / Rule Impact Column */}
                          <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 800, color: isLight ? '#b91c1c' : '#f87171', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                              {row.detail}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: isLight ? '#92400e' : '#fbbf24', marginTop: '3px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {row.progress}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Formation Drill Schedule Rows */}
                      {displaySchedule.map((entry, idx) => {
                        const rawDate = entry.date || 'N/A';
                        const friendlyDate = formatFriendlyDate(rawDate);
                        const todayStr = toDateKey ? toDateKey(new Date()) : new Date().toISOString().slice(0, 10);
                        const activeCutoffTime = settings?.formation_cutoff_time || settings?.formationCutoffTime || settings?.morningCutoffTime || '07:30';
                        const sessionCutoff = (rawDate === todayStr ? activeCutoffTime : (sessionCutoffsByDate.get(rawDate) || entry.cutoffTime || entry.cutoff_time || activeCutoffTime)) || activeCutoffTime;
                        const formattedCutoff = formatCutoffDisplay(sessionCutoff);

                        const isValidTime = (val) => {
                          if (!val) return false;
                          const s = String(val).trim().toUpperCase();
                          return s !== '' && s !== '—' && s !== '-' && s !== 'NO TIME-OUT' && s !== 'NO TIME-IN' && s !== 'NULL' && s !== 'UNDEFINED';
                        };

                        const rawStatus = String(entry.status || '').toUpperCase();
                        const isExcusePending = rawStatus === 'EXCUSE_PENDING' || rawStatus === 'PENDING';
                        const isExcused = rawStatus === 'EXCUSED' || rawStatus === 'APPROVED' || rawStatus.includes('EXCUSED');
                        const isExcuse = isExcusePending || isExcused;
                        const hasActualScan = Boolean(entry.hasActualScan || entry.is_qr_scan || entry.isQrScan || entry.scanned_by || entry.scannedBy);

                        const hasTimeIn = Boolean(
                          (!isExcuse || hasActualScan) &&
                          (entry.hasTimeIn !== undefined
                            ? (entry.hasTimeIn && isValidTime(entry.timeIn))
                            : isValidTime(entry.timeIn))
                        );
                        const hasTimeOut = Boolean(
                          (!isExcuse || hasActualScan) &&
                          (entry.hasTimeOut !== undefined
                            ? (entry.hasTimeOut && isValidTime(entry.timeOut))
                            : isValidTime(entry.timeOut))
                        );
                        const timeInStr = hasTimeIn ? formatDisplayTime(entry.timeIn) : null;
                        const timeOutStr = hasTimeOut ? formatDisplayTime(entry.timeOut) : null;
                        const isRecorded = entry.isRecorded;

                        let isLate = false;
                        if (!isExcuse && hasTimeIn) {
                          if (sessionCutoff) {
                            try {
                              const timeInMins = parseTimeToMinutes(entry.timeIn);
                              const cutoffMins = parseCutoffMinutes(sessionCutoff);
                              if (!isNaN(timeInMins) && !isNaN(cutoffMins)) {
                                isLate = timeInMins > cutoffMins;
                              } else {
                                isLate = rawStatus.includes('LATE') || entry.dayType === 'LATE' || Boolean(entry.isLate);
                              }
                            } catch (_) {
                              isLate = rawStatus.includes('LATE') || entry.dayType === 'LATE' || Boolean(entry.isLate);
                            }
                          } else {
                            isLate = rawStatus.includes('LATE') || entry.dayType === 'LATE' || Boolean(entry.isLate);
                          }
                        }

                        // Check excuse status FIRST, then reconcile standard attendance rules
                        let badgeLabel = 'Absent';
                        let badgeBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.12)';
                        let badgeBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.35)';
                        let badgeColor = isLight ? '#b91c1c' : '#f87171';
                        let badgeIcon = <XCircle size={13} />;
                        let remarkText = entry.penaltyLabel || 'Unrecorded Formation Day';

                        if (isExcusePending) {
                          badgeLabel = 'EXCUSE_PENDING';
                          badgeBg = isLight ? '#faf5ff' : 'rgba(168, 85, 247, 0.15)';
                          badgeBorder = isLight ? '#d8b4fe' : 'rgba(168, 85, 247, 0.4)';
                          badgeColor = isLight ? '#581c87' : '#c084fc';
                          badgeIcon = <span style={{ fontSize: '11px', lineHeight: 1 }}>🟣</span>;
                          remarkText = 'Online excuse submitted — Awaiting HQ Verification';
                        } else if (isExcused) {
                          badgeLabel = 'EXCUSED';
                          badgeBg = isLight ? '#f0f9ff' : 'rgba(14, 165, 233, 0.15)';
                          badgeBorder = isLight ? '#7dd3fc' : 'rgba(14, 165, 233, 0.4)';
                          badgeColor = isLight ? '#075985' : '#38bdf8';
                          badgeIcon = <span style={{ fontSize: '11px', lineHeight: 1 }}>🔵</span>;
                          remarkText = 'Official Excuse Approved by Admin';
                        } else if (hasTimeIn && !hasTimeOut) {
                          badgeLabel = isLate ? 'Late / No Time-Out' : 'No Time-Out';
                          badgeBg = isLate
                            ? (isLight ? '#fff7ed' : 'rgba(234, 88, 12, 0.15)')
                            : (isLight ? '#ffedd5' : 'rgba(249, 115, 22, 0.15)');
                          badgeBorder = isLate
                            ? (isLight ? '#fed7aa' : 'rgba(234, 88, 12, 0.4)')
                            : (isLight ? '#fed7aa' : 'rgba(249, 115, 22, 0.4)');
                          badgeColor = isLate ? '#ea580c' : (isLight ? '#c2410c' : '#fb923c');
                          badgeIcon = <Clock size={13} color={badgeColor} />;
                          remarkText = isLate
                            ? 'Late scan & Missing Time-Out Scan (+0.50 penalty)'
                            : 'Missing Time-Out Scan (+1/4 session penalty)';
                        } else if (!hasTimeIn && hasTimeOut) {
                          badgeLabel = 'No Time-In';
                          badgeBg = isLight ? '#ffedd5' : 'rgba(249, 115, 22, 0.15)';
                          badgeBorder = isLight ? '#fed7aa' : 'rgba(249, 115, 22, 0.4)';
                          badgeColor = isLight ? '#c2410c' : '#fb923c';
                          badgeIcon = <Clock size={13} color={badgeColor} />;
                          remarkText = 'Missing Time-In Scan (+1/4 session penalty)';
                        } else if (!hasTimeIn && !hasTimeOut || !isRecorded || rawStatus.includes('UNRECORDED') || rawStatus === 'ABSENT') {
                          badgeLabel = 'Absent';
                          badgeBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.12)';
                          badgeBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.35)';
                          badgeColor = isLight ? '#b91c1c' : '#f87171';
                          badgeIcon = <XCircle size={13} />;
                          remarkText = entry.penaltyLabel || 'Official Absent / Unrecorded Formation Day';
                        } else if (hasTimeIn && hasTimeOut) {
                          if (isLate) {
                            badgeLabel = 'Late (Tardy)';
                            badgeBg = isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.15)';
                            badgeBorder = isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.4)';
                            badgeColor = '#d97706';
                            badgeIcon = <Clock size={13} color="#d97706" />;
                            remarkText = entry.penaltyLabel || 'Late scan (+0.25 interval penalty)';
                          } else {
                            badgeLabel = 'Present';
                            badgeBg = isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.15)';
                            badgeBorder = isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.4)';
                            badgeColor = isLight ? '#15803d' : '#34d399';
                            badgeIcon = <CheckCircle2 size={13} />;
                            remarkText = 'Verified Formation Attendance (Compliant)';
                          }
                        } else {
                          badgeLabel = 'Absent';
                          badgeBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.12)';
                          badgeBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.35)';
                          badgeColor = isLight ? '#b91c1c' : '#f87171';
                          badgeIcon = <XCircle size={13} />;
                          remarkText = entry.penaltyLabel || 'Unrecorded Formation Day';
                        }

                        return (
                          <tr
                            key={`${rawDate}_${idx}`}
                            style={{
                              borderBottom: `1px solid ${t.tableRowBorder}`,
                              background: idx % 2 === 0 ? 'transparent' : t.tableAltRow,
                              transition: 'background-color 0.15s ease',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {/* Friendly Date & Cut-off Time */}
                            <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                                {friendlyDate}
                              </div>
                              <div style={{ marginTop: '4px', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: isLight ? '#92400e' : '#d97706',
                                    background: isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.15)',
                                    border: `1px solid ${isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.35)'}`,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span>Cut-off: {formattedCutoff}</span>
                                </span>
                              </div>
                            </td>

                            {/* Time In */}
                            <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                              {timeInStr ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: isLate
                                      ? (isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.15)')
                                      : (isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.1)'),
                                    border: `1px solid ${isLate
                                      ? (isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.35)')
                                      : (isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.25)')
                                      }`,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontWeight: 800,
                                      color: isLate ? '#d97706' : (isLight ? '#15803d' : '#34d399'),
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {timeInStr}
                                  </span>
                                </div>
                              ) : isExcuse ? (
                                <span style={{ color: t.textSubtle, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>—</span>
                              ) : hasTimeOut ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: isLight ? '#ffedd5' : 'rgba(249, 115, 22, 0.12)',
                                    border: isLight ? '1px solid #fed7aa' : '1px solid rgba(249, 115, 22, 0.3)',
                                    color: isLight ? '#c2410c' : '#fb923c',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  No Time-In
                                </span>
                              ) : (
                                <span style={{ color: t.textSubtle, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>—</span>
                              )}
                            </td>

                            {/* Time Out */}
                            <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                              {timeOutStr ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.1)',
                                    border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.25)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontWeight: 800,
                                      color: isLight ? '#15803d' : '#34d399',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {timeOutStr}
                                  </span>
                                </div>
                              ) : isExcuse ? (
                                <span style={{ color: t.textSubtle, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>—</span>
                              ) : hasTimeIn ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: isLight ? '#ffedd5' : 'rgba(249, 115, 22, 0.12)',
                                    border: isLight ? '1px solid #fed7aa' : '1px solid rgba(249, 115, 22, 0.3)',
                                    color: isLight ? '#c2410c' : '#fb923c',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  No Time-Out
                                </span>
                              ) : (
                                <span style={{ color: t.textSubtle, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>—</span>
                              )}
                            </td>

                            {/* Status Badge */}
                            <td style={{ padding: '0.9rem 1.25rem', whiteSpace: 'nowrap' }}>
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: badgeBg,
                                  border: `1px solid ${badgeBorder}`,
                                  color: badgeColor,
                                  padding: '4px 12px',
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 900,
                                  letterSpacing: '0.025em',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {badgeIcon}
                                <span style={{ whiteSpace: 'nowrap' }}>{badgeLabel}</span>
                              </span>
                            </td>

                            {/* Remarks */}
                            <td
                              style={{
                                padding: '0.9rem 1.25rem',
                                fontSize: '0.8rem',
                                color: isRecorded ? t.textMain : isLight ? '#b91c1c' : '#fca5a5',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span>{remarkText}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================ */}
          {/* EXCUSE REQUEST MODAL                                         */}
          {/* ============================================================ */}
          {showExcuseModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem'
              }}
              onClick={(e) => { if (e.target === e.currentTarget) { setShowExcuseModal(false); setExcuseResult(null); } }}
            >
              <div
                className="overflow-visible relative"
                style={{
                  background: isLight ? '#ffffff' : '#1e2836',
                  borderRadius: '16px',
                  padding: '1.75rem',
                  width: '100%',
                  maxWidth: '500px',
                  overflow: 'visible',
                  position: 'relative',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.1rem'
                }}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={16} color="#d97706" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: isLight ? '#1e293b' : '#f1f5f9' }}>File Excuse Request</div>
                      <div style={{ fontSize: '0.73rem', color: isLight ? '#64748b' : '#94a3b8' }}>For formation absence on a past date</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowExcuseModal(false); setExcuseResult(null); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isLight ? '#64748b' : '#94a3b8', padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Drill Date Selection (Restricted Calendar Picker matching Policy Window) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#374151' : '#cbd5e1' }}>
                      Drill Date Selection <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: isLight ? '#b45309' : '#fbbf24',
                        background: isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.2)',
                        border: `1px solid ${isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.4)'}`,
                        padding: '1px 7px',
                        borderRadius: '9999px'
                      }}
                    >
                      Policy: {gracePeriodDays}-Day Filing Window
                    </span>
                  </div>

                  {/* Empty State / Status Alert Handling */}
                  {isAlreadyApproved || (isAllExcusedCompliant && !isAlreadyRejected && !isAlreadyPending) ? (
                    <div
                      style={{
                        background: isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.12)',
                        border: isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <CheckCircle2 size={18} color={isLight ? '#059669' : '#34d399'} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isLight ? '#065f46' : '#34d399' }}>
                          All Excused / Compliant — 0 Active Absences
                        </div>
                        <div style={{ fontSize: '0.74rem', color: isLight ? '#047857' : '#a7f3d0', marginTop: '3px', lineHeight: 1.4 }}>
                          {isAlreadyApproved
                            ? `The excuse request for ${formatHumanDate(excuseForm.targetDate)} has already been approved by Admin HQ. Status is officially EXCUSED with 0 pending absences.`
                            : `All recorded formation absences have been officially approved and excused by Headquarters. You currently have 0 active absences and no pending excuse letters requiring review.`}
                        </div>
                      </div>
                    </div>
                  ) : isAlreadyRejected ? (
                    <div
                      style={{
                        background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                        border: isLight ? '1px solid #fecaca' : '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <XCircle size={18} color={isLight ? '#dc2626' : '#f87171'} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isLight ? '#991b1b' : '#f87171' }}>
                          Excuse Request Rejected by HQ — Re-filing Prohibited
                        </div>
                        <div style={{ fontSize: '0.74rem', color: isLight ? '#7f1d1d' : '#fca5a5', marginTop: '3px', lineHeight: 1.4 }}>
                          The excuse request for this formation was previously reviewed and rejected by Headquarters. Under ROTC attendance regulations, rejected sessions cannot be re-filed.
                        </div>
                      </div>
                    </div>
                  ) : hasNoRemainingUnsubmitted ? (
                    <div
                      style={{
                        background: isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.12)',
                        border: isLight ? '1px solid #fde68a' : '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <Clock size={18} color={isLight ? '#d97706' : '#fbbf24'} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isLight ? '#92400e' : '#fbbf24' }}>
                          Excuse Request Already Submitted — Pending Admin Review
                        </div>
                        <div style={{ fontSize: '0.74rem', color: isLight ? '#b45309' : '#fef08a', marginTop: '3px', lineHeight: 1.4 }}>
                          You have already submitted an excuse request for all recorded absences within the {gracePeriodDays}-day filing window. Your submission is currently awaiting headquarters review. Duplicate submissions are disabled.
                        </div>
                      </div>
                    </div>
                  ) : eligibleAbsentDates.length === 0 ? (
                    <div
                      style={{
                        background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                        border: isLight ? '1px solid #fecaca' : '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <AlertOctagon size={18} color={isLight ? '#dc2626' : '#f87171'} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isLight ? '#991b1b' : '#f87171' }}>
                          No eligible absent records found within the filing window.
                        </div>
                        <div style={{ fontSize: '0.74rem', color: isLight ? '#7f1d1d' : '#fca5a5', marginTop: '3px', lineHeight: 1.4 }}>
                          {expiredAbsentDrillDates.length > 0
                            ? `You have ${expiredAbsentDrillDates.length} recorded absence(s), but they exceeded the official ${gracePeriodDays}-day filing policy window (considering cut-off time). Online excuse letters can no longer be submitted.`
                            : `Excuse letters can only be filed for absent formations. You have 0 absent records within the ${gracePeriodDays}-day filing window (cadets marked Present or Late are not eligible).`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                      <span>
                        🟢 <strong>{eligibleAbsentDates.length}</strong> eligible absent date{eligibleAbsentDates.length > 1 ? 's' : ''} available (Policy: {gracePeriodDays}-Day Filing Window)
                      </span>
                      {expiredAbsentDrillDates.length > 0 && (
                        <span style={{ color: isLight ? '#b91c1c' : '#fca5a5', fontWeight: 600 }}>
                          ⚠️ {expiredAbsentDrillDates.length} older absent date{expiredAbsentDrillDates.length > 1 ? 's' : ''} expired
                        </span>
                      )}
                    </div>
                  )}

                  {/* Status banner when selecting an already-approved date */}
                  {isAlreadyApproved && !isAlreadyRejected && (
                    <div
                      style={{
                        background: isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.12)',
                        border: isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        marginBottom: '0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.76rem',
                        color: isLight ? '#065f46' : '#34d399',
                        fontWeight: 600
                      }}
                    >
                      <CheckCircle2 size={15} color={isLight ? '#059669' : '#34d399'} style={{ flexShrink: 0 }} />
                      <span>The excuse request for this formation date has been reviewed and APPROVED by Admin HQ. Status: EXCUSED.</span>
                    </div>
                  )}

                  {/* Warning banner when selecting an already-submitted date while other unsubmitted dates remain */}
                  {isAlreadyPending && !hasNoRemainingUnsubmitted && !isAlreadyRejected && (
                    <div
                      style={{
                        background: isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.12)',
                        border: isLight ? '1px solid #fde68a' : '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        marginBottom: '0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.76rem',
                        color: isLight ? '#92400e' : '#fbbf24',
                        fontWeight: 600
                      }}
                    >
                      <Clock size={15} color={isLight ? '#d97706' : '#fbbf24'} style={{ flexShrink: 0 }} />
                      <span>An excuse request for this formation date has already been submitted and is currently pending admin review.</span>
                    </div>
                  )}

                  {/* Formation Calendar Selector: enables eligible absent dates and shows already submitted/approved/rejected dates */}
                  <FormationCalendarSelector
                    selectedDate={excuseForm.targetDate}
                    onSelectDate={dateKey => {
                      setExcuseForm(prev => ({ ...prev, targetDate: dateKey }));
                      if (excuseResult) setExcuseResult(null);
                    }}
                    recordedDates={eligibleAbsentDates.map(d => d.date)}
                    submittedDates={excuseCalendarPendingDates}
                    approvedDates={excuseCalendarApprovedDates}
                    rejectedDates={excuseCalendarRejectedDates}
                    disabled={excuseCalendarRecordedDates.length === 0}
                    placeholder={
                      isAlreadyApproved
                        ? 'Excuse Approved by HQ (EXCUSED)'
                        : isAlreadyRejected
                          ? 'Excuse Request Rejected by HQ'
                          : hasNoRemainingUnsubmitted
                            ? 'Excuse Request Already Submitted'
                            : isAllExcusedCompliant
                              ? 'All Excused / Compliant'
                              : eligibleAbsentDates.length === 0
                                ? 'No eligible absent records found'
                                : 'Select an Eligible Absent Date'
                    }
                    legendLabel="Eligible Absent Date"
                    allowClear={false}
                    isLight={isLight}
                    t={t}
                    fullWidth={true}
                  />
                </div>

                {/* Reason */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: isLight ? '#374151' : '#cbd5e1', marginBottom: '4px' }}>
                    Reason for Absence <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder={
                      isAlreadyApproved
                        ? 'Excuse request for this date was approved by HQ (Status: EXCUSED)...'
                        : isAlreadyRejected
                          ? 'Excuse request for this date was rejected by HQ (re-filing not allowed)...'
                          : showAlreadySubmittedBadge
                            ? 'Excuse request already submitted for this date (pending admin review)...'
                            : isAllExcusedCompliant
                              ? 'All absences have been excused. No pending absences remain...'
                              : 'Briefly describe why you were absent from this formation...'
                    }
                    value={excuseForm.reason}
                    disabled={showAlreadySubmittedBadge || isAlreadyRejected || isAlreadyApproved || isAllExcusedCompliant}
                    onChange={e => setExcuseForm(prev => ({ ...prev, reason: e.target.value }))}
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                      border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.12)',
                      background: (showAlreadySubmittedBadge || isAlreadyRejected || isAlreadyApproved || isAllExcusedCompliant)
                        ? (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)')
                        : (isLight ? '#f9fafb' : 'rgba(255,255,255,0.05)'),
                      color: (showAlreadySubmittedBadge || isAlreadyRejected || isAlreadyApproved || isAllExcusedCompliant)
                        ? (isLight ? '#94a3b8' : '#64748b')
                        : (isLight ? '#1e293b' : '#f1f5f9'),
                      fontSize: '0.85rem', outline: 'none', resize: 'vertical',
                      fontFamily: 'inherit', boxSizing: 'border-box',
                      cursor: (showAlreadySubmittedBadge || isAlreadyRejected || isAlreadyApproved || isAllExcusedCompliant) ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                {/* Result Message */}
                {excuseResult && (
                  <div style={{
                    padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600,
                    background: excuseResult.success ? '#ecfdf5' : '#fef2f2',
                    color: excuseResult.success ? '#065f46' : '#991b1b',
                    border: `1px solid ${excuseResult.success ? '#a7f3d0' : '#fecaca'}`
                  }}>
                    {excuseResult.message}
                  </div>
                )}

                {/* Dedicated Badges */}
                {isAlreadyApproved || (isAllExcusedCompliant && !isAlreadyRejected && !showAlreadySubmittedBadge) ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      background: isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)',
                      border: `1.5px solid ${isLight ? '#10b981' : 'rgba(16, 185, 129, 0.5)'}`,
                      color: isLight ? '#065f46' : '#34d399',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
                      letterSpacing: '0.2px'
                    }}
                  >
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>All Excused / Compliant — No Pending Absences</span>
                  </div>
                ) : isAlreadyRejected ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)',
                      border: `1.5px solid ${isLight ? '#ef4444' : 'rgba(239, 68, 68, 0.5)'}`,
                      color: isLight ? '#991b1b' : '#f87171',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)',
                      letterSpacing: '0.2px'
                    }}
                  >
                    <XCircle size={16} style={{ flexShrink: 0 }} />
                    <span>Excuse Request Rejected by HQ — Re-filing Prohibited</span>
                  </div>
                ) : showAlreadySubmittedBadge ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      background: isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.15)',
                      border: `1.5px solid ${isLight ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)'}`,
                      color: isLight ? '#92400e' : '#fbbf24',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
                      letterSpacing: '0.2px'
                    }}
                  >
                    <Clock size={16} style={{ flexShrink: 0 }} />
                    <span>Excuse Request Already Submitted — Pending Admin Review</span>
                  </div>
                ) : null}

                {/* Submit Button */}
                <button
                  type="button"
                  disabled={
                    excuseSubmitting ||
                    showAlreadySubmittedBadge ||
                    isAlreadyRejected ||
                    isAlreadyApproved ||
                    isAllExcusedCompliant ||
                    eligibleAbsentDates.length === 0 ||
                    !excuseForm.targetDate
                  }
                  onClick={handleSubmitExcuse}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '0.75rem 1.25rem', borderRadius: '10px',
                    fontSize: '0.88rem', fontWeight: 800,
                    cursor: (excuseSubmitting || showAlreadySubmittedBadge || isAlreadyRejected || isAlreadyApproved || isAllExcusedCompliant || eligibleAbsentDates.length === 0 || !excuseForm.targetDate) ? 'not-allowed' : 'pointer',
                    background: (isAlreadyApproved || isAllExcusedCompliant)
                      ? (isLight ? '#059669' : '#10b981')
                      : (excuseSubmitting || showAlreadySubmittedBadge || isAlreadyRejected || eligibleAbsentDates.length === 0 || !excuseForm.targetDate)
                        ? '#9ca3af'
                        : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#ffffff', border: 'none',
                    boxShadow: (excuseSubmitting || showAlreadySubmittedBadge || isAlreadyRejected || eligibleAbsentDates.length === 0 || !excuseForm.targetDate) && !(isAlreadyApproved || isAllExcusedCompliant) ? 'none' : '0 4px 14px rgba(217, 119, 6, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {(isAlreadyApproved || isAllExcusedCompliant) ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Send size={15} />
                  )}
                  {excuseSubmitting
                    ? 'Submitting...'
                    : (isAlreadyApproved || isAllExcusedCompliant)
                      ? 'All Excused / Compliant'
                      : isAlreadyRejected
                        ? 'Excuse Request Rejected by HQ'
                        : showAlreadySubmittedBadge
                          ? 'Excuse Request Already Submitted'
                          : eligibleAbsentDates.length === 0
                            ? 'No Eligible Absent Records'
                            : 'Submit Excuse Request'}
                </button>

                <p style={{ margin: 0, fontSize: '0.72rem', color: isLight ? '#94a3b8' : '#64748b', textAlign: 'center' }}>
                  Your request will be reviewed by your unit's commanding officer. You will be notified of the outcome.
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 6. ATTENDANCE PERFORMANCE POLICY RULES REFERENCE CARD        */}
          {/* ============================================================ */}
          <div
            className="cadet-policy-card-wrapper"
            style={{
              backgroundColor: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: '16px',
              padding: 'clamp(1.15rem, 3vw, 1.75rem)',
              boxShadow: t.cardShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxSizing: 'border-box',
              width: '100%',
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}
          >
            {/* Section Title Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                borderBottom: `1px solid ${t.tableRowBorder}`,
                paddingBottom: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: isLight ? '#ecfdf5' : 'rgba(6, 78, 46, 0.35)',
                    border: isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isLight ? '#047857' : '#34d399',
                    flexShrink: 0
                  }}
                >
                  <Info size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      color: t.textMain,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontSize: 'clamp(0.8rem, 2.5vw, 0.86rem)',
                      fontFamily: "'Oswald', sans-serif",
                      lineHeight: 1.2
                    }}
                  >
                    Attendance Performance Policy Rules Reference
                  </span>
                  <div style={{ fontSize: '0.72rem', color: t.textMuted, lineHeight: 1.3 }}>
                    Standard Operating Procedures & Automated Demerit Conversions
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: isLight ? '#064e2e' : '#facc15',
                  background: isLight ? 'rgba(6, 78, 46, 0.08)' : 'rgba(229, 169, 0, 0.12)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: isLight ? '1px solid rgba(6, 78, 46, 0.18)' : '1px solid rgba(229, 169, 0, 0.3)',
                  whiteSpace: 'nowrap'
                }}
              >
                Official ROTC Training Manual Guidelines
              </span>
            </div>

            {/* 3-Column Policy Grid Cards (Responsive minmax) */}
            <div
              className="cadet-policy-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                boxSizing: 'border-box'
              }}
            >
              {/* Card 1: Official Drop Policy (Crimson) */}
              <div
                style={{
                  backgroundColor: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.45)',
                  border: isLight ? '1px solid #fecdd3' : '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem',
                  boxShadow: isLight ? '0 1px 2px rgba(0, 0, 0, 0.03)' : 'none',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: isLight ? '#9f1239' : '#fca5a5',
                      backgroundColor: isLight ? '#ffe4e6' : 'rgba(244, 63, 94, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}
                  >
                    <AlertOctagon size={12} style={{ flexShrink: 0 }} /> Official Drop (Discharge)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: t.textSubtle, fontWeight: 700 }}>Rule 1 & 2</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: t.textMain, lineHeight: '1.55' }}>
                  <li style={{ marginBottom: '4px' }}><strong>3 Consecutive Absences:</strong> Triggers immediate official drop status.</li>
                  <li><strong>&gt; 3 Interval Absences:</strong> More than 3 total accumulated unexcused absences results in drop.</li>
                </ul>
              </div>

              {/* Card 2: Warning Threshold Policy (Amber) */}
              <div
                style={{
                  backgroundColor: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.45)',
                  border: isLight ? '1px solid #fde68a' : '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem',
                  boxShadow: isLight ? '0 1px 2px rgba(0, 0, 0, 0.03)' : 'none',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: isLight ? '#92400e' : '#fcd34d',
                      backgroundColor: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}
                  >
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} /> Warning Threshold
                  </span>
                  <span style={{ fontSize: '0.68rem', color: t.textSubtle, fontWeight: 700 }}>Rule 3 & 4</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: t.textMain, lineHeight: '1.55' }}>
                  <li style={{ marginBottom: '4px' }}><strong>3 Interval Absences:</strong> First official warning issued for impending drop.</li>
                  <li><strong>2 Absences:</strong> Early notification advisory for unit commander intervention.</li>
                </ul>
              </div>

              {/* Card 3: Tardiness & Missing Scans Conversions (Emerald / Teal) */}
              <div
                style={{
                  backgroundColor: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.45)',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem',
                  boxShadow: isLight ? '0 1px 2px rgba(0, 0, 0, 0.03)' : 'none',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: isLight ? '#0f766e' : '#5eead4',
                      backgroundColor: isLight ? '#ccfbf1' : 'rgba(20, 184, 166, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}
                  >
                    <Clock size={12} style={{ flexShrink: 0 }} /> Tardiness & Missing Scans
                  </span>
                  <span style={{ fontSize: '0.68rem', color: t.textSubtle, fontWeight: 700 }}>Rule 5, 6 & 7</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: t.textMain, lineHeight: '1.55' }}>
                  <li style={{ marginBottom: '4px' }}><strong>3 Consecutive Lates:</strong> Automatically penalized and converted to <strong>1 Absent</strong>.</li>
                  <li style={{ marginBottom: '4px' }}><strong>4 Interval Lates:</strong> Every 4 cumulative late scans converts to <strong>1 Absent</strong>.</li>
                  <li><strong>4 Interval No Time-In/Out:</strong> Every 4 missing scans converts to <strong>1 Absent</strong>.</li>
                </ul>
              </div>
            </div>
          </div>

        </main>

        {/* Digital ID Card Modal */}
        {showIdModal && (
          <div
            className="id-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              zIndex: 100
            }}
            onClick={() => setShowIdModal(false)}
          >
            <div
              className="id-modal-content"
              style={{
                background: isLight ? '#ffffff' : '#0f172a',
                border: '1.5px solid #e5a900',
                borderRadius: '16px',
                padding: '1.5rem',
                maxWidth: '360px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: '#e5a900', letterSpacing: '0.03em' }}>
                  OFFICIAL DIGITAL QR PASS
                </div>
                <button
                  type="button"
                  onClick={() => setShowIdModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLight ? '#64748b' : '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* QR Pass Card Preview (with ref for PDF and Print capture) */}
              <div className="qr-pass-preview-container" style={{ display: 'flex', justifyContent: 'center', padding: '0.25rem 0' }}>
                <IDCardPreview ref={passCardRef} card={cardPayload} />
              </div>

              <div className="no-print" style={{ textAlign: 'center', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', marginTop: '0.85rem' }}>
                Present this digital QR pass during formation scanning.
              </div>

              {/* Action Buttons: Download PDF and Print Pass */}
              <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: isExportingPdf ? '#94a3b8' : 'linear-gradient(135deg, #064e2e, #065f46)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: isExportingPdf ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(6, 78, 46, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Download size={15} />
                  <span>{isExportingPdf ? 'Saving PDF...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintPass}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '10px',
                    border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid rgba(255,255,255,0.18)',
                    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.06)',
                    color: isLight ? '#0f172a' : '#f8fafc',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Printer size={15} />
                  <span>Print Pass</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print Layout Rules (Matching Admin): Force standard A4 portrait top-left alignment */}
        <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          header,
          nav,
          aside,
          button,
          input,
          select,
          main {
            display: none !important;
            visibility: hidden !important;
          }
          .id-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          .id-modal-content {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            width: auto !important;
            max-width: none !important;
          }
          .qr-pass-preview-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          #printable-qr-pass,
          #cadet-digital-qr-pass,
          .qr-pass-tile {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            width: 164px !important;
            max-width: 168px !important;
            border: 1.5px solid #1a3a2a !important;
            border-radius: 6px !important;
            padding: 10px 8px !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      </div>
    </>
  );
}
