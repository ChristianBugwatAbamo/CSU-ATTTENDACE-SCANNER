import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Printer
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  fetchCadetAttendanceHistory,
  fetchSettingsFromSupabase,
  fetchMandatoryFormationDates,
  fetchAttendanceSessionsFromSupabase,
  fetchCadetByCadetId
} from '../utils/supabaseClient';
import { evaluateCadetAttendance, calculateCadetAbsences, toDateKey } from '../utils/attendanceRules';
import { formatDisplayTime, parseTimeToMinutes, parseCutoffMinutes } from '../utils/attendanceStatus';
import IDCardPreview from './IDCardPreview';
import MilitaryLoader from './MilitaryLoader';

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
      } catch (_) {}
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
      return cached ? JSON.parse(cached) : [];
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
        fetchCadetAttendanceHistory(activeCid, isManual),
        fetchSettingsFromSupabase(isManual),
        fetchMandatoryFormationDates(isManual),
        fetchAttendanceSessionsFromSupabase(isManual),
        fetchCadetByCadetId(activeCid)
      ]);

      if (historyLogs.status === 'fulfilled' && Array.isArray(historyLogs.value)) {
        setLogs(historyLogs.value);
        try {
          localStorage.setItem(`csu_rotc_cadet_logs_${activeCid}`, JSON.stringify(historyLogs.value));
        } catch (_) {}
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
    loadData(false);
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

  // 1. Official ROTC Rule Engine Evaluation
  const evaluated = useMemo(() => {
    return calculateCadetAbsences(
      {
        ...cadet,
        attendance_logs: logs
      },
      formationDates.length > 0 ? formationDates : undefined
    );
  }, [cadet, logs, formationDates]);

  // Determine official drop, warning, and penalty states
  const isDropped = Boolean(
    evaluated.status === 'DROPPED' ||
    cadet.status === 'DROPPED' ||
    cadet.enrollment_status === 'DROPPED' ||
    cadet.is_dropped
  );

  const isPenalty = !isDropped && Boolean(
    evaluated.status === 'PENALTY / WARNING' ||
    evaluated.status?.includes('PENALTY') ||
    evaluated.badgeLabel?.startsWith('Penalized')
  );

  const isWarning = !isDropped && !isPenalty && Boolean(
    evaluated.status === 'WARNING' ||
    evaluated.totalAbsences >= 2 ||
    cadet.status === 'WARNING'
  );

  // 2. Synchronized Attendance Metrics
  const metrics = useMemo(() => {
    // Total Drill Sessions: Total drill events published in Supabase
    const totalFormations = evaluated.totalFormations || evaluated.dailyBreakdown.length || formationDates.length || logs.length || 0;

    const onTimeCount = evaluated.dailyBreakdown.filter(d =>
      d.isRecorded && String(d.status || '').toUpperCase() === 'PRESENT'
    ).length;

    const lateCount = evaluated.dailyBreakdown.filter(d =>
      d.isRecorded && String(d.status || '').toUpperCase().includes('LATE')
    ).length;

    // Converted Absences: Raw Absences + ⌊Missing Scans/4⌋ + ⌊Interval Lates/4⌋ + ⌊Consecutive Lates/3⌋
    const convertedAbsences = evaluated.convertedAbsences ?? evaluated.totalAbsences ?? 0;
    const unexcused = evaluated.rawAbsences ?? evaluated.unexcusedAbsences ?? 0;
    const lates = lateCount || evaluated.totalIntervalLates;
    const missingScans = evaluated.totalIntervalMissingScans;
    const maxConsecutive = evaluated.maxConsecutiveAbsences;

    // Adjusted Attendance Rate: ((Total Formations - Converted Absences) / Total Formations) * 100
    const complianceRate = evaluated.adjustedAttendanceRate ?? (
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
      status: isDropped ? 'DROPPED' : isPenalty ? (evaluated.badgeLabel || 'PENALTY / WARNING') : isWarning ? 'WARNING' : 'GOOD',
      reason: evaluated.reason
    };
  }, [evaluated, formationDates, logs, isDropped, isPenalty, isWarning]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const all = evaluated.dailyBreakdown;
    const isValidTime = (val) => {
      if (!val) return false;
      const s = String(val).trim().toUpperCase();
      return s !== '' && s !== '—' && s !== '-' && s !== 'NO TIME-OUT' && s !== 'NO TIME-IN' && s !== 'NULL' && s !== 'UNDEFINED';
    };

    const present = all.filter(s => {
      if (!s.isRecorded) return false;
      const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
      const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
      const st = String(s.status || s.dayType || '').toUpperCase();
      return hasIn && hasOut && (s.dayType === 'PRESENT' || st.includes('PRESENT')) && !st.includes('LATE') && !st.includes('ABSENT');
    }).length;

    const late = all.filter(s => {
      if (!s.isRecorded) return false;
      const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
      const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
      const st = String(s.status || s.dayType || '').toUpperCase();
      return hasIn && hasOut && (st.includes('LATE') || s.dayType === 'LATE');
    }).length;

    // Incomplete Scans: Captures BOTH missing Time-In (!hasTimeIn && hasTimeOut) and missing Time-Out (hasTimeIn && !hasTimeOut)
    const noTimeOut = all.filter(s => {
      if (!s.isRecorded) return false;
      const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
      const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
      const st = String(s.status || s.dayType || '').toUpperCase();
      const isMissingTimeOut = (hasIn && !hasOut) || st.includes('NO TIME-OUT') || s.dayType === 'NO TIME-OUT';
      const isMissingTimeIn = (!hasIn && hasOut) || st.includes('NO TIME-IN') || s.dayType === 'NO TIME-IN';
      return isMissingTimeOut || isMissingTimeIn;
    }).length;

    // Converted Absences reflected in absent count
    const absent = evaluated.convertedAbsences !== undefined
      ? evaluated.convertedAbsences
      : (evaluated.totalAbsences ?? all.filter(s => {
        if (!s.isRecorded) return true;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return (!hasIn && !hasOut) || st.includes('ABSENT') || s.dayType === 'UNRECORDED' || s.dayType === 'ABSENT';
      }).length);

    return { all: all.length, present, late, noTimeOut, absent };
  }, [evaluated]);

  // 3. Filtered Formation Schedule
  const displaySchedule = useMemo(() => {
    let sessions = [...evaluated.dailyBreakdown].sort((a, b) => b.date.localeCompare(a.date));

    const isValidTime = (val) => {
      if (!val) return false;
      const s = String(val).trim().toUpperCase();
      return s !== '' && s !== '—' && s !== '-' && s !== 'NO TIME-OUT' && s !== 'NO TIME-IN' && s !== 'NULL' && s !== 'UNDEFINED';
    };

    if (statusFilter === 'PRESENT') {
      sessions = sessions.filter(s => {
        if (!s.isRecorded) return false;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return hasIn && hasOut && (s.dayType === 'PRESENT' || st.includes('PRESENT')) && !st.includes('LATE') && !st.includes('ABSENT');
      });
    } else if (statusFilter === 'LATE') {
      sessions = sessions.filter(s => {
        if (!s.isRecorded) return false;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return hasIn && hasOut && (st.includes('LATE') || s.dayType === 'LATE');
      });
    } else if (statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-IN') {
      sessions = sessions.filter(s => {
        if (!s.isRecorded) return false;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        const isMissingTimeOut = (hasIn && !hasOut) || st.includes('NO TIME-OUT') || s.dayType === 'NO TIME-OUT';
        const isMissingTimeIn = (!hasIn && hasOut) || st.includes('NO TIME-IN') || s.dayType === 'NO TIME-IN';
        return isMissingTimeOut || isMissingTimeIn;
      });
    } else if (statusFilter === 'ABSENT') {
      sessions = sessions.filter(s => {
        if (!s.isRecorded) return true;
        const hasIn = s.hasTimeIn !== undefined ? (s.hasTimeIn && isValidTime(s.timeIn)) : isValidTime(s.timeIn);
        const hasOut = s.hasTimeOut !== undefined ? (s.hasTimeOut && isValidTime(s.timeOut)) : isValidTime(s.timeOut);
        const st = String(s.status || s.dayType || '').toUpperCase();
        return (!hasIn && !hasOut) || st.includes('ABSENT') || s.dayType === 'UNRECORDED' || s.dayType === 'ABSENT';
      });
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
  }, [evaluated.dailyBreakdown, statusFilter, searchDate]);

  // 4. Synthetic Breakdown Rows for Converted Absences (Rules 5, 6, 7)
  const conversionRows = useMemo(() => {
    if (statusFilter !== 'ABSENT' || searchDate) return [];
    const rows = [];

    const missingScans = Number(evaluated.missingScans ?? evaluated.totalIntervalMissingScans ?? 0);
    const intervalLates = Number(evaluated.intervalLates ?? evaluated.totalIntervalLates ?? 0);
    const consecutiveLateConversions = Number(evaluated.consecutiveLateConversions ?? 0);

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
      {/* 1. Header Navigation Bar */}
      <header
        style={{
          backgroundColor: t.headerBg,
          borderBottom: '2px solid #e5a900',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#043820',
              border: '2px solid #e5a900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px',
              flexShrink: 0
            }}
          >
            <img
              src="/rotc-seal-transparent.png"
              alt="CSU ROTC"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.15rem',
                fontWeight: 800,
                letterSpacing: '0.5px',
                color: '#facc15',
                lineHeight: 1.2,
                whiteSpace: 'nowrap'
              }}
            >
              CADET PORTAL
            </div>
          </div>
        </div>

        {/* Header Right: Theme Toggle, User Info & Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Theme Toggle Button (Icon-Only Switch) */}
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {isLight ? <Moon size={17} color="#facc15" /> : <Sun size={17} color="#facc15" />}
          </button>

          <div
            style={{
              display: 'none',
              textAlign: 'right',
              fontSize: '0.82rem'
            }}
            className="md:block"
          >
            <div style={{ fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>{fullName}</div>
            <div style={{ fontSize: '0.72rem', color: '#f1f5f9', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{cadetId}</div>
          </div>

          {/* Sign Out Button (Icon-Only Action) */}
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleLogoutClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1.5px solid rgba(239, 68, 68, 0.5)',
              color: '#fecdd3',
              borderRadius: '8px',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; }}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

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
            className="cadet-stats-grid grid-cols-2"
            style={{
              display: 'grid',
              gap: '0.75rem',
              width: '100%'
            }}
          >
            {/* Card 1: Total Formations (Full Width / col-span-2 at top on mobile) */}
            <div
              className="cadet-stat-card-total col-span-2"
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

            {/* Card 2: PRESENT */}
            <div
              style={{
                background: statusFilter === 'PRESENT'
                  ? (isLight ? '#f0fdf4' : 'rgba(5, 150, 105, 0.2)')
                  : t.cardBg,
                border: `1px solid ${statusFilter === 'PRESENT' ? '#059669' : t.cardBorder}`,
                borderLeft: `5px solid ${statusFilter === 'PRESENT' ? '#059669' : (isLight ? '#d1fae5' : '#065f46')}`,
                borderRadius: '12px',
                padding: 'clamp(0.75rem, 2vw, 1.1rem) clamp(0.75rem, 2vw, 1.25rem)',
                cursor: 'pointer',
                outline: statusFilter === 'PRESENT' ? '2px solid #059669' : 'none',
                boxShadow: t.cardShadow,
                transition: 'all 0.15s ease',
                minWidth: 0
              }}
              onClick={() => handleStatusCardClick('PRESENT')}
              title="Click to filter table: Present (On-Time) sessions only"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(5, 150, 105, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#059669',
                    flexShrink: 0
                  }}
                >
                  <CheckCircle2 size={19} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Present
                  </div>
                  <div style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.45rem)', fontWeight: 800, color: isLight ? '#065f46' : '#34d399', whiteSpace: 'nowrap' }}>
                    {counts.present} <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {statusFilter === 'PRESENT' ? '✓ Filtering by Present' : 'Click to filter'}
              </div>
            </div>

            {/* Card 3: LATE */}
            <div
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

            {/* Card 4: NO TIME IN/OUT */}
            <div
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

            {/* Card 5: ABSENT CADETS */}
            <div
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
                    Absent Cadets
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
          </div>
        </section>

        {/* ============================================================ */}
        {/* 6. FORMATION DRILL SCHEDULE (STUDENT-FRIENDLY TABLE)          */}
        {/* ============================================================ */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '16px',
            overflow: 'hidden',
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
              {/* Active Filter Pill with Clear button */}
              {statusFilter !== 'ALL' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: isLight ? '#ecfdf5' : 'rgba(6, 78, 46, 0.3)',
                    border: '1px solid #059669',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: isLight ? '#065f46' : '#34d399',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>Active Filter: <strong>{statusFilter}</strong> ({displaySchedule.length + (statusFilter === 'ABSENT' ? conversionRows.length : 0)})</span>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 2px'
                    }}
                    title="Clear filter and show all"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

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
                {/* Date Filter Input */}
                <div
                  className="cadet-drill-date-filter"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: '8px',
                    padding: '0.35rem 0.65rem',
                    gap: '6px',
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  <Search size={13} color={t.textMuted} style={{ flexShrink: 0 }} />
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    title="Filter by date"
                    aria-label="Filter by date"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.76rem',
                      color: t.textMain,
                      width: '100%',
                      flex: 1,
                      minWidth: 0,
                      colorScheme: isLight ? 'light' : 'dark',
                      cursor: 'pointer'
                    }}
                  />
                  {searchDate && (
                    <button
                      type="button"
                      onClick={() => setSearchDate('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: t.textMuted,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                      title="Clear date filter"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

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
                    const activeCutoffTime = settings?.formation_cutoff_time || settings?.formationCutoffTime || settings?.morningCutoffTime || '07:30';
                    const sessionCutoff = sessionCutoffsByDate.get(rawDate) || entry.cutoffTime || entry.cutoff_time || activeCutoffTime;
                    const formattedCutoff = formatCutoffDisplay(sessionCutoff);

                    const isValidTime = (val) => {
                      if (!val) return false;
                      const s = String(val).trim().toUpperCase();
                      return s !== '' && s !== '—' && s !== '-' && s !== 'NO TIME-OUT' && s !== 'NO TIME-IN' && s !== 'NULL' && s !== 'UNDEFINED';
                    };

                    const hasTimeIn = Boolean(
                      entry.hasTimeIn !== undefined
                        ? (entry.hasTimeIn && isValidTime(entry.timeIn))
                        : isValidTime(entry.timeIn)
                    );
                    const hasTimeOut = Boolean(
                      entry.hasTimeOut !== undefined
                        ? (entry.hasTimeOut && isValidTime(entry.timeOut))
                        : isValidTime(entry.timeOut)
                    );
                    const timeInStr = hasTimeIn ? formatDisplayTime(entry.timeIn) : null;
                    const timeOutStr = hasTimeOut ? formatDisplayTime(entry.timeOut) : null;
                    const isRecorded = entry.isRecorded;
                    const rawStatus = String(entry.status || '').toUpperCase();
                    
                    let isLate = rawStatus.includes('LATE') || entry.dayType === 'LATE' || Boolean(entry.isLate);
                    if (!isLate && hasTimeIn && sessionCutoff) {
                      try {
                        const timeInMins = parseTimeToMinutes(entry.timeIn);
                        const cutoffMins = parseCutoffMinutes(sessionCutoff);
                        if (!isNaN(timeInMins) && !isNaN(cutoffMins) && timeInMins > cutoffMins) {
                          isLate = true;
                        }
                      } catch (_) {}
                    }

                    // Reconcile status badges cleanly per official rules:
                    // 1. hasTimeIn && !hasTimeOut -> Status: NO TIME-OUT
                    // 2. !hasTimeIn && hasTimeOut -> Status: NO TIME-IN
                    // 3. !hasTimeIn && !hasTimeOut -> Status: ABSENT
                    // 4. hasTimeIn && hasTimeOut  -> Status: PRESENT (or LATE based on cut-off)
                    let badgeLabel = 'Absent';
                    let badgeBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.12)';
                    let badgeBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.35)';
                    let badgeColor = isLight ? '#b91c1c' : '#f87171';
                    let badgeIcon = <XCircle size={13} />;
                    let remarkText = entry.penaltyLabel || 'Unrecorded Formation Day';

                    if (rawStatus.includes('EXCUSED')) {
                      badgeLabel = 'Excused';
                      badgeBg = isLight ? '#f3e8ff' : 'rgba(167, 139, 250, 0.15)';
                      badgeBorder = isLight ? '#e9d5ff' : 'rgba(167, 139, 250, 0.4)';
                      badgeColor = isLight ? '#7e22ce' : '#a78bfa';
                      badgeIcon = <Shield size={13} />;
                      remarkText = 'Official Excused Absence (No penalty)';
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
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              background: badgeBg,
                              border: `1px solid ${badgeBorder}`,
                              color: badgeColor,
                              padding: '3px 9px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
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
                          {remarkText}
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
