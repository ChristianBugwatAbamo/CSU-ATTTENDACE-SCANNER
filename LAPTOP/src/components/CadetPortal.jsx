import React, { useState, useEffect, useMemo } from 'react';
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
  CreditCard,
  X,
  Award,
  BookOpen,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronLeft,
  Menu,
  Activity,
  HelpCircle,
  MapPin,
  FileText,
  Sun,
  Moon,
  Phone,
  GraduationCap,
  Users
} from 'lucide-react';
import {
  fetchCadetAttendanceHistory,
  fetchSettingsFromSupabase,
  fetchMandatoryFormationDates,
  fetchAttendanceSessionsFromSupabase,
  fetchCadetByCadetId
} from '../utils/supabaseClient';
import { evaluateCadetAttendance, toDateKey } from '../utils/attendanceRules';
import { formatDisplayTime } from '../utils/attendanceStatus';
import IDCardPreview from './IDCardPreview';

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
  const [cadetProfile, setCadetProfile] = useState(cadet || {});
  const [logs, setLogs] = useState([]);
  const [formationDates, setFormationDates] = useState([]);
  const [dbSessions, setDbSessions] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showIdModal, setShowIdModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchDate, setSearchDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAlertDetails, setShowAlertDetails] = useState(true);

  // Navigation tab state ('profile' | 'status' | 'attendance')
  const [activeTab, setActiveTab] = useState('profile');

  // Persistent Collapsible Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('csu_rotc_cadet_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('csu_rotc_cadet_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

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

  const loadData = async () => {
    const cid = cadet?.id || cadet?.cadetId || cadet?.cadet_id || cadet?.student_id;
    if (!cid) return;
    setLoadingLogs(true);
    try {
      const [historyLogs, sbSettings, mDates, sessionsRes, liveCadetRes] = await Promise.allSettled([
        fetchCadetAttendanceHistory(cid),
        fetchSettingsFromSupabase(),
        fetchMandatoryFormationDates(),
        fetchAttendanceSessionsFromSupabase(),
        fetchCadetByCadetId(cid)
      ]);

      if (historyLogs.status === 'fulfilled' && Array.isArray(historyLogs.value)) {
        setLogs(historyLogs.value);
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
    }
  };

  useEffect(() => {
    loadData();
  }, [cadet?.id, cadet?.cadetId, cadet?.cadet_id, cadet?.student_id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
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
    return evaluateCadetAttendance(
      {
        ...cadet,
        attendance_logs: logs
      },
      formationDates.length > 0 ? formationDates : undefined
    );
  }, [cadet, logs, formationDates]);

  // Determine official drop and warning states
  const isDropped = Boolean(
    evaluated.status === 'DROPPED' ||
    cadet.status === 'DROPPED' ||
    cadet.enrollment_status === 'DROPPED' ||
    cadet.is_dropped
  );

  const isWarning = !isDropped && Boolean(
    evaluated.status === 'WARNING' ||
    evaluated.totalAbsences >= 2 ||
    cadet.status === 'WARNING'
  );

  // 2. Synchronized Attendance Metrics
  const metrics = useMemo(() => {
    // Total Drill Sessions: Total drill events published in Supabase
    const totalFormations = evaluated.dailyBreakdown.length || formationDates.length || logs.length || 0;

    // Sessions Attended: Count of logs matching STATUS == 'PRESENT', 'LATE', or 'NO TIME-OUT'
    const attendedSessions = evaluated.dailyBreakdown.filter(d => {
      if (!d.isRecorded) return false;
      const s = String(d.status || d.dayType || '').toUpperCase();
      return s.includes('PRESENT') || s.includes('LATE') || s.includes('NO TIME-OUT') || s.includes('NO TIME-IN');
    }).length;

    const onTimeCount = evaluated.dailyBreakdown.filter(d =>
      d.isRecorded && String(d.status || '').toUpperCase() === 'PRESENT'
    ).length;

    const lateCount = evaluated.dailyBreakdown.filter(d =>
      d.isRecorded && String(d.status || '').toUpperCase().includes('LATE')
    ).length;

    // Total Absences: Total Drill Sessions - Sessions Attended
    const absences = Math.max(0, totalFormations - attendedSessions);
    const unexcused = evaluated.unexcusedAbsences;
    const lates = lateCount || evaluated.totalIntervalLates;
    const missingScans = evaluated.totalIntervalMissingScans;
    const maxConsecutive = evaluated.maxConsecutiveAbsences;

    let complianceRate = 0;
    if (totalFormations > 0) {
      complianceRate = Math.round((attendedSessions / totalFormations) * 100);
    }

    return {
      totalFormations,
      attendedSessions,
      presentDays: onTimeCount,
      lates: lateCount,
      missingScans,
      absences,
      unexcused,
      maxConsecutive,
      complianceRate,
      status: isDropped ? 'DROPPED' : isWarning ? 'WARNING' : 'GOOD',
      reason: evaluated.reason
    };
  }, [evaluated, formationDates, logs, isDropped, isWarning]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const all = evaluated.dailyBreakdown;
    const present = all.filter(s => s.isRecorded && (s.dayType === 'PRESENT' || s.status === 'PRESENT') && !s.status.includes('LATE')).length;
    const late = all.filter(s => s.isRecorded && s.status.includes('LATE')).length;
    const noTimeOut = all.filter(s => s.isRecorded && (s.hasTimeIn && !s.hasTimeOut || s.status.includes('NO TIME-OUT') || s.dayType === 'NO TIME-OUT')).length;
    const absent = all.filter(s => !s.isRecorded || s.status.includes('ABSENT') || s.dayType === 'UNRECORDED').length;
    return { all: all.length, present, late, noTimeOut, absent };
  }, [evaluated.dailyBreakdown]);

  // 3. Filtered Formation Schedule
  const displaySchedule = useMemo(() => {
    let sessions = [...evaluated.dailyBreakdown].sort((a, b) => b.date.localeCompare(a.date));

    if (statusFilter === 'PRESENT') {
      sessions = sessions.filter(s => s.isRecorded && (s.dayType === 'PRESENT' || s.status === 'PRESENT') && !s.status.includes('LATE'));
    } else if (statusFilter === 'LATE') {
      sessions = sessions.filter(s => s.isRecorded && s.status.includes('LATE'));
    } else if (statusFilter === 'NO TIME-OUT' || statusFilter === 'NO TIME IN/OUT') {
      sessions = sessions.filter(s => s.isRecorded && (s.hasTimeIn && !s.hasTimeOut || s.status.includes('NO TIME-OUT') || s.dayType === 'NO TIME-OUT'));
    } else if (statusFilter === 'ABSENT') {
      sessions = sessions.filter(s => !s.isRecorded || s.status.includes('ABSENT') || s.dayType === 'UNRECORDED');
    }

    if (searchDate.trim()) {
      const query = searchDate.trim().toLowerCase();
      sessions = sessions.filter(s =>
        s.date.toLowerCase().includes(query) ||
        formatFriendlyDate(s.date).toLowerCase().includes(query)
      );
    }

    return sessions;
  }, [evaluated.dailyBreakdown, statusFilter, searchDate]);

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

  // 3 Primary Navigation Tabs for Persistent Sidebar
  const navTabs = [
    {
      id: 'profile',
      label: 'Cadet Profile',
      icon: User,
      badge: null,
      description: 'Personal & Unit Info'
    },
    {
      id: 'status',
      label: 'Status & Appeals',
      icon: Shield,
      badge: isDropped
        ? { text: 'DROPPED', color: '#ef4444' }
        : isWarning
        ? { text: 'WARNING', color: '#f59e0b' }
        : null,
      description: isDropped ? 'Action Required' : isWarning ? 'At Risk' : 'Good Standing'
    },
    {
      id: 'attendance',
      label: 'Attendance Log',
      icon: Calendar,
      badge: { text: String(counts.all || metrics.totalFormations || 0), color: '#10b981' },
      description: 'Formation Drill Records'
    }
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: t.bg,
        color: t.textMain,
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        transition: 'background-color 0.2s ease, color 0.2s ease',
        position: 'relative',
        width: '100vw',
        overflowX: 'hidden'
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .cadet-mobile-btn {
            display: flex !important;
          }
          .cadet-persistent-sidebar {
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            z-index: 99 !important;
          }
          .cadet-persistent-sidebar.mobile-open {
            transform: translateX(0) !important;
          }
        }
      `}</style>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 90
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ============================================================ */}
      {/* PERSISTENT VERTICAL COLLAPSIBLE SIDEBAR ON THE LEFT         */}
      {/* ============================================================ */}
      <aside
        style={{
          width: isSidebarCollapsed ? '76px' : '260px',
          backgroundColor: '#05331e',
          backgroundImage: 'linear-gradient(180deg, #05331f 0%, #032014 100%)',
          borderRight: '2px solid rgba(229, 169, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 50,
          flexShrink: 0,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
        className={`cadet-persistent-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}
      >
        {/* Sidebar Header: ROTC Seal, Title & Collapse Toggle */}
        <div
          style={{
            padding: isSidebarCollapsed ? '1rem 0.5rem' : '1.15rem 1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            gap: '10px',
            background: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#043820',
                border: '2px solid #e5a900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
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

            {!isSidebarCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    color: '#facc15',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  CADET PORTAL
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: '#94a3b8',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  CSU ROTC UNIT
                </div>
              </div>
            )}
          </div>

          {/* Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#facc15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250, 204, 21, 0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Navigation Tabs (Cadet Profile, Status & Appeals, Attendance Log) */}
        <div
          style={{
            flex: 1,
            padding: isSidebarCollapsed ? '1rem 0.4rem' : '1rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            overflowY: 'auto'
          }}
        >
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                title={isSidebarCollapsed ? tab.label : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isSidebarCollapsed ? '0' : '12px',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  width: '100%',
                  padding: isSidebarCollapsed ? '0.75rem 0' : '0.75rem 0.85rem',
                  borderRadius: '10px',
                  border: isActive ? '1px solid rgba(250, 204, 21, 0.4)' : '1px solid transparent',
                  borderLeft: isActive ? '4px solid #facc15' : '4px solid transparent',
                  background: isActive ? 'rgba(250, 204, 21, 0.14)' : 'transparent',
                  color: isActive ? '#facc15' : '#e2e8f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={isActive ? '#facc15' : '#cbd5e1'} />
                  {isSidebarCollapsed && tab.badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-6px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: tab.badge.color || '#ef4444',
                        boxShadow: '0 0 6px rgba(0,0,0,0.5)'
                      }}
                    />
                  )}
                </div>

                {!isSidebarCollapsed && (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: isActive ? 800 : 600, fontSize: '0.88rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tab.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isActive ? '#fef08a' : '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tab.description}
                      </div>
                    </div>

                    {tab.badge && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          background: `${tab.badge.color}22`,
                          color: tab.badge.color,
                          border: `1px solid ${tab.badge.color}66`,
                          flexShrink: 0
                        }}
                      >
                        {tab.badge.text}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: Cadet Summary & Relocated Sign Out Button */}
        <div
          style={{
            padding: isSidebarCollapsed ? '0.75rem 0.4rem' : '0.85rem 0.85rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {!isSidebarCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '4px 6px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#e5a900',
                  color: '#064e2e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}
              >
                {fullName ? fullName.charAt(0).toUpperCase() : 'C'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  {cadetId}
                </div>
              </div>
            </div>
          )}

          {/* Relocated Sign Out Button at Bottom of Sidebar */}
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: isSidebarCollapsed ? '0.65rem 0' : '0.6rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.28)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
              e.currentTarget.style.color = '#fca5a5';
            }}
          >
            <LogOut size={16} />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN VIEW COLUMN (HEADER + ACTIVE TAB CONTENT)               */}
      {/* ============================================================ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: '100vh',
          backgroundColor: t.bg
        }}
      >
        {/* Sticky Top Header Navigation Bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#facc15',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0
              }}
              className="cadet-mobile-btn"
              title="Toggle Navigation Menu"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  color: '#facc15',
                  lineHeight: 1.2
                }}
              >
                CADET PORTAL
              </div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>/</span>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem' }}>
                {activeTab === 'profile' ? 'Cadet Profile' : activeTab === 'status' ? 'Status & Appeals' : 'Attendance Log'}
              </span>
            </div>
          </div>

          {/* Header Right: Theme Toggle & Cadet Info (Sign Out Relocated to Sidebar) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={isLight ? 'Switch to Tactical Dark Mode' : 'Switch to Clean Light Mode'}
            >
              {isLight ? <Moon size={15} color="#facc15" /> : <Sun size={15} color="#facc15" />}
              <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>
            </button>

            <div
              style={{
                display: 'none',
                textAlign: 'right',
                fontSize: '0.82rem'
              }}
              className="md:block"
            >
              <div style={{ fontWeight: 800, color: '#ffffff' }}>{fullName}</div>
              <div style={{ fontSize: '0.72rem', color: '#f1f5f9', fontFamily: 'monospace' }}>{cadetId}</div>
            </div>
          </div>
        </header>

        {/* 2. Main Content Area */}
        <main
          style={{
            flex: 1,
            padding: '1.75rem 1rem',
            maxWidth: '1152px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative',
            zIndex: 10
          }}
          className="w-full max-w-6xl mx-auto px-4"
        >

        {/* ============================================================ */}
        {/* TAB 1: CADET PROFILE                                         */}
        {/* ============================================================ */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Quick alert banner if dropped */}
            {isDropped && (
              <div
                style={{
                  background: isLight ? '#fff1f2' : 'rgba(225, 29, 72, 0.15)',
                  border: '1.5px solid #f43f5e',
                  borderRadius: '12px',
                  padding: '0.85rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertOctagon size={22} color="#f43f5e" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#e11d48' }}>
                      Attendance Alert: Dropped from Rolls
                    </div>
                    <div style={{ fontSize: '0.78rem', color: t.textMuted }}>
                      Threshold of allowable unexcused absences has been exceeded. Official appeal process is available.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  style={{
                    background: '#e11d48',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  View Appeal Steps <ChevronRight size={14} />
                </button>
              </div>
            )}

        {/* ============================================================ */}
        {/* 3. HERO CADET PROFILE & FORMATION BREADCRUMB CARD            */}
        {/* ============================================================ */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: t.cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            transition: 'background-color 0.2s ease, border-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            {/* Cadet Avatar & Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
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
                  <User size={34} />
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span
                    style={{
                      background: 'rgba(229, 169, 0, 0.15)',
                      color: isLight ? '#b45309' : '#facc15',
                      border: '1px solid rgba(229, 169, 0, 0.35)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}
                  >
                    {rank}
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      background: t.insetBg,
                      color: t.textMuted,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${t.insetBorder}`,
                      fontWeight: 700
                    }}
                  >
                    ID: {cadetId}
                  </span>

                </div>

                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: t.textMain, letterSpacing: '0.2px' }}>
                  {fullName}
                </h1>
              </div>
            </div>

            {/* Digital ID Button */}
            <button
              type="button"
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
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#e5a900'; }}
            >
              <CreditCard size={16} /> View Digital ROTC ID Card
            </button>
          </div>

          {/* Cadet Detailed Profile Metadata Strip (Clean 2-Row Grid) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
              border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '12px',
              padding: '1.1rem 1.25rem'
            }}
          >
            {/* Department */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BookOpen size={12} color="#e5a900" />
                <span>Department</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px' }}>
                {department}
              </div>
            </div>

            {/* Academic Program */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <GraduationCap size={13} color="#e5a900" />
                <span>Academic Program</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px' }}>
                {program}
              </div>
            </div>

            {/* Gender */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={12} color="#e5a900" />
                <span>Gender</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px' }}>
                {gender}
              </div>
            </div>

            {/* Contact Number */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Phone size={12} color="#e5a900" />
                <span>Contact Number</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px', fontFamily: 'monospace' }}>
                {contactNumber}
              </div>
            </div>

            {/* Religion */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={12} color="#e5a900" />
                <span>Religion</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px' }}>
                {religion}
              </div>
            </div>

            {/* Row 2: Permanent Address (Full Width) */}
            <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`, paddingTop: '0.85rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={12} color="#e5a900" />
                <span>Permanent Address</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: t.textMain, marginTop: '4px' }}>
                {permanentAddress}
              </div>
            </div>
          </div>

          {/* Unit Echelon Breadcrumb Strip */}
          <div
            style={{
              borderTop: `1px solid ${t.cardBorder}`,
              paddingTop: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div style={{ fontSize: '0.74rem', color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Assigned Formation:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ background: t.insetBg, border: `1px solid ${t.insetBorder}`, borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, color: t.textMain }}>
                {battalion}
              </div>
              <ChevronRight size={14} color={t.textSubtle} />
              <div style={{ background: t.insetBg, border: `1px solid ${t.insetBorder}`, borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, color: t.textMain }}>
                {company}
              </div>
              <ChevronRight size={14} color={t.textSubtle} />
              <div style={{ background: isLight ? '#ecfdf5' : 'rgba(6, 78, 46, 0.3)', border: '1px solid #059669', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 800, color: isLight ? '#065f46' : '#34d399' }}>
                {platoon}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Drill & Standing Overview Strip */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '14px',
            padding: '1.15rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: t.cardShadow
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: isDropped ? 'rgba(239, 68, 68, 0.15)' : isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDropped ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'
              }}
            >
              <Activity size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: t.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                Current Military Standing
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: isDropped ? 'rgba(244, 63, 94, 0.15)' : isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isDropped ? '#e11d48' : isWarning ? '#d97706' : '#059669',
                    border: `1px solid ${isDropped ? 'rgba(244, 63, 94, 0.3)' : isWarning ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 800
                  }}
                >
                  {isDropped ? 'DROPPED FROM ROLLS' : isWarning ? 'WARNING STATUS' : 'GOOD STANDING'}
                </span>
                <span style={{ fontSize: '0.8rem', color: t.textMuted }}>
                  • {metrics.complianceRate}% Attendance ({metrics.attendedSessions} / {metrics.totalFormations} Drills)
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              style={{
                background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${t.cardBorder}`,
                color: t.textMain,
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Shield size={14} color="#e5a900" /> Status & Appeals
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              style={{
                background: '#064e2e',
                border: '1px solid #e5a900',
                color: '#facc15',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Calendar size={14} /> View Attendance Log →
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ============================================================ */}
    {/* TAB 2: STATUS & APPEALS                                      */}
    {/* ============================================================ */}
    {activeTab === 'status' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* 4. ATTENDANCE STANDING & PERFORMANCE STATUS BANNER */}
        <div
          style={{
            background: t.cardBg,
            border: `1.5px solid ${isDropped ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981'}`,
            borderRadius: '14px',
            padding: '1rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: t.cardShadow
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: isDropped
                  ? 'rgba(244, 63, 94, 0.12)'
                  : isWarning
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDropped ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981'
              }}
            >
              <Activity size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Official ROTC Standing & Performance
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: isDropped
                      ? 'rgba(244, 63, 94, 0.15)'
                      : isWarning
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                    color: isDropped ? '#e11d48' : isWarning ? '#d97706' : '#059669',
                    border: `1px solid ${isDropped ? 'rgba(244, 63, 94, 0.3)' : isWarning ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    padding: '2px 10px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 800
                  }}
                >
                  {isDropped ? 'DROPPED FROM ROLLS' : isWarning ? 'WARNING STATUS' : 'GOOD STANDING'}
                </span>
                <span style={{ fontSize: '0.8rem', color: t.textMuted }}>
                  {isDropped
                    ? 'Threshold of allowable absences exceeded.'
                    : isWarning
                    ? 'Approaching allowable unexcused absence limit.'
                    : 'Compliant with military drill attendance regulations.'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                Attendance Rate
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.6rem', fontWeight: 900, color: isDropped ? '#e11d48' : isWarning ? '#d97706' : '#059669', lineHeight: 1.1 }}>
                {metrics.complianceRate}%
              </div>
            </div>
            <div style={{ width: '80px', height: '8px', background: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${metrics.complianceRate}%`,
                  height: '100%',
                  background: isDropped ? '#e11d48' : isWarning ? '#d97706' : '#059669',
                  borderRadius: '999px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>
        </div>

        {/* Detailed Status Banners & Actions */}
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: 0, flex: 1 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span
                      style={{
                        background: '#e11d48',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.7rem',
                        letterSpacing: '0.5px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        textTransform: 'uppercase'
                      }}
                    >
                      DROPPED STATUS
                    </span>
                    <span style={{ fontSize: '0.8rem', color: isLight ? '#be123c' : '#fca5a5', fontWeight: 700 }}>
                      Absence Threshold Reached (ROTC Regulation)
                    </span>
                  </div>

                  <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: isLight ? '#881337' : '#ffffff', margin: '4px 0 6px 0' }}>
                    Cadet Status: Dropped from CSU ROTCU
                  </h2>

                  <p style={{ margin: 0, fontSize: '0.86rem', color: isLight ? '#9f1239' : '#fecdd3', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    You have accumulated <strong>{metrics.absences} unrecorded absences</strong> ({metrics.maxConsecutive} consecutive unrecorded formation days).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAlertDetails(!showAlertDetails)}
                style={{
                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                  border: isLight ? '1px solid #fecdd3' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: isLight ? '#9f1239' : '#f8fafc',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {showAlertDetails ? 'Hide Next Steps' : 'View Next Steps'}
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

        {!isDropped && !isWarning && (
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

        {/* Official CSU ROTC Attendance & Appeals Regulations Card */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: t.cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transition: 'background-color 0.2s ease, border-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={22} color="#e5a900" />
            <div>
              <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.15rem', fontWeight: 800, margin: 0, color: t.textMain }}>
                ROTC Attendance Policies & Reinstatement Appeals
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: t.textMuted }}>
                Official Caraga State University ROTC Unit Regulations & Department of Military Science Policies
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '0.25rem' }}>
            <div style={{ background: t.insetBg, border: `1px solid ${t.insetBorder}`, borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#e5a900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertOctagon size={16} /> 20% Unexcused Absence Rule (RA 7077)
              </div>
              <p style={{ fontSize: '0.78rem', color: t.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
                Under AFP & ROTC regulations, cadets who accumulate unexcused absences exceeding 20% of total formation drill hours or miss 3 consecutive drills are administratively dropped from the roster.
              </p>
            </div>

            <div style={{ background: t.insetBg, border: `1px solid ${t.insetBorder}`, borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Valid Grounds for Excused Absence
              </div>
              <p style={{ fontSize: '0.78rem', color: t.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
                Medical illness with physician certificate, official university academic delegation or varsity competition, or immediate family emergency substantiated with written notice.
              </p>
            </div>

            <div style={{ background: t.insetBg, border: `1px solid ${t.insetBorder}`, borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isLight ? '#0369a1' : '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> Official Appeal Workflow
              </div>
              <p style={{ fontSize: '0.78rem', color: t.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
                1. Secure and complete the Cadet Appeal & Reinstatement Form.
                <br />
                2. Attach required supporting documentation.
                <br />
                3. Secure endorsement from your Platoon Leader and Company Commander.
                <br />
                4. Submit to the ROTC S1 Office within 5 academic days.
              </p>
            </div>

            <div style={{ background: t.insetBg, border: `1px solid ${t.insetBorder}`, borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#e5a900" /> ROTC Headquarters & Contact
              </div>
              <p style={{ fontSize: '0.78rem', color: t.textMuted, margin: '6px 0 0 0', lineHeight: 1.5 }}>
                CSU 1501st CDC ROTC Unit Headquarters, Main Campus, Ampayon, Butuan City.
                <br />
                Email: <strong>rotc@carsu.edu.ph</strong> • Office Hours: Mon-Fri 08:00 AM - 05:00 PM
              </p>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ============================================================ */}
    {/* TAB 3: ATTENDANCE LOG                                        */}
    {/* ============================================================ */}
    {activeTab === 'attendance' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Quick alert notice if dropped or warning */}
        {(isDropped || isWarning) && (
          <div
            style={{
              background: isDropped
                ? (isLight ? '#fff1f2' : 'rgba(225, 29, 72, 0.15)')
                : (isLight ? '#fffbeb' : 'rgba(217, 119, 6, 0.15)'),
              border: `1.5px solid ${isDropped ? '#f43f5e' : '#f59e0b'}`,
              borderRadius: '12px',
              padding: '0.75rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isDropped ? <AlertOctagon size={18} color="#e11d48" /> : <AlertTriangle size={18} color="#d97706" />}
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isDropped ? '#e11d48' : '#d97706' }}>
                {isDropped ? 'Attendance Warning: Cadet is marked as Dropped from Rolls.' : 'Attendance Alert: Approaching absence threshold.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              style={{
                background: isDropped ? '#e11d48' : '#d97706',
                border: 'none',
                color: '#ffffff',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              View Status & Appeals →
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. INTERACTIVE SUMMARY CARDS (MATCHING ADMIN UI)             */}
        {/* ============================================================ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Card 1: Total Formations */}
          <div
            style={{
              background: statusFilter === 'ALL'
                ? (isLight ? '#f0fdf4' : 'rgba(6, 78, 46, 0.25)')
                : t.cardBg,
              border: `1px solid ${statusFilter === 'ALL' ? '#064e2e' : t.cardBorder}`,
              borderLeft: `5px solid ${statusFilter === 'ALL' ? '#064e2e' : (isLight ? '#cbd5e1' : '#334155')}`,
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              outline: statusFilter === 'ALL' ? '2px solid #064e2e' : 'none',
              boxShadow: t.cardShadow,
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleStatusCardClick('ALL')}
            title="Click to show all formation drill sessions"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(6, 78, 46, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isLight ? '#064e2e' : '#34d399'
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Formations
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: t.textMain }}>
                  {counts.all} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted }}>
              {statusFilter === 'ALL' ? '✓ Showing all drill dates' : 'Click to filter → All Formations'}
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
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              outline: statusFilter === 'PRESENT' ? '2px solid #059669' : 'none',
              boxShadow: t.cardShadow,
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleStatusCardClick('PRESENT')}
            title="Click to filter table: Present (On-Time) sessions only"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(5, 150, 105, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669'
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>
                  Present
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isLight ? '#065f46' : '#34d399' }}>
                  {counts.present} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted }}>
              {statusFilter === 'PRESENT' ? '✓ Filtering table by Present' : 'Click to filter → Present'}
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
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              outline: statusFilter === 'LATE' ? '2px solid #d97706' : 'none',
              boxShadow: t.cardShadow,
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleStatusCardClick('LATE')}
            title="Click to filter table: Late / Tardy sessions only"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(217, 119, 6, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706'
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>
                  Late
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isLight ? '#92400e' : '#fbbf24' }}>
                  {counts.late} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted }}>
              {statusFilter === 'LATE' ? '✓ Filtering table by Late' : 'Click to filter → Late'}
            </div>
          </div>

          {/* Card 4: NO TIME IN/OUT */}
          <div
            style={{
              background: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT')
                ? (isLight ? '#fff7ed' : 'rgba(234, 88, 12, 0.2)')
                : t.cardBg,
              border: `1px solid ${(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '#ea580c' : t.cardBorder}`,
              borderLeft: `5px solid ${(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '#ea580c' : (isLight ? '#fed7aa' : '#7c2d12')}`,
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              outline: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '2px solid #ea580c' : 'none',
              boxShadow: t.cardShadow,
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleStatusCardClick('NO TIME-OUT')}
            title="Click to filter table: Incomplete time-in/out records"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(234, 88, 12, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c'
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>
                  No Time In/Out
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isLight ? '#9a3412' : '#fb923c' }}>
                  {counts.noTimeOut} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Sessions</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted }}>
              {(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '✓ Filtering table by No Time In/Out' : 'Click to filter → No Time In/Out'}
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
              padding: '1.1rem 1.25rem',
              cursor: 'pointer',
              outline: statusFilter === 'ABSENT' ? '2px solid #dc2626' : 'none',
              boxShadow: t.cardShadow,
              transition: 'all 0.15s ease'
            }}
            onClick={() => handleStatusCardClick('ABSENT')}
            title="Click to filter table: Absent / Missed sessions only"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(220, 38, 38, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626'
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>
                  Absent Cadets
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isLight ? '#b91c1c' : '#f87171' }}>
                  {counts.absent} <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 600 }}>Absences</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted }}>
              {statusFilter === 'ABSENT' ? '✓ Filtering table by Absent' : 'Click to filter → Absent'}
            </div>
          </div>
        </div>

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                    color: isLight ? '#065f46' : '#34d399'
                  }}
                >
                  <span>Active Filter: <strong>{statusFilter}</strong> ({displaySchedule.length})</span>
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

              {/* Date Filter Input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: '8px',
                  padding: '0.35rem 0.65rem',
                  gap: '6px'
                }}
              >
                <Search size={13} color={t.textMuted} />
                <input
                  type="text"
                  placeholder="Filter by date..."
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.76rem',
                    color: t.textMain,
                    width: '120px'
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
                      alignItems: 'center'
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

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
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Friendly Data Table (Scrollable Container with Sticky Header) */}
          <div
            className="max-h-[420px] overflow-y-auto"
            style={{
              maxHeight: '420px',
              overflowY: 'auto',
              overflowX: 'auto',
              position: 'relative'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: t.tableHeadBg,
                  boxShadow: isLight ? '0 1px 3px rgba(0, 0, 0, 0.08)' : '0 2px 6px rgba(0, 0, 0, 0.35)'
                }}
              >
                <tr style={{ background: t.tableHeadBg, borderBottom: `1px solid ${t.tableRowBorder}` }}>
                  <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg }}>Drill Date</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg }}>Time-In</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg }}>Time-Out</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg }}>Attendance Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', color: t.textMuted, fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: t.tableHeadBg }}>Remarks / Rule Impact</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3.5rem', textAlign: 'center', color: t.textMuted }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#e5a900' }} />
                      <div>Loading attendance evaluation records...</div>
                    </td>
                  </tr>
                ) : displaySchedule.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: t.textMuted }}>
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
                  displaySchedule.map((entry, idx) => {
                    const rawDate = entry.date || 'N/A';
                    const friendlyDate = formatFriendlyDate(rawDate);
                    const activeCutoffTime = settings?.formation_cutoff_time || settings?.formationCutoffTime || settings?.morningCutoffTime || '07:30';
                    const sessionCutoff = sessionCutoffsByDate.get(rawDate) || entry.cutoffTime || entry.cutoff_time || activeCutoffTime;
                    const formattedCutoff = formatCutoffDisplay(sessionCutoff);

                    const isValidTime = (val) => {
                      if (!val) return false;
                      const s = String(val).trim().toUpperCase();
                      return s !== '' && s !== '—' && s !== 'NO TIME-OUT' && s !== 'NO TIME-IN' && s !== 'NULL' && s !== 'UNDEFINED';
                    };

                    const hasTimeIn = isValidTime(entry.timeIn);
                    const hasTimeOut = isValidTime(entry.timeOut);
                    const timeInStr = hasTimeIn ? formatDisplayTime(entry.timeIn) : null;
                    const timeOutStr = hasTimeOut ? formatDisplayTime(entry.timeOut) : null;
                    const isRecorded = entry.isRecorded;
                    const rawStatus = String(entry.status || '').toUpperCase();
                    const isLate = rawStatus.includes('LATE') || entry.dayType === 'LATE' || Boolean(entry.isLate);

                    // Reconcile status badges cleanly
                    let badgeLabel = 'Absent';
                    let badgeBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.12)';
                    let badgeBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.35)';
                    let badgeColor = isLight ? '#b91c1c' : '#f87171';
                    let badgeIcon = <XCircle size={13} />;
                    let remarkText = entry.penaltyLabel || 'Unrecorded Formation Day';

                    if (!isRecorded || rawStatus.includes('UNRECORDED') || rawStatus === 'ABSENT') {
                      badgeLabel = 'Absent';
                      badgeBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.12)';
                      badgeBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.35)';
                      badgeColor = isLight ? '#b91c1c' : '#f87171';
                      badgeIcon = <XCircle size={13} />;
                      remarkText = entry.penaltyLabel || 'Unrecorded Formation Day';
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
                      remarkText = 'Missing Time-Out Scan (+1/4 session penalty)';
                    } else if (isLate) {
                      badgeLabel = 'Late (Tardy)';
                      badgeBg = isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.15)';
                      badgeBorder = isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.4)';
                      badgeColor = '#d97706';
                      badgeIcon = <Clock size={13} color="#d97706" />;
                      remarkText = 'Late scan (+0.25 interval penalty)';
                    } else if (rawStatus.includes('EXCUSED')) {
                      badgeLabel = 'Excused';
                      badgeBg = isLight ? '#f3e8ff' : 'rgba(167, 139, 250, 0.15)';
                      badgeBorder = isLight ? '#e9d5ff' : 'rgba(167, 139, 250, 0.4)';
                      badgeColor = isLight ? '#7e22ce' : '#a78bfa';
                      badgeIcon = <Shield size={13} />;
                      remarkText = 'Official Excused Absence (No penalty)';
                    } else {
                      badgeLabel = 'Present';
                      badgeBg = isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.15)';
                      badgeBorder = isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.4)';
                      badgeColor = isLight ? '#15803d' : '#34d399';
                      badgeIcon = <CheckCircle2 size={13} />;
                      remarkText = 'Verified Formation Attendance (Compliant)';
                    }

                    return (
                      <tr
                        key={`${rawDate}_${idx}`}
                        style={{
                          borderBottom: `1px solid ${t.tableRowBorder}`,
                          background: idx % 2 === 0 ? 'transparent' : t.tableAltRow,
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Friendly Date & Cut-off Time */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: t.textMain, fontSize: '0.86rem' }}>
                            {friendlyDate}
                          </div>
                          <div style={{ marginTop: '4px' }}>
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
                                gap: '4px'
                              }}
                            >
                              <Clock size={10} color={isLight ? '#92400e' : '#d97706'} />
                              <span>Cut-off: {formattedCutoff}</span>
                            </span>
                          </div>
                        </td>

                        {/* Time In */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {timeInStr ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: isLate
                                  ? (isLight ? '#fef3c7' : 'rgba(217, 119, 6, 0.15)')
                                  : (isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.1)'),
                                border: `1px solid ${isLate
                                  ? (isLight ? '#fde68a' : 'rgba(217, 119, 6, 0.35)')
                                  : (isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.25)')
                                  }`,
                                padding: '2px 8px',
                                borderRadius: '6px'
                              }}
                            >
                              <Clock size={12} color={isLate ? '#d97706' : (isLight ? '#15803d' : '#34d399')} />
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  color: isLate ? '#d97706' : (isLight ? '#15803d' : '#34d399')
                                }}
                              >
                                {timeInStr}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: t.textSubtle, fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>

                        {/* Time Out */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {timeOutStr ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.1)', border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: '6px' }}>
                              <Clock size={12} color={isLight ? '#15803d' : '#34d399'} />
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: isLight ? '#15803d' : '#34d399' }}>{timeOutStr}</span>
                            </div>
                          ) : hasTimeIn ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: isLight ? '#ffedd5' : 'rgba(249, 115, 22, 0.12)', border: isLight ? '1px solid #fed7aa' : '1px solid rgba(249, 115, 22, 0.3)', color: isLight ? '#c2410c' : '#fb923c', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                              No Time-Out
                            </span>
                          ) : (
                            <span style={{ color: t.textSubtle, fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
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
                              fontWeight: 800
                            }}
                          >
                            {badgeIcon}
                            <span>{badgeLabel}</span>
                          </span>
                        </td>

                        {/* Remarks */}
                        <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: isRecorded ? t.textMain : isLight ? '#b91c1c' : '#fca5a5' }}>
                          {remarkText}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 6. FRIENDLY CADET GUIDELINES & POLICIES FOOTER SECTION       */}
        {/* ============================================================ */}
        <div
          style={{
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            boxShadow: t.cardShadow,
            transition: 'background-color 0.2s ease, border-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <Clock size={20} color="#e5a900" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain }}>Drill Formation Hours</div>
              <div style={{ fontSize: '0.76rem', color: t.textMuted, marginTop: '2px', lineHeight: 1.45 }}>
                Time-In starts at 06:00 AM. Scans past 07:00 AM are tagged as Tardy/Late. Dismissal time-out starts at 12:00 PM.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <FileText size={20} color="#e5a900" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain }}>Official Excuse Justifications</div>
              <div style={{ fontSize: '0.76rem', color: t.textMuted, marginTop: '2px', lineHeight: 1.45 }}>
                Submit medical certificates or university official duty excuse letters to your Platoon Leader or S1 within 5 school days.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <MapPin size={20} color="#e5a900" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: t.textMain }}>Unit Command Office</div>
              <div style={{ fontSize: '0.76rem', color: t.textMuted, marginTop: '2px', lineHeight: 1.45 }}>
                Caraga State University 1501st CDC ROTC Unit Headquarters, Main Campus, Ampayon, Butuan City.
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      </main>
      </div>

      {/* Digital ID Card Modal */}
      {showIdModal && (
        <div
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
            style={{
              background: isLight ? '#ffffff' : '#0f172a',
              border: '1.5px solid #e5a900',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: '#e5a900' }}>
                OFFICIAL DIGITAL ROTC ID
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

            <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: '0.5rem 0' }}>
              <IDCardPreview card={cardPayload} />
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: isLight ? '#64748b' : '#94a3b8', marginTop: '1rem' }}>
              Present this digital badge or QR code during formation scanning.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
