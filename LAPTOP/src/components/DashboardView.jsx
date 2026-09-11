import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Activity,
  Shield,
  Filter,
  XCircle,
  Search,
  X,
  Archive,
  UserX,
  FileText,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import DashboardUnitHierarchy from './DashboardUnitHierarchy';
import {
  reconcileRosterAttendance,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon,
  formatDisplayTime
} from '../utils/attendanceStatus';
import { getDutyOfficerForCadet } from './AttendanceHistory';
import { useAttendanceData } from '../hooks/useAttendanceData';
import { useUnitStructure } from '../context/UnitContext';
import {
  subscribeToAttendanceRealtime,
  fetchCadetCountFromSupabase,
  fetchSettingsFromSupabase,
  fetchAttendanceSessionsFromSupabase,
  approveExcuseRequest,
  rejectExcuseRequest,
  autoExpireExcusePending
} from '../utils/supabaseClient';

function formatDisplayTimeFallback(timestamp) {
  if (!timestamp) return null;
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  } catch (_) {}
  return String(timestamp);
}

function toDateKey(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  let d = new Date(str);
  if (isNaN(d.getTime()) && typeof dateInput === 'string') {
    d = new Date(`${dateInput} ${new Date().getFullYear()}`);
  }
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_UNIT_STRUCTURE = [
  {
    id: 'bn-1',
    name: '1st Battalion',
    shortCode: '1BN',
    targetQuota: 148,
    companies: [
      {
        id: 'co-1-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        targetQuota: 74,
        platoons: [
          { id: 'pl-1-a-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-a-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        targetQuota: 74,
        platoons: [
          { id: 'pl-1-b-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-b-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      }
    ]
  },
  {
    id: 'bn-2',
    name: '2nd Battalion',
    shortCode: '2BN',
    targetQuota: 148,
    companies: [
      {
        id: 'co-2-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        targetQuota: 74,
        platoons: [
          { id: 'pl-2-c-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-c-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        targetQuota: 74,
        platoons: [
          { id: 'pl-2-d-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-d-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      }
    ]
  }
];

export default function DashboardView({
  cadets: propsCadets = [],
  attendanceLogs: propsLogs = [],
  onRefresh,
  onNavigateToHistory
}) {
  const { records: hookLogs = [], settings: hookSettings, activeCutoff, refreshFromStorage } = useAttendanceData();
  const rawMasterLogs = hookLogs && hookLogs.length > 0 ? hookLogs : propsLogs;

  const todayKey = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const formatHumanDate = (dateKey) => {
    if (!dateKey) return 'Today';
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return dateKey;
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Realtime subscription for instant dashboard updates
  useEffect(() => {
    const channel = subscribeToAttendanceRealtime(() => {
      if (refreshFromStorage) refreshFromStorage();
      if (onRefresh) onRefresh();
    });

    const handleLocalUpdate = () => {
      if (refreshFromStorage) refreshFromStorage();
    };

    window.addEventListener('local-attendance-update', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      if (channel) channel.unsubscribe();
      window.removeEventListener('local-attendance-update', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, [refreshFromStorage, onRefresh]);

  // Resilient Date Filter: Command dashboard strictly observes today's session_date
  const attendanceLogs = useMemo(() => {
    if (!Array.isArray(rawMasterLogs)) return [];
    return rawMasterLogs.filter(log => {
      const rawDate = log.date || log.session_date || log.sessionDate || log.scanned_at || log.scannedAt || log.timestamp || log.time_in || log.timeIn || log.received_at || log.receivedAt || log.created_at;
      if (!rawDate) return false;
      const key = toDateKey(rawDate);
      if (key === todayKey) return true;
      // Also match UTC date prefix in case of ISO string
      if (typeof rawDate === 'string' && rawDate.length >= 10 && rawDate.slice(0, 10) === todayKey) return true;
      return false;
    });
  }, [rawMasterLogs, todayKey]);

  const hasTodayScans = attendanceLogs.length > 0;
  const formationCutoff = activeCutoff || hookSettings?.formation_cutoff_time || hookSettings?.morningCutoffTime || hookSettings?.formationCutoffTime || getActiveFormationCutoff() || '07:30';
  
  const [cloudStructure, setCloudStructure] = useState(null);
  const [dbSessions, setDbSessions] = useState([]);

  // Sync latest unit structure and sessions from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    async function syncCloudSettings() {
      try {
        const sb = await fetchSettingsFromSupabase();
        if (sb && isMounted) {
          const struct = sb.unit_structure || sb.unitStructure;
          if (Array.isArray(struct) && struct.length > 0) {
            setCloudStructure(struct);
          }
        }
        const sessions = await fetchAttendanceSessionsFromSupabase();
        if (sessions && isMounted) {
          setDbSessions(sessions);
        }
      } catch (_) {}
    }
    syncCloudSettings();
    return () => { isMounted = false; };
  }, [hasTodayScans]);

  const { unitStructure: contextUnitStructure } = useUnitStructure();

  const unitStructure = (contextUnitStructure && Array.isArray(contextUnitStructure) && contextUnitStructure.length > 0)
    ? contextUnitStructure
    : (cloudStructure && Array.isArray(cloudStructure) && cloudStructure.length > 0
        ? cloudStructure
        : DEFAULT_UNIT_STRUCTURE);

  // Cascading Selection State for drill-downs
  const [selectedBattalion, setSelectedBattalion] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPlatoon, setSelectedPlatoon] = useState(null);

  // Search input state for filtering by Cadet ID or Name
  const [searchQuery, setSearchQuery] = useState('');

  // Status filter applied by clicking stat summary cards ('PRESENT' | 'LATE' | 'NO TIME IN/OUT' | 'ABSENT' | null)
  const [statusFilter, setStatusFilter] = useState(null);

  const handleStatusCardClick = (status) => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  // 1. Dynamic Hierarchical Structure & Auto-Expanding Total Strength
  const dynamicHierarchy = useMemo(() => {
    const allCadetsMap = new Map();
    (propsCadets || []).forEach(c => {
      const cid = String(c.id || c.cadetId || c.cadet_id || '').trim().toUpperCase();
      if (cid) allCadetsMap.set(cid, {
        ...c,
        id: cid,
        cadetId: cid
      });
    });
    (rawMasterLogs || []).forEach(l => {
      const cid = String(l.cadetId || l.cadet_id || l.id || l.i || '').trim().toUpperCase();
      if (cid && !allCadetsMap.has(cid)) {
        allCadetsMap.set(cid, {
          id: cid,
          cadetId: cid,
          name: l.name || `Cadet ${cid}`,
          rank: l.rank || 'Cadet',
          battalion: l.battalion || '1st Battalion',
          company: l.company || 'Alpha Company',
          platoon: l.platoon || '1st Platoon'
        });
      }
    });

    const allCadetsList = Array.from(allCadetsMap.values());

    const battalions = unitStructure.map((bn, bnIdx) => {
      const bnNorm = normalizeBattalion(bn.name);
      const bnCadets = allCadetsList.filter(c => {
        const cBnNorm = normalizeBattalion(c.battalion);
        return bnNorm && cBnNorm ? (bnNorm === cBnNorm) : false;
      });

      const companies = (bn.companies || []).map((co) => {
        const coNorm = normalizeCompany(co.name);
        const coCadets = bnCadets.filter(c => {
          const cCoNorm = normalizeCompany(c.company);
          return coNorm && cCoNorm ? (coNorm === cCoNorm) : false;
        });

        const platoons = (co.platoons || []).map((pl) => {
          const plNorm = normalizePlatoon(pl.name);
          const plCadets = coCadets.filter(c => {
            const cPlNorm = normalizePlatoon(c.platoon);
            return plNorm && cPlNorm ? (plNorm === cPlNorm) : false;
          });

          const dynamicPlatoonStrength = plCadets.length;

          return {
            ...pl,
            registeredCount: plCadets.length,
            targetQuota: dynamicPlatoonStrength
          };
        });

        const dynamicCompanyStrength = platoons.reduce((acc, p) => acc + p.targetQuota, 0);

        return {
          ...co,
          platoons,
          registeredCount: coCadets.length,
          targetQuota: dynamicCompanyStrength
        };
      });

      const dynamicBattalionStrength = companies.reduce((acc, c) => acc + c.targetQuota, 0);

      return {
        ...bn,
        companies,
        registeredCount: bnCadets.length,
        targetQuota: dynamicBattalionStrength
      };
    });

    const totalUnitStrength = allCadetsList.length;

    return {
      allCadetsList,
      battalions,
      totalUnitStrength
    };
  }, [propsCadets, rawMasterLogs, unitStructure]);

  const [supabaseCadetCount, setSupabaseCadetCount] = useState(null);

  // Fetch real-time Total Cadets from Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchUnitStrength = async () => {
      try {
        const count = await fetchCadetCountFromSupabase();
        if (isMounted && typeof count === 'number' && count >= 0) {
          setSupabaseCadetCount(count);
        }
      } catch (err) {
        console.error('Error fetching cadet count:', err);
      }
    };

    fetchUnitStrength();

    return () => {
      isMounted = false;
    };
  }, [propsCadets, rawMasterLogs]);

  const totalStrength = typeof supabaseCadetCount === 'number' && supabaseCadetCount > 0
    ? supabaseCadetCount
    : dynamicHierarchy.totalUnitStrength;

  // 2. Dynamic Counts calculated directly from today's attendanceLogs
  const { reconciledRoster: rawReconciledRoster, summary: rawSummary } = useMemo(() => {
    return reconcileRosterAttendance(
      dynamicHierarchy.allCadetsList,
      attendanceLogs,
      null,
      formationCutoff
    );
  }, [dynamicHierarchy.allCadetsList, attendanceLogs, formationCutoff]);

  const reconciledRoster = useMemo(() => {
    if (!hasTodayScans) {
      return dynamicHierarchy.allCadetsList.map(cadet => ({
        ...cadet,
        cadetId: cadet.id || cadet.cadetId,
        hasTimeIn: false,
        hasTimeOut: false,
        timeInDisplay: null,
        timeOutDisplay: null,
        timeInStatus: null,
        timeOutStatus: null,
        status: 'NO SCAN TODAY',
        finalDailyStatus: 'NO SCAN TODAY'
      }));
    }
    return rawReconciledRoster;
  }, [hasTodayScans, rawReconciledRoster, dynamicHierarchy.allCadetsList]);

  const attendanceSummary = useMemo(() => {
    if (!hasTodayScans) {
      return {
        totalStrength: dynamicHierarchy.totalUnitStrength,
        presentCompleteCount: 0,
        lateCompleteCount: 0,
        incompleteCount: 0,
        absentCount: 0,
        excusePendingCount: 0,
        totalScanned: 0,
        presentOrLateCount: 0
      };
    }

    let presentCount = 0;
    let lateCount = 0;
    let incompleteCount = 0;
    let absentCount = 0;
    let excusePendingCount = 0;
    let excusedCount = 0;

    reconciledRoster.forEach(cadet => {
      const status = (cadet.finalDailyStatus || cadet.status || 'ABSENT').toUpperCase();
      if (status === 'EXCUSE_PENDING') { excusePendingCount++; return; }
      if (status === 'EXCUSED') { excusedCount++; return; }
      const isLate = Boolean(cadet.isLate || status.includes('LATE'));
      const isIncomplete = (
        status.includes('NO TIME-OUT') ||
        status.includes('NO TIME-IN') ||
        status.includes('INCOMPLETE') ||
        (cadet.hasTimeIn && !cadet.hasTimeOut) ||
        (!cadet.hasTimeIn && cadet.hasTimeOut)
      );

      if (isLate) {
        lateCount++;
      } else if (status.includes('PRESENT') || (cadet.hasTimeIn && cadet.hasTimeOut && !isLate)) {
        presentCount++;
      }

      if (isIncomplete) {
        incompleteCount++;
      } else if (!cadet.hasTimeIn && !cadet.hasTimeOut && (status.includes('ABSENT') || status.includes('NO SCAN'))) {
        absentCount++;
      }
    });

    return {
      totalStrength: reconciledRoster.length,
      presentCompleteCount: presentCount,
      lateCompleteCount: lateCount,
      incompleteCount,
      absentCount,
      excusePendingCount,
      excusedCount,
      totalScanned: presentCount + lateCount + incompleteCount,
      presentOrLateCount: presentCount + lateCount
    };
  }, [hasTodayScans, reconciledRoster, dynamicHierarchy.totalUnitStrength]);

  // Auto-expire EXCUSE_PENDING rows past grace period on admin load
  useEffect(() => {
    let isMounted = true;
    const runExpiry = async () => {
      try {
        const saved = localStorage.getItem('csu_rotc_admin_settings');
        const graceDays = saved ? (JSON.parse(saved).excuseGracePeriodDays ?? 3) : 3;
        await autoExpireExcusePending(graceDays);
        if (isMounted && refreshFromStorage) refreshFromStorage();
      } catch (_) {}
    };
    runExpiry();
    return () => { isMounted = false; };
  }, []);

  // Excuse action handlers
  const [excuseActionLoading, setExcuseActionLoading] = useState(null);
  const handleApproveExcuse = useCallback(async (logId) => {
    if (!logId) return;
    setExcuseActionLoading(logId);
    await approveExcuseRequest(logId);
    if (refreshFromStorage) refreshFromStorage();
    if (onRefresh) onRefresh();
    setExcuseActionLoading(null);
  }, [refreshFromStorage, onRefresh]);

  const handleRejectExcuse = useCallback(async (logId) => {
    if (!logId) return;
    setExcuseActionLoading(logId);
    await rejectExcuseRequest(logId);
    if (refreshFromStorage) refreshFromStorage();
    if (onRefresh) onRefresh();
    setExcuseActionLoading(null);
  }, [refreshFromStorage, onRefresh]);

  const handleClearAllFilters = () => {
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
    setSearchQuery('');
    setStatusFilter(null);
  };

  const isAnyFilterActive =
    selectedBattalion !== null ||
    selectedCompany !== null ||
    selectedPlatoon !== null ||
    searchQuery.trim().length > 0 ||
    statusFilter !== null;

  // Interactive Filtered Master Roster Records
  const tableFilteredCadets = reconciledRoster.filter(cadet => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const id = String(cadet.cadetId || '').toLowerCase();
      const name = String(cadet.name || '').toLowerCase();
      if (!id.includes(q) && !name.includes(q)) {
        return false;
      }
    }

    let matchesBn = true;
    if (selectedBattalion) {
      const selectedBnNorm = normalizeBattalion(selectedBattalion);
      const cadetBnNorm = normalizeBattalion(cadet.battalion);
      matchesBn = selectedBnNorm && cadetBnNorm ? (selectedBnNorm === cadetBnNorm) : (cadet.battalion || '').toLowerCase().includes(selectedBattalion.toLowerCase());
    }

    let matchesCo = true;
    if (selectedCompany) {
      const selectedCoNorm = normalizeCompany(selectedCompany);
      const cadetCoNorm = normalizeCompany(cadet.company);
      matchesCo = selectedCoNorm && cadetCoNorm ? (selectedCoNorm === cadetCoNorm) : (cadet.company || '').toLowerCase().includes(selectedCompany.toLowerCase());
    }

    let matchesPl = true;
    if (selectedPlatoon) {
      const selectedPlNorm = normalizePlatoon(selectedPlatoon);
      const cadetPlNorm = normalizePlatoon(cadet.platoon);
      matchesPl = selectedPlNorm && cadetPlNorm ? (selectedPlNorm === cadetPlNorm) : false;
    }

    if (statusFilter) {
      const cadetStatus = (cadet.finalDailyStatus || cadet.status || 'ABSENT').toUpperCase();
      const filterNorm = statusFilter.toUpperCase();

      if (filterNorm === 'LATE') {
        if (!cadetStatus.includes('LATE') && !cadet.isLate) return false;
      } else if (filterNorm === 'NO TIME IN/OUT' || filterNorm === 'NO TIME-OUT' || filterNorm === 'INCOMPLETE') {
        if (
          !cadetStatus.includes('NO TIME-OUT') &&
          !cadetStatus.includes('NO TIME-IN') &&
          !cadetStatus.includes('INCOMPLETE') &&
          !((cadet.hasTimeIn && !cadet.hasTimeOut) || (!cadet.hasTimeIn && cadet.hasTimeOut))
        ) return false;
      } else if (filterNorm === 'PRESENT') {
        if (!cadetStatus.includes('PRESENT') && !cadet.timeIn && !cadet.hasTimeIn) return false;
      } else if (filterNorm === 'ABSENT') {
        if (cadetStatus === 'EXCUSE_PENDING' || cadetStatus === 'EXCUSED') return false;
        if (!cadetStatus.includes('ABSENT')) return false;
      } else if (filterNorm === 'EXCUSE' || filterNorm === 'EXCUSE_PENDING' || filterNorm === 'EXCUSED' || filterNorm === 'EXCUSE REQUEST' || filterNorm === 'EXCUSE REQUESTS') {
        if (cadetStatus !== 'EXCUSE_PENDING' && cadetStatus !== 'EXCUSED') return false;
      } else {
        if (!cadetStatus.includes(filterNorm)) return false;
      }
    }

    return matchesBn && matchesCo && matchesPl;
  });

  const getSelectedCompanyDisplay = () => {
    if (!selectedCompany) return '';
    if (selectedCompany.toUpperCase().includes('COY') || selectedCompany.toUpperCase().includes('COMPANY')) {
      return selectedCompany;
    }
    return `${selectedCompany} Company`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', margin: 0, letterSpacing: '0.5px' }}>
            COMMAND DASHBOARD
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Live formation attendance and master unit records for {formatHumanDate(todayKey)}.
          </div>
        </div>
      </div>

      {/* Top Metric Cards: Unit Strength, Present, Late, No Time In/Out, No Scan Today, Excuse (6 Cards in 1 Row) */}
      <div
        className="dashboard-metrics-grid grid-cols-6"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: '0.65rem',
          width: '100%'
        }}
      >
        {/* Card 1: Total Unit Strength */}
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--rotc-green-dark)',
            cursor: 'default',
            padding: '0.85rem 0.75rem',
            marginBottom: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rotc-green-dark)', flexShrink: 0 }}>
              <Users size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Total Unit Strength</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {totalStrength} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalStrength}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Target Quota
          </div>
        </div>

        {/* Card 2: PRESENT */}
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${statusFilter === 'PRESENT' ? '#059669' : '#d1fae5'}`,
            cursor: 'pointer',
            outline: statusFilter === 'PRESENT' ? '2px solid #059669' : 'none',
            background: statusFilter === 'PRESENT' ? '#f0fdf4' : undefined,
            padding: '0.85rem 0.75rem',
            marginBottom: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onClick={() => handleStatusCardClick('PRESENT')}
          title="Click to filter table: PRESENT cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Present</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065f46', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {attendanceSummary.presentCompleteCount} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {statusFilter === 'PRESENT' ? '✓ Filtering Present' : 'Click to filter'}
          </div>
        </div>

        {/* Card 3: LATE */}
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${statusFilter === 'LATE' ? '#d97706' : '#fde68a'}`,
            cursor: 'pointer',
            outline: statusFilter === 'LATE' ? '2px solid #d97706' : 'none',
            background: statusFilter === 'LATE' ? '#fffbeb' : undefined,
            padding: '0.85rem 0.75rem',
            marginBottom: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onClick={() => handleStatusCardClick('LATE')}
          title="Click to filter table: LATE cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
              <Clock size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Late</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400e', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {attendanceSummary.lateCompleteCount} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {statusFilter === 'LATE' ? '✓ Filtering Late' : 'Click to filter'}
          </div>
        </div>

        {/* Card 4: NO TIME IN/OUT */}
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '#ea580c' : '#fed7aa'}`,
            cursor: 'pointer',
            outline: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '2px solid #ea580c' : 'none',
            background: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '#fff7ed' : undefined,
            padding: '0.85rem 0.75rem',
            marginBottom: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onClick={() => handleStatusCardClick('NO TIME IN/OUT')}
          title="Click to filter table: No Time In/Out cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(234, 88, 12, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', flexShrink: 0 }}>
              <Activity size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>No Time In/Out</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#9a3412', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {attendanceSummary.incompleteCount} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '✓ Filtering Incomplete' : 'Click to filter'}
          </div>
        </div>

        {/* Card 5: ABSENT / NO SCAN TODAY */}
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${statusFilter === 'ABSENT' ? '#64748b' : '#e2e8f0'}`,
            cursor: hasTodayScans ? 'pointer' : 'default',
            outline: statusFilter === 'ABSENT' ? '2px solid #64748b' : 'none',
            background: statusFilter === 'ABSENT' ? '#f1f5f9' : undefined,
            padding: '0.85rem 0.75rem',
            marginBottom: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onClick={() => hasTodayScans && handleStatusCardClick('ABSENT')}
          title={hasTodayScans ? "Click to filter table: Absent cadets only" : "No formation recorded for today"}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
              <Shield size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hasTodayScans ? 'Absent' : 'No Scan Today'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#334155', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hasTodayScans ? attendanceSummary.absentCount : 0} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hasTodayScans ? (statusFilter === 'ABSENT' ? '✓ Filtering Absent' : 'Click to filter') : 'No active drill'}
          </div>
        </div>

        {/* Card 6: EXCUSE (EXCUSE_PENDING or EXCUSED) */}
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${(statusFilter === 'EXCUSE' || statusFilter === 'EXCUSE_PENDING' || statusFilter === 'EXCUSED') ? '#d97706' : '#fde68a'}`,
            cursor: 'pointer',
            outline: (statusFilter === 'EXCUSE' || statusFilter === 'EXCUSE_PENDING' || statusFilter === 'EXCUSED') ? '2px solid #d97706' : 'none',
            background: (statusFilter === 'EXCUSE' || statusFilter === 'EXCUSE_PENDING' || statusFilter === 'EXCUSED') ? '#fffbeb' : undefined,
            padding: '0.85rem 0.75rem',
            marginBottom: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onClick={() => handleStatusCardClick('EXCUSE')}
          title="Click to filter: cadets with excuse records (Excused or Pending)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
              <FileText size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Excuse</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400e', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(attendanceSummary.excusePendingCount ?? 0) + (attendanceSummary.excusedCount ?? 0)} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(statusFilter === 'EXCUSE' || statusFilter === 'EXCUSE_PENDING' || statusFilter === 'EXCUSED') ? '✓ Filtering Excuse' : 'Click to filter'}
          </div>
        </div>
      </div>


      {/* Unit Hierarchy Drill-Down: Battalion, Company, and Platoon Selectors */}
      <DashboardUnitHierarchy
        selectedBattalion={selectedBattalion}
        setSelectedBattalion={setSelectedBattalion}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        selectedPlatoon={selectedPlatoon}
        setSelectedPlatoon={setSelectedPlatoon}
        unitStructure={unitStructure}
      />

      {/* Master Attendance Records Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="var(--rotc-green-dark)" />
              <span>Master Attendance Records ({tableFilteredCadets.length} Cadets)</span>
            </div>
            {isAnyFilterActive ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Filter size={13} color="var(--rotc-green-dark)" />
                <span style={{ color: 'var(--text-muted)' }}>Active filters:</span>
                {selectedBattalion && (
                  <span
                    style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', padding: '3px 9px', borderRadius: '5px', fontWeight: 700, fontSize: '0.76rem' }}
                  >
                    {selectedBattalion}
                  </span>
                )}
                {selectedCompany && (
                  <span
                    style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', padding: '3px 9px', borderRadius: '5px', fontWeight: 700, fontSize: '0.76rem' }}
                  >
                    {getSelectedCompanyDisplay()}
                  </span>
                )}
                {selectedPlatoon && (
                  <span
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '3px 9px', borderRadius: '5px', fontWeight: 700, fontSize: '0.76rem' }}
                  >
                    {selectedPlatoon}
                  </span>
                )}
                {statusFilter && (
                  <span
                    style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', padding: '3px 9px', borderRadius: '5px', fontWeight: 700, fontSize: '0.76rem' }}
                  >
                    Status: {statusFilter}
                  </span>
                )}
                {searchQuery.trim() && (
                  <span
                    style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', padding: '3px 9px', borderRadius: '5px', fontWeight: 700, fontSize: '0.76rem' }}
                  >
                    Search: "{searchQuery.trim()}"
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Showing full Brigade Master Roster ({totalStrength} Cadets). Scanned cadets update to Present/Late in real-time.
              </div>
            )}
          </div>

          {/* Search Input Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', flex: '1 1 340px', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '100%', minWidth: '320px', maxWidth: '460px' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--rotc-green-dark, #064e2e)',
                  pointerEvents: 'none',
                  opacity: 0.85
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Cadet ID or Name..."
                style={{
                  width: '100%',
                  padding: '0.62rem 2.4rem 0.62rem 2.6rem',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: '2px solid #cbd5e1',
                  background: '#ffffff',
                  color: 'var(--text-dark, #0f172a)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--rotc-green-dark, #064e2e)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(6, 78, 46, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748b)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px'
                  }}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {!hasTodayScans ? (
          <div
            style={{
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1',
              boxShadow: 'var(--shadow-sm)',
              margin: '0.5rem 0'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}
            >
              <Activity size={32} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '1.25rem', fontWeight: 800 }}>
              No Active Formation or Scans Recorded for Today
            </h3>

            <p style={{ margin: '0 auto 1.5rem', maxWidth: '520px', color: '#64748b', fontSize: '0.88rem', lineHeight: '1.5' }}>
              No attendance scans have been logged for <strong>{formatHumanDate(todayKey)}</strong>. Master roster rows are hidden on non-formation days to keep the dashboard clean.
            </p>


          </div>
        ) : tableFilteredCadets.length === 0 ? (
          <div style={{ textTransform: 'uppercase', padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No cadets matching active filters {searchQuery.trim() ? `and search term "${searchQuery.trim()}"` : ''} ({selectedBattalion || 'All Battalions'}{selectedCompany ? ` • ${getSelectedCompanyDisplay()}` : ''}{selectedPlatoon ? ` • ${selectedPlatoon}` : ''}).
          </div>
        ) : (
          <div
            className="table-responsive"
            style={{
              maxHeight: '520px',
              overflowY: 'auto',
              position: 'relative'
            }}
          >
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>#</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Cadet ID</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Cadet Name</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Battalion</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Company</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Platoon</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Time-In</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Time-Out</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Status</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 10 }}>Duty Officer</th>
                </tr>
              </thead>
              <tbody>
                {tableFilteredCadets.map((cadet, idx) => {
                  const timeInDisplay = cadet.timeInDisplay || formatDisplayTime(cadet.timeIn || cadet.time_in);
                  const timeOutDisplay = cadet.timeOutDisplay || formatDisplayTime(cadet.timeOut || cadet.time_out);
                  const finalStatus = cadet.finalDailyStatus || 'ABSENT';

                  return (
                    <tr key={cadet.cadetId || idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>{cadet.cadetId}</td>
                      <td style={{ fontWeight: 600 }}>{cadet.name}</td>
                      <td><span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>{cadet.battalion || '1st Battalion'}</span></td>
                      <td><span className="badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>{cadet.company || 'Alpha Company'}</span></td>
                      <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{cadet.platoon || '1st Platoon'}</span></td>

                      {/* Time-In Column */}
                      <td>
                        {timeInDisplay ? (
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: (cadet.isLate || String(cadet.finalDailyStatus || '').includes('LATE')) ? '#d97706' : '#065f46' }}>
                            {timeInDisplay}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Scan</span>
                        )}
                      </td>

                      {/* Time-Out Column */}
                      <td>
                        {timeOutDisplay ? (
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#065f46' }}>
                            {timeOutDisplay}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {cadet.hasTimeIn ? (
                              <span className="badge" style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', fontSize: '0.68rem', padding: '2px 6px', fontWeight: 700 }}>
                                NO TIME-OUT
                              </span>
                            ) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Final Daily Status Badge */}
                      <td>
                        {(!hasTodayScans || finalStatus === 'NO SCAN TODAY') ? (
                          <span
                            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                            style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                          >
                            <Activity size={12} /> NO SCAN TODAY
                          </span>
                        ) : (
                          <>
                            {(finalStatus === 'PRESENT' || finalStatus === 'PRESENT (Complete)') && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <CheckCircle2 size={12} /> PRESENT
                              </span>
                            )}
                            {(finalStatus === 'LATE' || finalStatus === 'LATE (Complete)') && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <Clock size={12} /> LATE
                              </span>
                            )}
                            {(finalStatus === 'NO TIME-OUT' || finalStatus === 'INCOMPLETE (No Time-Out)') && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-800 border border-orange-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#ffedd5', color: '#9a3412', borderColor: '#fed7aa', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <Activity size={12} /> NO TIME-OUT
                              </span>
                            )}
                            {(finalStatus === 'LATE / NO TIME-OUT' || finalStatus === 'INCOMPLETE (Late / No Time-Out)') && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <Activity size={12} /> LATE / NO TIME-OUT
                              </span>
                            )}
                            {finalStatus === 'ABSENT' && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <UserX size={12} /> ABSENT
                              </span>
                            )}
                            {finalStatus === 'EXCUSE_PENDING' && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-900 border border-purple-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#faf5ff', color: '#581c87', borderColor: '#d8b4fe', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <FileText size={12} /> EXCUSE PENDING
                              </span>
                            )}
                            {finalStatus === 'EXCUSED' && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-800 border border-sky-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#f0f9ff', color: '#075985', borderColor: '#7dd3fc', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                <CheckCircle2 size={12} /> EXCUSED
                              </span>
                            )}
                            {!['PRESENT', 'PRESENT (Complete)', 'LATE', 'LATE (Complete)', 'NO TIME-OUT', 'INCOMPLETE (No Time-Out)', 'LATE / NO TIME-OUT', 'INCOMPLETE (Late / No Time-Out)', 'ABSENT', 'NO SCAN TODAY', 'EXCUSE_PENDING', 'EXCUSED'].includes(finalStatus) && (
                              <span
                                className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-300 rounded-full font-black text-[11px] tracking-wide px-3 py-1"
                                style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', borderRadius: '9999px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.025em', padding: '4px 12px' }}
                              >
                                {finalStatus}
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Duty Officer Column */}
                      <td>
                        {finalStatus === 'EXCUSE_PENDING' ? (
                          '—'
                        ) : (() => {
                          const cId = String(cadet.cadetId || cadet.id || cadet.cadet_id || '').trim().toUpperCase();
                          const matchingLog = attendanceLogs.find(l => {
                            const lId = String(l.cadetId || l.cadet_id || l.id || '').trim().toUpperCase();
                            return lId && lId === cId;
                          });

                          // 1. Direct officer on matching log or scan
                          const directOfficer = (
                            matchingLog?.duty_officer ||
                            matchingLog?.dutyOfficer ||
                            cadet.timeInScan?.duty_officer ||
                            cadet.timeInScan?.dutyOfficer ||
                            cadet.timeOutScan?.duty_officer ||
                            cadet.timeOutScan?.dutyOfficer ||
                            cadet.duty_officer ||
                            cadet.dutyOfficer
                          );
                          if (directOfficer && directOfficer !== 'Duty Officer' && directOfficer !== 'HQ Duty Officer' && !directOfficer.includes(',')) {
                            return directOfficer;
                          }

                          // 2. If finalStatus is EXCUSED and log has duty officer
                          if (finalStatus === 'EXCUSED') {
                            if (directOfficer && directOfficer !== '—') return directOfficer;
                            return '—';
                          }

                          // 3. For absent or unrecorded scans
                          const isAbsentOrNoScan = (
                            !hasTodayScans ||
                            finalStatus === 'NO SCAN TODAY' ||
                            finalStatus === 'ABSENT' ||
                            (!cadet.hasTimeIn && !cadet.hasTimeOut && !cadet.timeInScan && !cadet.timeOutScan)
                          );

                          if (isAbsentOrNoScan) {
                            if (directOfficer && directOfficer !== 'Duty Officer' && directOfficer !== 'HQ Duty Officer') {
                              return directOfficer;
                            }
                            return '—';
                          }

                          const resolvedOfficer = getDutyOfficerForCadet(cadet, dbSessions, attendanceLogs, todayKey);
                          if (resolvedOfficer && resolvedOfficer !== '—' && resolvedOfficer !== 'Duty Officer' && resolvedOfficer !== 'HQ Duty Officer') {
                            return resolvedOfficer;
                          }

                          return '—';
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick History Log Banner at bottom of Live Dashboard */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e5a900'
            }}
          >
            <Archive size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
              Looking for Past Formation Logs or Absences?
            </div>
            <div style={{ fontSize: '0.8rem', color: '#d1fae5' }}>
              Access the complete archive of previous training dates, absence matrices, and turnout rate trends.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToHistory}
          className="btn"
          style={{
            background: '#e5a900',
            color: '#064e2e',
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '0.5rem 1.1rem',
            border: 'none',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          <Archive size={16} /> Open Attendance History & Archives
        </button>
      </div>
    </div>
  );
}
