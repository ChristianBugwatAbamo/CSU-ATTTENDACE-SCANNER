import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserCheck, Shield, Award, Activity, RefreshCw, Layers, Compass, Building, CheckCircle2, Filter, XCircle, ChevronRight, ArrowLeft, RotateCcw, Star, Medal, Clock, Search, X, Archive, Calendar, History, UserX } from 'lucide-react';
import AttendanceHistory from './AttendanceHistory';
import {
  getAttendanceStatus,
  getScannedUnitEchelon,
  evaluateSingleScan,
  reconcileCadetDailyStatus,
  reconcileRosterAttendance,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from '../utils/attendanceStatus';
import { useAttendanceData } from '../hooks/useAttendanceData';

// Default 1,184 Standard CSU ROTC Structure Template
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

export default function AnalyticsDashboard({ cadets: propsCadets = [], attendanceLogs: propsLogs = [], onRefresh, onNavigateToHistory }) {
  const { records: hookLogs, settings: hookSettings, activeCutoff } = useAttendanceData();
  const attendanceLogs = hookLogs && hookLogs.length > 0 ? hookLogs : propsLogs;
  const formationCutoff = activeCutoff || getActiveFormationCutoff();
  const unitStructure = hookSettings?.unitStructure?.length > 0 ? hookSettings.unitStructure : DEFAULT_UNIT_STRUCTURE;

  // Top-Level Category Selection ('BASIC_CADETS' | 'CADET_OFFICERS' | null)
  const [mainCategory, setMainCategory] = useState(null);

  // Cascading Selection State for drill-downs
  const [selectedBattalion, setSelectedBattalion] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPlatoon, setSelectedPlatoon] = useState(null);

  // Search input state for filtering by Cadet ID or Name
  const [searchQuery, setSearchQuery] = useState('');

  // Status filter applied by clicking stat summary cards ('PRESENT' | 'LATE' | 'NO TIME-OUT' | 'ABSENT' | null)
  const [statusFilter, setStatusFilter] = useState(null);

  const handleStatusCardClick = (status) => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  // Dynamic Calculated Quotas
  const totalBasicQuota = unitStructure.reduce((acc, bn) => acc + (Number(bn.targetQuota) || 0), 0) || 1184;
  const totalOfficerQuota = 60;
  const totalUnitStrengthQuota = totalBasicQuota + totalOfficerQuota;

  const totalPlatoonsCount = unitStructure.reduce((acc, bn) => {
    return acc + (bn.companies ? bn.companies.reduce((pAcc, co) => pAcc + (co.platoons ? co.platoons.length : 0), 0) : 0);
  }, 0);

  // Officer Classes Structure
  const OFFICER_CLASSES = [
    {
      key: '1CL',
      title: '1st Class',
      name: '1st Class Officers',
      shortName: '1st Class',
      desc: 'Cadet COL, Cadet LT COL • Corps Command & Special Staff',
      target: 4
    },
    {
      key: '2CL',
      title: '2nd Class',
      name: '2nd Class Officers',
      shortName: '2nd Class',
      desc: 'Cadet MAJ, Cadet CPT • Brigade Staff & Battalion Commanders',
      target: 8
    },
    {
      key: '3CL',
      title: '3rd Class',
      name: '3rd Class Officers',
      shortName: '3rd Class',
      desc: 'Cadet CPT, Cadet 1LT • Company Commanders & Executive Officers',
      target: 12
    },
    {
      key: '4CL',
      title: '4th Class',
      name: '4th Class Officers',
      shortName: '4th Class',
      desc: 'Cadet 1LT, Cadet 2LT • Platoon Leaders & Junior Staff Officers',
      target: 16
    },
    {
      key: 'ASPIRANT',
      title: 'Aspirant',
      name: 'Aspirants & Candidates',
      shortName: 'Aspirant',
      desc: 'Cadet Officer Candidates (COCC) & Probationary Aspirants',
      target: 20
    }
  ];

  // Helper: Match whether a log is a Cadet Officer
  const isOfficerLog = (log) => {
    const r = (log.rank || '').toLowerCase();
    const b = (log.battalion || '').toLowerCase();
    const c = (log.company || '').toLowerCase();
    const p = (log.platoon || '').toLowerCase();
    const d = (log.designation || '').toLowerCase();
    const t = (log.type || log.category || '').toLowerCase();

    return t === 'officer' || t.includes('officer') ||
      b.includes('officer') || b.includes('brigade') ||
      c.includes('officer') || c.includes('headquarters') ||
      r.includes('1cl') || r.includes('2cl') || r.includes('3cl') || r.includes('4cl') || r.includes('aspirant') ||
      r.includes('col') || r.includes('maj') || r.includes('cpt') || r.includes('lt') ||
      d.includes('commander') || d.includes('staff') || d.includes('adjutant') || d.includes('s1') || d.includes('s2') || d.includes('s3') || d.includes('s4') || d.includes('s7');
  };

  // Helper: Match a log to a specific Officer Class (1CL, 2CL, 3CL, 4CL, ASPIRANT)
  const matchesOfficerClass = (log, classKey) => {
    const r = (log.rank || '').toLowerCase();
    const c = (log.company || '').toLowerCase();
    const p = (log.platoon || '').toLowerCase();
    const d = (log.designation || '').toLowerCase();
    const k = (classKey || '').toLowerCase();

    if (k === '1cl' || k.includes('1st')) {
      return r.includes('1cl') || d.includes('corps commander') || d.includes('deputy commander') || r.includes('col');
    }
    if (k === '2cl' || k.includes('2nd')) {
      return r.includes('2cl') || (r.includes('maj') && !r.includes('1cl')) || d.includes('s1') || d.includes('s2') || d.includes('s3') || d.includes('s4') || d.includes('s7') || d.includes('bn commander');
    }
    if (k === '3cl' || k.includes('3rd')) {
      return r.includes('3cl') || (r.includes('cpt') && !r.includes('2cl')) || d.includes('coy commander');
    }
    if (k === '4cl' || k.includes('4th')) {
      return r.includes('4cl') || (r.includes('2lt') || (r.includes('1lt') && !r.includes('3cl'))) || d.includes('platoon leader');
    }
    if (k === 'aspirant' || k.includes('aspirant')) {
      return r.includes('aspirant') || r.includes('candidate') || r.includes('cocc') || c.includes('aspirant') || p.includes('aspirant');
    }
    return false;
  };

  // 1. Dynamic Counts calculated directly from attendanceLogs
  // Full Roster Reconciliation against Attendance Logs
  const { reconciledRoster, summary: attendanceSummary } = reconcileRosterAttendance(
    propsCadets,
    attendanceLogs,
    null,
    formationCutoff
  );

  const totalAttendanceScans = attendanceLogs.length;
  const uniqueCadetIds = new Set(attendanceLogs.map(l => (l.cadetId || '').trim()).filter(Boolean));
  const uniqueCadetsCount = uniqueCadetIds.size;

  const basicCadetsCount = attendanceLogs.filter(l => !isOfficerLog(l)).length;
  const cadetOfficersCount = attendanceLogs.filter(isOfficerLog).length;

  const isOfficerSelected = mainCategory === 'CADET_OFFICERS';
  const isBasicCadetsSelected = mainCategory === 'BASIC_CADETS';

  // 2. Filtered logs according to active Battalion selector for contextual counts
  const bnSelectorClean = selectedBattalion ? selectedBattalion.replace(' Battalion', '').toLowerCase().trim() : '';
  const activeLogs = selectedBattalion
    ? attendanceLogs.filter(log => {
      if (selectedBattalion === 'CADET OFFICERS') {
        return isOfficerLog(log);
      }
      const echelon = getScannedUnitEchelon(log);
      return (echelon.battalion || '').toLowerCase().includes(bnSelectorClean);
    })
    : (isOfficerSelected ? attendanceLogs.filter(isOfficerLog) : attendanceLogs);

  // 3. Dynamic Basic Cadet Battalions from unitStructure
  const basicBattalions = unitStructure.map((bn, idx) => {
    const bnName = bn.name;
    const bnNorm = normalizeBattalion(bnName);
    const scanned = attendanceLogs.filter(l => {
      if (isOfficerLog(l)) return false;
      const echelon = getScannedUnitEchelon(l);
      const lBnNorm = normalizeBattalion(echelon.battalion || l.battalion);
      return bnNorm && lBnNorm ? (bnNorm === lBnNorm) : false;
    }).length;
    const target = Number(bn.targetQuota) || 592;
    const coys = bn.companies || [];
    const coysDesc = coys.length > 0
      ? `${coys.map(c => c.shortCode || c.name.replace(' Company', '')).join(', ')} • ${coys.reduce((acc, c) => acc + (c.platoons?.length || 0), 0)} Platoons`
      : 'No companies configured';
    const icon = bnName.includes('1st') ? Shield : (bnName.includes('2nd') ? Award : Layers);

    return {
      id: bn.id || `bn-${idx}`,
      name: bnName,
      shortCode: bn.shortCode || `${idx + 1}BN`,
      scanned,
      target,
      companiesDesc: coysDesc,
      icon
    };
  });

  // 4. Dynamic Active Battalion & Company Objects for Step 2 and Step 3
  const activeBnObj = unitStructure.find(b => {
    if (!selectedBattalion) return false;
    const selNorm = normalizeBattalion(selectedBattalion);
    const bNorm = normalizeBattalion(b.name);
    return selNorm && bNorm ? (selNorm === bNorm) : b.name.toLowerCase().includes(selectedBattalion.toLowerCase());
  }) || unitStructure[0] || null;

  const activeCoysList = activeBnObj && activeBnObj.companies && activeBnObj.companies.length > 0
    ? activeBnObj.companies
    : [
      { id: 'co-alpha', name: 'Alpha Company', shortCode: 'ALPHA', targetQuota: 148, platoons: [] },
      { id: 'co-bravo', name: 'Bravo Company', shortCode: 'BRAVO', targetQuota: 148, platoons: [] },
      { id: 'co-charlie', name: 'Charlie Company', shortCode: 'CHARLIE', targetQuota: 148, platoons: [] },
      { id: 'co-delta', name: 'Delta Company', shortCode: 'DELTA', targetQuota: 148, platoons: [] }
    ];

  const companyCounts = activeCoysList.map(c => {
    const target = Number(c.targetQuota) || 148;
    const cNorm = normalizeCompany(c.name);
    const scanned = activeLogs.filter(log => {
      const echelon = getScannedUnitEchelon(log);
      const coNorm = normalizeCompany(echelon.company || log.company);
      return cNorm && coNorm ? (cNorm === coNorm) : false;
    }).length;
    const percent = Math.min(100, Math.round((scanned / target) * 100));
    return {
      key: c.shortCode || c.name,
      title: c.name,
      name: c.name,
      shortName: c.shortCode || c.name.replace(' Company', ''),
      desc: `${c.platoons?.length || 4} Platoons × Quota: ${target}`,
      target,
      scanned,
      percent
    };
  });

  // 5. Dynamic Active Company & Platoon Objects for Step 3
  const activeCoObj = activeBnObj?.companies?.find(c => {
    if (!selectedCompany) return false;
    const selNorm = normalizeCompany(selectedCompany);
    const cNorm = normalizeCompany(c.name);
    return selNorm && cNorm ? (selNorm === cNorm) : c.name.toLowerCase().includes(selectedCompany.toLowerCase());
  }) || activeBnObj?.companies?.[0] || null;

  const activePltnsList = activeCoObj && activeCoObj.platoons && activeCoObj.platoons.length > 0
    ? activeCoObj.platoons
    : [
      { id: 'pl-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
      { id: 'pl-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
      { id: 'pl-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
      { id: 'pl-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
    ];

  const platoonCounts = activePltnsList.map(p => {
    const pName = p.name;
    const pNorm = normalizePlatoon(pName);
    const scanned = activeLogs.filter(log => {
      const echelon = getScannedUnitEchelon(log);
      const coNorm = normalizeCompany(echelon.company || log.company);
      const plNorm = normalizePlatoon(echelon.platoon || log.platoon);
      const matchCo = selectedCompany
        ? (coNorm === normalizeCompany(selectedCompany))
        : true;
      const matchPl = pNorm && plNorm ? (pNorm === plNorm) : false;
      return matchCo && matchPl;
    }).length;
    const target = Number(p.targetQuota) || 37;
    const percent = Math.min(100, Math.round((scanned / target) * 100));

    return {
      name: pName,
      shortCode: p.shortCode || 'PLTN',
      desc: 'Standard Platoon Formation',
      scanned,
      target,
      percent
    };
  });

  const overallPercent = Math.min(100, Math.round(((uniqueCadetsCount || totalAttendanceScans) / totalUnitStrengthQuota) * 100));

  // 6. Navigation / Selection Handlers
  const handleSelectMainCategory = (cat) => {
    if (mainCategory === cat) {
      setMainCategory(null);
      setSelectedBattalion(null);
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    } else {
      setMainCategory(cat);
      if (cat === 'CADET_OFFICERS') {
        setSelectedBattalion('CADET OFFICERS');
      } else {
        setSelectedBattalion(null);
      }
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    }
  };

  const handleSelectBattalion = (bnName) => {
    if (selectedBattalion === bnName) {
      setSelectedBattalion(null);
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    } else {
      setSelectedBattalion(bnName);
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    }
  };

  const handleSelectCompany = (coKeyOrName) => {
    if (selectedCompany === coKeyOrName) {
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    } else {
      setSelectedCompany(coKeyOrName);
      setSelectedPlatoon(null);
    }
  };

  const handleSelectPlatoon = (plName) => {
    if (selectedPlatoon === plName) {
      setSelectedPlatoon(null);
    } else {
      setSelectedPlatoon(plName);
    }
  };

  const handleResetToAllUnits = () => {
    setMainCategory(null);
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
  };

  const handleResetToMainCategory = () => {
    if (mainCategory === 'BASIC_CADETS') {
      setSelectedBattalion(null);
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    } else if (mainCategory === 'CADET_OFFICERS') {
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    }
  };

  const handleBackToBattalions = () => {
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
  };

  const handleBackToCompanies = () => {
    setSelectedCompany(null);
    setSelectedPlatoon(null);
  };

  const handleClearAllFilters = () => {
    setMainCategory(null);
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
    setSearchQuery('');
    setStatusFilter(null);
  };

  const isAnyFilterActive =
    mainCategory !== null ||
    selectedBattalion !== null ||
    selectedCompany !== null ||
    selectedPlatoon !== null ||
    searchQuery.trim().length > 0 ||
    statusFilter !== null;

  // 7. Interactive Filtered Master Roster Records (All 1,194 Cadets including Absentees)
  const tableFilteredCadets = reconciledRoster.filter(cadet => {
    // Search query filter (Cadet ID or Name, case-insensitive)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const id = String(cadet.cadetId || '').toLowerCase();
      const name = String(cadet.name || '').toLowerCase();
      if (!id.includes(q) && !name.includes(q)) {
        return false;
      }
    }

    // Top-Level Main Category Filter
    if (mainCategory === 'BASIC_CADETS') {
      if (isOfficerLog(cadet)) return false;
    } else if (mainCategory === 'CADET_OFFICERS') {
      if (!isOfficerLog(cadet)) return false;
    }

    let matchesBn = true;
    if (selectedBattalion && selectedBattalion !== 'CADET OFFICERS') {
      const selectedBnNorm = normalizeBattalion(selectedBattalion);
      const cadetBnNorm = normalizeBattalion(cadet.battalion);
      matchesBn = selectedBnNorm && cadetBnNorm ? (selectedBnNorm === cadetBnNorm) : (cadet.battalion || '').toLowerCase().includes(selectedBattalion.toLowerCase());
    }

    let matchesCo = true;
    if (selectedCompany) {
      if (isOfficerSelected) {
        matchesCo = matchesOfficerClass(cadet, selectedCompany);
      } else {
        const selectedCoNorm = normalizeCompany(selectedCompany);
        const cadetCoNorm = normalizeCompany(cadet.company);
        matchesCo = selectedCoNorm && cadetCoNorm ? (selectedCoNorm === cadetCoNorm) : (cadet.company || '').toLowerCase().includes(selectedCompany.toLowerCase());
      }
    }

    let matchesPl = true;
    if (!isOfficerSelected && selectedPlatoon) {
      const selectedPlNorm = normalizePlatoon(selectedPlatoon);
      const cadetPlNorm = normalizePlatoon(cadet.platoon);
      matchesPl = selectedPlNorm && cadetPlNorm ? (selectedPlNorm === cadetPlNorm) : false;
    }

    // Status filter from stat card click
    if (statusFilter) {
      const finalStatus = (cadet.finalDailyStatus || 'ABSENT').toUpperCase();
      const filterNorm = statusFilter.toUpperCase();
      if (finalStatus !== filterNorm) return false;
    }

    return matchesBn && matchesCo && matchesPl;
  });

  // Get active Officer Class display label for breadcrumbs
  const getSelectedCompanyDisplay = () => {
    if (!selectedCompany) return '';
    if (isOfficerSelected) {
      const cls = OFFICER_CLASSES.find(c => c.key === selectedCompany || c.title === selectedCompany || c.name === selectedCompany);
      return cls ? cls.title : selectedCompany;
    }
    return `${selectedCompany} Company`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', margin: 0, letterSpacing: '0.5px' }}>
            COMMAND DASHBOARD
          </h2>
        </div>


      </div>

      {/* Top Static Summary Metric Cards */}
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
                {attendanceSummary.totalStrength || uniqueCadetsCount || totalAttendanceScans} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalUnitStrengthQuota}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {Math.min(100, Math.round(((attendanceSummary.totalStrength || uniqueCadetsCount || totalAttendanceScans) / totalUnitStrengthQuota) * 100))}% of Brigade Quota
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

        {/* Card 4: NO TIME-OUT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'NO TIME-OUT' ? '#ea580c' : '#fed7aa'}`,
            cursor: 'pointer',
            outline: statusFilter === 'NO TIME-OUT' ? '2px solid #ea580c' : 'none',
            background: statusFilter === 'NO TIME-OUT' ? '#fff7ed' : undefined
          }}
          onClick={() => handleStatusCardClick('NO TIME-OUT')}
          title="Click to filter table: No Time-Out cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(234, 88, 12, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>No Time-Out</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#9a3412' }}>
                {attendanceSummary.incompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'NO TIME-OUT' ? '✓ Filtering table by No Time-Out' : 'Click to filter → No Time-Out'}
          </div>
        </div>

        {/* Card 5: ABSENT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'ABSENT' ? '#64748b' : '#e2e8f0'}`,
            cursor: 'pointer',
            outline: statusFilter === 'ABSENT' ? '2px solid #64748b' : 'none',
            background: statusFilter === 'ABSENT' ? '#f1f5f9' : undefined
          }}
          onClick={() => handleStatusCardClick('ABSENT')}
          title="Click to filter table: Absent cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(100, 116, 139, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Absent</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#334155' }}>
                {attendanceSummary.absentCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'ABSENT' ? '✓ Filtering table by Absent' : 'Click to filter → Absent'}
          </div>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* LEVEL 0: Select Unit Category (Basic Cadets vs Cadet Officers)            */}
      {/* ========================================================================= */}
      <div className="card" style={{ border: '2px solid #cbd5e1', background: '#f8fafc' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark)' }}>
              <Compass size={20} color="var(--rotc-green-dark)" />
              <span style={{ fontWeight: 800 }}>Select Unit Category</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Choose whether to view and filter the <strong>Basic Cadets</strong> hierarchy ({unitStructure.length} Battalions) or the <strong>Cadet Officers</strong> Corps.
            </div>
          </div>

          {mainCategory && (
            <span className="badge" style={{
              background: isBasicCadetsSelected ? '#e2e8f0' : '#e0e7ff',
              color: isBasicCadetsSelected ? '#1e293b' : '#3730a3',
              fontWeight: 800,
              border: `1px solid ${isBasicCadetsSelected ? '#94a3b8' : '#a5b4fc'}`
            }}>
              ✓ {isBasicCadetsSelected ? 'BASIC CADETS' : 'CADET OFFICERS'} Selected
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

          {/* Option 1: BASIC CADETS (Theme: Dark Slate / Charcoal) */}
          <div
            onClick={() => handleSelectMainCategory('BASIC_CADETS')}
            style={{
              background: isBasicCadetsSelected ? '#f1f5f9' : '#ffffff',
              padding: '1.25rem',
              borderRadius: '12px',
              border: isBasicCadetsSelected ? '2px solid #334155' : '1px solid var(--border-light)',
              boxShadow: isBasicCadetsSelected ? '0 4px 16px rgba(51, 65, 85, 0.25)' : 'var(--shadow-sm)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}
            title="Click to select Basic Cadets hierarchy"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: isBasicCadetsSelected ? '#334155' : 'rgba(51, 65, 85, 0.12)',
                  color: isBasicCadetsSelected ? '#ffffff' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}>
                  <Shield size={22} />
                </div>
                <div>
                  <div style={{ color: isBasicCadetsSelected ? '#0f172a' : '#1e293b', fontSize: '1.1rem', fontWeight: 800 }}>
                    BASIC CADETS
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {unitStructure.length} Battalions • {totalPlatoonsCount} Platoons
                  </div>
                </div>
              </div>

              <span className="badge" style={{
                background: isBasicCadetsSelected ? '#334155' : '#e2e8f0',
                color: isBasicCadetsSelected ? '#ffffff' : '#1e293b',
                fontWeight: 800
              }}>
                {basicCadetsCount} / {totalBasicQuota}
              </span>
            </div>

            <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round((basicCadetsCount / totalBasicQuota) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #1e293b, #475569)', transition: 'width 0.4s ease' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: isBasicCadetsSelected ? '#0f172a' : 'var(--text-muted)', fontWeight: 700 }}>
              <span>{isBasicCadetsSelected ? '▼ Battalions Revealed Below' : '▶ Click to Drill Down into Battalions'}</span>
              <span>{totalBasicQuota.toLocaleString()} Cadets Quota</span>
            </div>
          </div>

          {/* Option 2: CADET OFFICERS (Theme: Indigo / Purple) */}
          <div
            onClick={() => handleSelectMainCategory('CADET_OFFICERS')}
            style={{
              background: isOfficerSelected ? '#eef2ff' : '#ffffff',
              padding: '1.25rem',
              borderRadius: '12px',
              border: isOfficerSelected ? '2px solid #4f46e5' : '1px solid var(--border-light)',
              boxShadow: isOfficerSelected ? '0 4px 16px rgba(79, 70, 229, 0.25)' : 'var(--shadow-sm)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}
            title="Click to select Cadet Officers and view officer classes"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: isOfficerSelected ? '#4f46e5' : 'rgba(79, 70, 229, 0.12)',
                  color: isOfficerSelected ? '#ffffff' : '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}>
                  <Medal size={22} />
                </div>
                <div>
                  <div style={{ color: isOfficerSelected ? '#312e81' : '#3730a3', fontSize: '1.1rem', fontWeight: 800 }}>
                    CADET OFFICERS
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    1st, 2nd, 3rd, 4th Class & Aspirants
                  </div>
                </div>
              </div>

              <span className="badge" style={{
                background: isOfficerSelected ? '#4f46e5' : '#e0e7ff',
                color: isOfficerSelected ? '#ffffff' : '#3730a3',
                fontWeight: 800
              }}>
                {cadetOfficersCount} / 60
              </span>
            </div>

            <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round((cadetOfficersCount / 60) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #4338ca, #6366f1)', transition: 'width 0.4s ease' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: isOfficerSelected ? '#3730a3' : 'var(--text-muted)', fontWeight: 700 }}>
              <span>{isOfficerSelected ? '▼ Officer Classes Revealed Below' : '▶ Click to View Officer Classes'}</span>
              <span>60 Officers Quota</span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 1: Basic Cadets -> Battalion Selection (Theme: BLUE)               */}
      {/* ========================================================================= */}
      {isBasicCadetsSelected && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af' }}>
                <Layers size={18} color="#2563eb" />
                <span style={{ color: '#1e3a8a', fontWeight: 800 }}>Step 1: Battalion ({basicBattalions.length} Configured)</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedBattalion
                  ? `Active Battalion: ${selectedBattalion}. Click another card or click again to change.`
                  : 'Click a Battalion card below to drill down into its Companies.'}
              </div>
            </div>

            {selectedBattalion && (
              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800, border: '1px solid #93c5fd' }}>
                ✓ {selectedBattalion} Selected
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {basicBattalions.map(bn => {
              const pct = Math.min(100, Math.round((bn.scanned / bn.target) * 100));
              const isSelected = selectedBattalion === bn.name;
              const IconComp = bn.icon || Shield;

              return (
                <div
                  key={bn.id || bn.name}
                  onClick={() => handleSelectBattalion(bn.name)}
                  style={{
                    background: isSelected ? '#eff6ff' : '#f8fafc',
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid var(--border-light)',
                    boxShadow: isSelected ? '0 4px 16px rgba(37, 99, 235, 0.25)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative'
                  }}
                  title={`Click to select ${bn.name} and view companies`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IconComp size={18} color="#2563eb" />
                      <strong style={{ color: isSelected ? '#1e3a8a' : '#1e40af', fontSize: '1rem' }}>
                        {bn.name}
                      </strong>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                        {bn.shortCode}
                      </span>
                    </div>
                    <span className="badge" style={{
                      background: isSelected ? '#2563eb' : (bn.scanned > 0 ? '#dbeafe' : '#f1f5f9'),
                      color: isSelected ? '#ffffff' : (bn.scanned > 0 ? '#1e40af' : '#64748b'),
                      fontWeight: 800
                    }}>
                      {bn.scanned} / {bn.target} ({pct}%)
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {bn.companiesDesc}
                  </div>

                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', transition: 'width 0.4s ease' }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: isSelected ? '#1d4ed8' : 'var(--text-muted)', fontWeight: 700 }}>
                    <span>{isSelected ? '▼ Companies Revealed Below' : '▶ Click to Drill Down'}</span>
                    <span>{bn.target} Quota</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 2: Basic Cadets -> Company Selection (Theme: EMERALD / GREEN)       */}
      {/* ========================================================================= */}
      {isBasicCadetsSelected && selectedBattalion && (
        <div className="card" style={{ border: '2px solid #a7f3d0', background: '#f6fdf9' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="card-title" style={{ fontSize: '1rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} color="#059669" />
                <span style={{ color: '#064e2e', fontWeight: 800 }}>
                  Step 2: Companies • {selectedBattalion} ({companyCounts.length} Coys)
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedCompany
                  ? `Active Company: ${selectedCompany}. Platoons revealed below.`
                  : 'Click a Company card below to view its Platoon formations.'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedCompany && (
                <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontWeight: 800, border: '1px solid #6ee7b7' }}>
                  ✓ {selectedCompany} Selected
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {companyCounts.map(comp => {
              const isSelected = selectedCompany === comp.key || selectedCompany === comp.shortName || selectedCompany === comp.name;

              return (
                <div
                  key={comp.key}
                  onClick={() => handleSelectCompany(comp.key)}
                  style={{
                    padding: '1rem',
                    background: isSelected ? '#ecfdf5' : '#ffffff',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #059669' : '1px solid #a7f3d0',
                    boxShadow: isSelected ? '0 4px 14px rgba(5, 150, 105, 0.2)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  title={`Click to select ${comp.name} and view its platoons`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: isSelected ? '#064e2e' : '#065f46', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{comp.name}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: '3px' }}>
                          {comp.shortName}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{comp.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{
                        background: isSelected ? '#059669' : (comp.scanned > 0 ? '#d1fae5' : '#f1f5f9'),
                        color: isSelected ? '#ffffff' : (comp.scanned > 0 ? '#065f46' : '#64748b'),
                        fontWeight: 800,
                        fontSize: '0.75rem'
                      }}>
                        {comp.scanned} / {comp.target} ({comp.percent}%)
                      </span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', margin: '0.5rem 0' }}>
                    <div style={{ width: `${comp.percent}%`, height: '100%', background: 'linear-gradient(90deg, #064e2e, #059669)', transition: 'width 0.4s ease' }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: isSelected ? '#065f46' : 'var(--text-muted)', fontWeight: 700 }}>
                    <span>{isSelected ? '▼ Platoons Revealed Below' : '▶ Click to Reveal Platoons'}</span>
                    <span>{comp.target} Quota</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 3: Basic Cadets -> Platoon Selection (Theme: AMBER / ORANGE)        */}
      {/* ========================================================================= */}
      {isBasicCadetsSelected && selectedBattalion && selectedCompany && (
        <div className="card" style={{ border: '2px solid #fde68a', background: '#fffdf5' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="card-title" style={{ fontSize: '1rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#d97706" />
                <span style={{ color: '#78350f', fontWeight: 800 }}>
                  Step 3: Platoon Formations • {selectedCompany} ({selectedBattalion})
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedPlatoon
                  ? `Filtering table by: ${selectedPlatoon}. Click again to clear platoon focus.`
                  : 'Click a platoon card to focus the attendance table specifically on that platoon.'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedPlatoon && (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, border: '1px solid #fcd34d' }}>
                  ✓ {selectedPlatoon} Focused
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
            {platoonCounts.map(pltn => {
              const isSelected = selectedPlatoon === pltn.name;

              return (
                <div
                  key={pltn.name}
                  onClick={() => handleSelectPlatoon(pltn.name)}
                  style={{
                    padding: '1rem',
                    background: isSelected ? '#fffbeb' : '#ffffff',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #d97706' : '1px solid #fde68a',
                    boxShadow: isSelected ? '0 4px 14px rgba(217, 119, 6, 0.2)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  title={`Click to filter attendance logs by ${pltn.name}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: isSelected ? '#78350f' : '#92400e', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{pltn.name}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '3px' }}>
                          {pltn.shortCode}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pltn.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{
                        background: isSelected ? '#d97706' : (pltn.scanned > 0 ? '#fef3c7' : '#f1f5f9'),
                        color: isSelected ? '#ffffff' : (pltn.scanned > 0 ? '#92400e' : '#64748b'),
                        fontWeight: 800,
                        fontSize: '0.75rem'
                      }}>
                        {pltn.scanned} / {pltn.target} ({pltn.percent}%)
                      </span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', margin: '0.5rem 0' }}>
                    <div style={{ width: `${pltn.percent}%`, height: '100%', background: 'linear-gradient(90deg, #d97706, #f59e0b)', transition: 'width 0.4s ease' }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: isSelected ? '#92400e' : 'var(--text-muted)', fontWeight: 700 }}>
                    <span>{isSelected ? '● Table Filter Active' : '▶ Click to Filter Table'}</span>
                    <span>{pltn.target} Quota</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CADET OFFICERS: Clean Stacked Full-Width Vertical Cards (EMERALD Theme)   */}
      {/* ========================================================================= */}
      {isOfficerSelected && (
        <div className="card" style={{ border: '2px solid #a7f3d0', background: '#f6fdf9' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="card-title" style={{ fontSize: '1rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Medal size={18} color="#059669" />
                <span style={{ color: '#064e2e', fontWeight: 800 }}>
                  Cadet Officer Classes (Click to Filter Attendance Table)
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedCompany
                  ? `Active Selection: ${getSelectedCompanyDisplay()}. Table filtered below.`
                  : 'Click any stacked Officer Class below to directly filter the attendance records.'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedCompany && (
                <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontWeight: 800, border: '1px solid #6ee7b7' }}>
                  ✓ {getSelectedCompanyDisplay()} Active
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {OFFICER_CLASSES.map(comp => {
              const isSelected = selectedCompany === comp.key || selectedCompany === comp.title || selectedCompany === comp.shortName || selectedCompany === comp.name;

              return (
                <div
                  key={comp.key}
                  onClick={() => handleSelectCompany(comp.key)}
                  style={{
                    padding: '1.1rem 1.35rem',
                    background: isSelected ? '#ecfdf5' : '#ffffff',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #059669' : '1px solid #d1fae5',
                    boxShadow: isSelected ? '0 4px 14px rgba(5, 150, 105, 0.2)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                  title={`Click to filter attendance logs by ${comp.title}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isSelected ? '#059669' : 'rgba(5, 150, 105, 0.1)',
                      color: isSelected ? '#ffffff' : '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      <Star size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: isSelected ? '#064e2e' : '#065f46', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{comp.title}</span>
                        {isSelected && (
                          <span style={{ background: '#059669', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                            ACTIVE FILTER
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>{comp.desc}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isSelected ? '#059669' : 'var(--text-muted)',
                      background: isSelected ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                      padding: '4px 10px',
                      borderRadius: '6px'
                    }}>
                      {isSelected ? '✓ Filter Active' : '▶ Click to Filter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Attendance Ingestions Table (Dynamically Filtered by Active Echelons)      */}
      {/* ========================================================================= */}
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
                {mainCategory && (
                  <strong
                    onClick={() => { setMainCategory(null); setSelectedBattalion(null); setSelectedCompany(null); setSelectedPlatoon(null); }}
                    style={{
                      background: isBasicCadetsSelected ? '#e2e8f0' : '#e0e7ff',
                      color: isBasicCadetsSelected ? '#1e293b' : '#3730a3',
                      border: `1px solid ${isBasicCadetsSelected ? '#94a3b8' : '#a5b4fc'}`,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Click to clear category filter"
                  >
                    {isBasicCadetsSelected ? 'BASIC CADETS' : 'CADET OFFICERS'} ×
                  </strong>
                )}
                {isBasicCadetsSelected && selectedBattalion && (
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
                {isBasicCadetsSelected && selectedPlatoon && (
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
                Showing full Brigade Master Roster (1,194 Cadets). Scanned cadets update to Present/Late in real-time.
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

        {tableFilteredCadets.length === 0 ? (
          <div style={{ textTransform: 'uppercase', padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No cadets matching active filters {searchQuery.trim() ? `and search term "${searchQuery.trim()}"` : ''} ({mainCategory ? (isBasicCadetsSelected ? 'Basic Cadets' : 'Cadet Officers') : 'All Units'}{selectedBattalion && isBasicCadetsSelected ? ` • ${selectedBattalion}` : ''}{selectedCompany ? ` • ${getSelectedCompanyDisplay()}` : ''}{isBasicCadetsSelected && selectedPlatoon ? ` • ${selectedPlatoon}` : ''}).
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cadet ID</th>
                  <th>Cadet Name</th>
                  <th>Battalion</th>
                  <th>Company</th>
                  <th>Platoon</th>
                  <th>Time-In</th>
                  <th>Time-Out</th>
                  <th>Status</th>
                  <th>Duty Officer</th>
                </tr>
              </thead>
              <tbody>
                {tableFilteredCadets.map((cadet, idx) => {
                  const isOfficer = isOfficerLog(cadet);
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
                      <td><span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>{cadet.battalion || (isOfficer ? 'CADET OFFICERS' : '1st Battalion')}</span></td>
                      <td><span className="badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>{cadet.company || (isOfficer ? 'Cadet Officer' : 'Alpha')}</span></td>
                      <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{cadet.platoon || (isOfficer ? 'Officer Corps' : '1st Platoon')}</span></td>

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
                        {!['PRESENT', 'PRESENT (Complete)', 'LATE', 'LATE (Complete)', 'NO TIME-OUT', 'INCOMPLETE (No Time-Out)', 'LATE / NO TIME-OUT', 'INCOMPLETE (Late / No Time-Out)', 'ABSENT'].includes(finalStatus) && (
                          <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                            {finalStatus}
                          </span>
                        )}
                      </td>

                      <td>{cadet.dutyOfficer || 'Duty Officer'}</td>
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
