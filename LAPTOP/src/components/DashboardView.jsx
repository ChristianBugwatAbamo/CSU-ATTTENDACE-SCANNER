import React, { useState, useEffect, useMemo } from 'react';
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
  UserX
} from 'lucide-react';
import DashboardUnitHierarchy from './DashboardUnitHierarchy';
import {
  reconcileRosterAttendance,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from '../utils/attendanceStatus';
import { useAttendanceData } from '../hooks/useAttendanceData';
import { subscribeToAttendanceRealtime, fetchCadetCountFromSupabase } from '../utils/supabaseClient';

function toDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  let d = new Date(dateInput);
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
    targetQuota: 592,
    companies: [
      {
        id: 'co-1-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-a-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-a-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-a-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-a-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-b-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-b-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-b-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-b-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-c-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-c-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-c-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-c-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-1-d-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-d-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-1-d-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-1-d-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      }
    ]
  },
  {
    id: 'bn-2',
    name: '2nd Battalion',
    shortCode: '2BN',
    targetQuota: 592,
    companies: [
      {
        id: 'co-2-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-a-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-a-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-a-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-a-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-b-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-b-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-b-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-b-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-c-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-c-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-c-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-c-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        targetQuota: 148,
        platoons: [
          { id: 'pl-2-d-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-d-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
          { id: 'pl-2-d-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
          { id: 'pl-2-d-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
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

  // Strict Date Filter: Command dashboard strictly observes today's session_date
  const attendanceLogs = useMemo(() => {
    if (!Array.isArray(rawMasterLogs)) return [];
    return rawMasterLogs.filter(log => {
      const rawDate = log.date || log.timestamp || log.receivedAt;
      if (!rawDate) return false;
      const key = toDateKey(rawDate);
      return key === todayKey;
    });
  }, [rawMasterLogs, todayKey]);

  const hasTodayScans = attendanceLogs.length > 0;
  const formationCutoff = activeCutoff || getActiveFormationCutoff();
  const unitStructure = hookSettings?.unitStructure?.length > 0 ? hookSettings.unitStructure : DEFAULT_UNIT_STRUCTURE;

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
      const cid = String(c.id || c.cadetId || '').trim().toUpperCase();
      if (cid) allCadetsMap.set(cid, c);
    });
    (rawMasterLogs || []).forEach(l => {
      const cid = String(l.cadetId || l.id || '').trim().toUpperCase();
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

  const attendanceSummary = useMemo(() => {
    if (!hasTodayScans) {
      return {
        totalStrength: dynamicHierarchy.totalUnitStrength,
        presentCompleteCount: 0,
        lateCompleteCount: 0,
        incompleteCount: 0,
        absentCount: 0,
        totalScanned: 0,
        presentOrLateCount: 0
      };
    }
    return rawSummary;
  }, [hasTodayScans, rawSummary, dynamicHierarchy.totalUnitStrength]);

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
        if (!cadetStatus.includes('ABSENT')) return false;
      } else {
        if (!cadetStatus.includes(filterNorm)) return false;
      }
    }

    return matchesBn && matchesCo && matchesPl;
  });

  const getSelectedCompanyDisplay = () => {
    if (!selectedCompany) return '';
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
            Live formation attendance, echelon hierarchy drill-down, and master unit records for {formatHumanDate(todayKey)}.
          </div>
        </div>
      </div>

      {/* Top Metric Cards: Unit Strength, Present, Late, No Time In/Out, No Scan Today */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Total Unit Strength */}
        <div className="card" style={{ borderLeft: '5px solid var(--rotc-green-dark)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rotc-green-dark)' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Unit Strength</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {totalStrength} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalStrength} Target</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: PRESENT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'PRESENT' ? '#059669' : '#d1fae5'}`,
            cursor: 'pointer',
            outline: statusFilter === 'PRESENT' ? '2px solid #059669' : 'none',
            background: statusFilter === 'PRESENT' ? '#f0fdf4' : undefined
          }}
          onClick={() => handleStatusCardClick('PRESENT')}
          title="Click to filter table: PRESENT cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Present</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#065f46' }}>
                {attendanceSummary.presentCompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'PRESENT' ? '✓ Filtering table by Present' : 'Click to filter → Present'}
          </div>
        </div>

        {/* Card 3: LATE */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'LATE' ? '#d97706' : '#fde68a'}`,
            cursor: 'pointer',
            outline: statusFilter === 'LATE' ? '2px solid #d97706' : 'none',
            background: statusFilter === 'LATE' ? '#fffbeb' : undefined
          }}
          onClick={() => handleStatusCardClick('LATE')}
          title="Click to filter table: LATE cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Late</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#92400e' }}>
                {attendanceSummary.lateCompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'LATE' ? '✓ Filtering table by Late' : 'Click to filter → Late'}
          </div>
        </div>

        {/* Card 4: NO TIME IN/OUT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '#ea580c' : '#fed7aa'}`,
            cursor: 'pointer',
            outline: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '2px solid #ea580c' : 'none',
            background: (statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '#fff7ed' : undefined
          }}
          onClick={() => handleStatusCardClick('NO TIME IN/OUT')}
          title="Click to filter table: No Time In/Out cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(234, 88, 12, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>No Time In/Out</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#9a3412' }}>
                {attendanceSummary.incompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {(statusFilter === 'NO TIME IN/OUT' || statusFilter === 'NO TIME-OUT') ? '✓ Filtering table by No Time In/Out' : 'Click to filter → No Time In/Out'}
          </div>
        </div>

        {/* Card 5: ABSENT / NO SCAN TODAY */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'ABSENT' ? '#64748b' : '#e2e8f0'}`,
            cursor: hasTodayScans ? 'pointer' : 'default',
            outline: statusFilter === 'ABSENT' ? '2px solid #64748b' : 'none',
            background: statusFilter === 'ABSENT' ? '#f1f5f9' : undefined
          }}
          onClick={() => hasTodayScans && handleStatusCardClick('ABSENT')}
          title={hasTodayScans ? "Click to filter table: Absent cadets only" : "No formation recorded for today"}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(100, 116, 139, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                {hasTodayScans ? 'Absent' : 'No Scan Today'}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#334155' }}>
                {hasTodayScans ? attendanceSummary.absentCount : 0} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {hasTodayScans ? (statusFilter === 'ABSENT' ? '✓ Filtering table by Absent' : 'Click to filter → Absent') : 'No active formation today'}
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
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Filter size={13} color="var(--rotc-green-dark)" />
                <span style={{ color: 'var(--text-muted)' }}>Active filters:</span>
                {selectedBattalion && (
                  <strong
                    onClick={() => { setSelectedBattalion(null); setSelectedCompany(null); setSelectedPlatoon(null); }}
                    style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear battalion filter"
                  >
                    {selectedBattalion} ×
                  </strong>
                )}
                {selectedCompany && (
                  <strong
                    onClick={() => { setSelectedCompany(null); setSelectedPlatoon(null); }}
                    style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear company filter"
                  >
                    {getSelectedCompanyDisplay()} ×
                  </strong>
                )}
                {selectedPlatoon && (
                  <strong
                    onClick={() => setSelectedPlatoon(null)}
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear platoon filter"
                  >
                    {selectedPlatoon} ×
                  </strong>
                )}
                {statusFilter && (
                  <strong
                    onClick={() => setStatusFilter(null)}
                    style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear status filter"
                  >
                    Status: {statusFilter} ×
                  </strong>
                )}
                {searchQuery.trim() && (
                  <strong
                    onClick={() => setSearchQuery('')}
                    style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear search filter"
                  >
                    Search: "{searchQuery.trim()}" ×
                  </strong>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Showing full Brigade Master Roster ({totalStrength} Cadets). Scanned cadets update to Present/Late in real-time.
              </div>
            )}
          </div>

          {/* Search Input Bar & Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '260px', maxWidth: '340px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Cadet ID or Name..."
                style={{
                  width: '100%',
                  padding: '0.45rem 2rem 0.45rem 2rem',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border-light)',
                  background: '#f8fafc',
                  color: 'var(--text-dark)',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--rotc-green-dark)';
                  e.target.style.background = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-light)';
                  if (!searchQuery) e.target.style.background = '#f8fafc';
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {isAnyFilterActive && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearAllFilters}
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Reset all echelon filters and search query"
              >
                <XCircle size={14} /> Clear All
              </button>
            )}
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

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {onNavigateToHistory && (
                <button
                  type="button"
                  onClick={onNavigateToHistory}
                  className="btn btn-primary"
                  style={{
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Archive size={15} /> View Attendance History & Past Formations
                </button>
              )}
            </div>
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
                  const timeInDisplay = cadet.timeIn
                    ? new Date(cadet.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const timeOutDisplay = cadet.timeOut
                    ? new Date(cadet.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : null;
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{timeInDisplay}</span>
                            {cadet.isLate ? (
                              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, padding: '2px 6px', fontSize: '0.7rem' }}>
                                <Clock size={10} /> LATE
                              </span>
                            ) : (
                              <span className="badge badge-present" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                                <CheckCircle2 size={10} /> PRESENT
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Scan</span>
                        )}
                      </td>

                      {/* Time-Out Column */}
                      <td>
                        {timeOutDisplay ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{timeOutDisplay}</span>
                            <span className="badge badge-present" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                              <CheckCircle2 size={10} /> PRESENT
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {cadet.hasTimeIn ? (
                              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.68rem', padding: '2px 6px' }}>
                                NO TIME-OUT
                              </span>
                            ) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Final Daily Status Badge */}
                      <td>
                        {(!hasTodayScans || finalStatus === 'NO SCAN TODAY') ? (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 700, gap: '3px' }}>
                            <Activity size={11} /> NO SCAN TODAY
                          </span>
                        ) : (
                          <>
                            {(finalStatus === 'PRESENT' || finalStatus === 'PRESENT (Complete)') && (
                              <span className="badge badge-present" style={{ fontWeight: 800, gap: '3px' }}>
                                <CheckCircle2 size={11} /> PRESENT
                              </span>
                            )}
                            {(finalStatus === 'LATE' || finalStatus === 'LATE (Complete)') && (
                              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 800, gap: '3px' }}>
                                <Clock size={11} /> LATE
                              </span>
                            )}
                            {(finalStatus === 'NO TIME-OUT' || finalStatus === 'INCOMPLETE (No Time-Out)') && (
                              <span className="badge" style={{ background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa', fontWeight: 800, gap: '3px' }}>
                                <Activity size={11} /> NO TIME-OUT
                              </span>
                            )}
                            {(finalStatus === 'LATE / NO TIME-OUT' || finalStatus === 'INCOMPLETE (Late / No Time-Out)') && (
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                                <Activity size={11} /> LATE / NO TIME-OUT
                              </span>
                            )}
                            {finalStatus === 'ABSENT' && (
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontWeight: 800, gap: '3px' }}>
                                <UserX size={11} /> ABSENT
                              </span>
                            )}
                            {!['PRESENT', 'PRESENT (Complete)', 'LATE', 'LATE (Complete)', 'NO TIME-OUT', 'INCOMPLETE (No Time-Out)', 'LATE / NO TIME-OUT', 'INCOMPLETE (Late / No Time-Out)', 'ABSENT', 'NO SCAN TODAY'].includes(finalStatus) && (
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                                {finalStatus}
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      <td>{cadet.dutyOfficer || (hasTodayScans ? 'Duty Officer' : '—')}</td>
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
