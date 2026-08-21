import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Users,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
  Layers,
  Building,
  RefreshCw,
  Archive,
  UserX,
  FileSpreadsheet,
  Activity,
  Award,
  Sparkles,
  RotateCcw,
  X,
  Info,
  CalendarCheck,
  CalendarDays,
  Settings
} from 'lucide-react';
import LetterheadSettingsModal from './LetterheadSettingsModal';
import {
  reconcileRosterAttendance,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from '../utils/attendanceStatus';
import { exportAttendanceToExcel } from '../utils/excelExport';

/**
 * Robust format helper for ISO date string YYYY-MM-DD
 */
function toDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Human friendly date formatter
 */
function formatHumanDate(dateKey) {
  if (!dateKey) return 'N/A';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (isNaN(dateObj.getTime())) return dateKey;
  return dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

import { useAttendanceData } from '../hooks/useAttendanceData';
import { fetchCadetsFromSupabase, bulkUpsertAttendanceToSupabase } from '../utils/supabaseClient';

export default function AttendanceHistory({
  cadets = [],
  attendanceLogs = [],
  onRefresh,
  onNavigateToSyncLogs
}) {
  const { records: hookLogs = [], cadets: hookCadets = [] } = useAttendanceData();
  const effectiveLogs = Array.isArray(attendanceLogs) && attendanceLogs.length > 0 ? attendanceLogs : hookLogs;
  const effectiveCadets = Array.isArray(cadets) ? cadets : hookCadets;
  const [isSeeding, setIsSeeding] = useState(false);

  const formationCutoff = getActiveFormationCutoff();
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const calendarPopoverRef = useRef(null);

  // 1. Discover all unique dates present in attendanceLogs with recorded scans
  const historicalDates = useMemo(() => {
    const datesMap = new Map();

    effectiveLogs.forEach((log) => {
      const rawDate = log.timestamp || log.date || log.receivedAt;
      const key = toDateKey(rawDate);
      if (!key) return;

      if (!datesMap.has(key)) {
        datesMap.set(key, {
          dateKey: key,
          scansCount: 0,
          sessionNames: new Set(),
          dutyOfficers: new Set(),
          sampleDate: new Date(rawDate)
        });
      }
      const entry = datesMap.get(key);
      entry.scansCount += 1;
      if (log.sessionName) entry.sessionNames.add(log.sessionName);
      if (log.dutyOfficer) entry.dutyOfficers.add(log.dutyOfficer);
    });

    // Filter to ONLY dates with recorded scans and sort descending (newest first)
    return Array.from(datesMap.values())
      .filter(d => d.scansCount > 0)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [effectiveLogs]);

  // Fast map lookup for valid recorded dates
  const historicalDatesMap = useMemo(() => {
    const map = new Map();
    historicalDates.forEach(d => map.set(d.dateKey, d));
    return map;
  }, [historicalDates]);

  // Selected Historical Date state (defaults to most recent recorded formation date)
  const [selectedDate, setSelectedDate] = useState(() => {
    return historicalDates.length > 0 ? historicalDates[0].dateKey : '';
  });

  // Automatically sync to the most recent recorded formation date when logs load or change
  useEffect(() => {
    if (historicalDates.length > 0) {
      const exists = historicalDatesMap.has(selectedDate);
      if (!selectedDate || !exists) {
        setSelectedDate(historicalDates[0].dateKey);
      }
    }
  }, [historicalDates, historicalDatesMap]);

  // Guard: whether the currently selected date actually has recorded formation data
  const isRecordedDate = useMemo(() => {
    return !!selectedDate && historicalDatesMap.has(selectedDate);
  }, [selectedDate, historicalDatesMap]);

  const isTodaySelected = selectedDate === todayKey;

  // Calendar popover & month navigator state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (historicalDates.length > 0) {
      const [y, m] = historicalDates[0].dateKey.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  // Keep calendar month aligned with selected date when opening
  const handleToggleCalendar = () => {
    if (!isCalendarOpen && selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setCalendarMonth(new Date(y, m - 1, 1));
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

  // Table status filter ('ALL' | 'PRESENT' | 'LATE' | 'INCOMPLETE' | 'ABSENT')
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Echelon dropdown filters
  const [battalionFilter, setBattalionFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [platoonFilter, setPlatoonFilter] = useState('ALL');

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);

  // 2. Reconcile complete cadet roster ONLY if the date has recorded formation data
  // Empty State Guard: If unrecorded, return 0 counts to prevent false absentee generation
  const { reconciledRoster, summary } = useMemo(() => {
    if (!selectedDate || !isRecordedDate) {
      return {
        reconciledRoster: [],
        summary: {
          totalStrength: 0,
          presentCompleteCount: 0,
          lateCompleteCount: 0,
          incompleteCount: 0,
          absentCount: 0
        }
      };
    }

    return reconcileRosterAttendance(
      effectiveCadets,
      effectiveLogs,
      new Date(`${selectedDate}T12:00:00`),
      formationCutoff
    );
  }, [effectiveCadets, effectiveLogs, selectedDate, isRecordedDate, formationCutoff]);

  // Selected date session metadata
  const selectedDateMeta = useMemo(() => {
    return historicalDatesMap.get(selectedDate) || {
      dateKey: selectedDate,
      scansCount: 0,
      sessionNames: new Set(),
      dutyOfficers: new Set()
    };
  }, [historicalDatesMap, selectedDate]);

  // 3. Filtered Cadets list for table display
  const filteredCadets = useMemo(() => {
    if (!isRecordedDate) return [];

    return reconciledRoster.filter((cadet) => {
      // 1. Status Filter
      if (statusFilter === 'PRESENT' && !(cadet.finalDailyStatus === 'PRESENT' || cadet.finalDailyStatus === 'PRESENT (Complete)')) {
        return false;
      }
      if (statusFilter === 'LATE' && !(cadet.finalDailyStatus === 'LATE' || cadet.finalDailyStatus === 'LATE (Complete)')) {
        return false;
      }
      if (statusFilter === 'INCOMPLETE' && !(cadet.finalDailyStatus === 'NO TIME-OUT' || cadet.finalDailyStatus === 'INCOMPLETE (No Time-Out)' || cadet.finalDailyStatus === 'LATE / NO TIME-OUT' || cadet.finalDailyStatus === 'INCOMPLETE (Late / No Time-Out)')) {
        return false;
      }
      if (statusFilter === 'ABSENT' && cadet.finalDailyStatus !== 'ABSENT') {
        return false;
      }

      // 2. Battalion Filter
      if (battalionFilter !== 'ALL') {
        const cadetBn = normalizeBattalion(cadet.battalion);
        const filterBn = normalizeBattalion(battalionFilter);
        if (cadetBn !== filterBn) return false;
      }

      // 3. Company Filter
      if (companyFilter !== 'ALL') {
        const cadetCo = normalizeCompany(cadet.company);
        const filterCo = normalizeCompany(companyFilter);
        if (cadetCo !== filterCo) return false;
      }

      // 4. Platoon Filter
      if (platoonFilter !== 'ALL') {
        const cadetPl = normalizePlatoon(cadet.platoon);
        const filterPl = normalizePlatoon(platoonFilter);
        if (cadetPl !== filterPl) return false;
      }

      // 5. Search Query (ID or Name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = cadet.cadetId && cadet.cadetId.toLowerCase().includes(q);
        const matchName = cadet.name && cadet.name.toLowerCase().includes(q);
        const matchCo = cadet.company && cadet.company.toLowerCase().includes(q);
        const matchPl = cadet.platoon && cadet.platoon.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchCo && !matchPl) return false;
      }

      return true;
    });
  }, [reconciledRoster, isRecordedDate, statusFilter, battalionFilter, companyFilter, platoonFilter, searchQuery]);

  // Navigate between recorded formation dates step-by-step
  const handleStepDate = (direction) => {
    if (historicalDates.length === 0) return;
    const currentIndex = historicalDates.findIndex(d => d.dateKey === selectedDate);
    if (currentIndex === -1) {
      setSelectedDate(historicalDates[0].dateKey);
      return;
    }

    if (direction === 'prev' && currentIndex < historicalDates.length - 1) {
      setSelectedDate(historicalDates[currentIndex + 1].dateKey);
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedDate(historicalDates[currentIndex - 1].dateKey);
    }
  };

  // Export selected historical date attendance
  const handleExportHistoricalExcel = async () => {
    if (!isRecordedDate || reconciledRoster.length === 0) {
      setExportNotice({
        type: 'error',
        text: 'Cannot export: No formation records exist for the selected date.'
      });
      return;
    }

    setIsExporting(true);
    try {
      const recordsToExport = reconciledRoster.map(r => ({
        cadetId: r.cadetId,
        name: r.name,
        rank: r.rank,
        battalion: r.battalion,
        company: r.company,
        platoon: r.platoon,
        timeIn: r.timeIn,
        timeOut: r.timeOut,
        scanMode: r.hasTimeOut ? 'Time-Out' : 'Time-In',
        finalStatus: r.finalDailyStatus,
        status: r.finalDailyStatus,
        dutyOfficer: r.dutyOfficer || (selectedDateMeta.dutyOfficers.size > 0 ? Array.from(selectedDateMeta.dutyOfficers).join(', ') : 'Duty Officer'),
        sessionName: `Historical Formation (${formatHumanDate(selectedDate)})`,
        timestamp: r.timeIn || r.timeOut || `${selectedDate}T07:00:00.000Z`
      }));

      const res = await exportAttendanceToExcel(
        recordsToExport,
        `Historical Formation (${formatHumanDate(selectedDate)})`
      );

      setExportNotice({
        type: 'success',
        text: `Exported ${res.count} cadet records for ${formatHumanDate(selectedDate)} successfully!`
      });
    } catch (err) {
      console.error('Error exporting historical attendance:', err);
      setExportNotice({
        type: 'error',
        text: 'Failed to generate Excel export file.'
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  // 1-Click Action to load Saturday August 8 & August 15 formations (75% Present, 15% Late, 10% Absent)
  const handleQuickSeedSaturdays = async () => {
    setIsSeeding(true);
    try {
      let cadetsList = effectiveCadets;
      if (!cadetsList || cadetsList.length === 0) {
        cadetsList = await fetchCadetsFromSupabase();
      }

      // If cadets list is still empty, generate a full default roster
      if (!cadetsList || cadetsList.length === 0) {
        cadetsList = [];
        const battalions = ['1st Battalion', '2nd Battalion'];
        const companies = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
        const platoons = ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
        let cNum = 1001;

        // Staff Officers
        cadetsList.push(
          { id: "221-00101", name: "BAUTISTA, MARK G.", rank: "Cadet COL (ROTC) 1CL", battalion: "CADET OFFICERS", company: "1CL", platoon: "Officer Corps", designation: "Corps Commander" },
          { id: "221-00102", name: "MENDOZA, CLARA H.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "CADET OFFICERS", company: "1CL", platoon: "Officer Corps", designation: "Deputy Commander" },
          { id: "221-00103", name: "RAMOS, DANIEL I.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", designation: "S1 Brigade" },
          { id: "221-00104", name: "CASTILLO, ELENA J.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", designation: "S2 Brigade" },
          { id: "221-00105", name: "GONZALES, ARTH K.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", designation: "S3 Brigade" },
          { id: "221-00106", name: "VILLANUEVA, ROSA L.", rank: "Cadet MAJ (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", designation: "S4 Brigade" },
          { id: "221-00107", name: "ABAMO, CHRISTIAN B.", rank: "Cadet CPT (ROTC) 2CL", battalion: "CADET OFFICERS", company: "2CL", platoon: "Officer Corps", designation: "S7 Brigade" },
          { id: "221-00108", name: "AQUINO, JOSHUA D.", rank: "Cadet CPT (ROTC) 3CL", battalion: "CADET OFFICERS", company: "3CL", platoon: "Officer Corps", designation: "Adjutant" },
          { id: "221-00109", name: "NAVARRO, MICHAEL E.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "1st Battalion", company: "Headquarters", platoon: "Battalion Staff", designation: "1st Bn Commander" },
          { id: "221-00110", name: "FERNANDEZ, GABRIEL F.", rank: "Cadet LT COL (ROTC) 1CL", battalion: "2nd Battalion", company: "Headquarters", platoon: "Battalion Staff", designation: "2nd Bn Commander" }
        );

        // 1,184 Basic Cadets
        battalions.forEach((bn, bnIdx) => {
          companies.forEach((co, coIdx) => {
            platoons.forEach((pl, plIdx) => {
              for (let i = 1; i <= 37; i++) {
                const cid = `221-${bnIdx + 1}${coIdx + 1}${plIdx + 1}${String(i).padStart(2, '0')}`;
                cadetsList.push({
                  id: cid,
                  name: `CADET ${cid}`,
                  rank: 'Cadet',
                  battalion: bn,
                  company: co,
                  platoon: pl,
                  designation: i === 1 ? 'Platoon Guide' : i === 2 ? 'Squad Leader' : 'N/A',
                  type: 'Basic Cadet'
                });
              }
            });
          });
        });

        localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(cadetsList));
      }

      const saturdayDates = [
        { dateStr: '2026-08-08', sessionName: 'Saturday Field Drill & Muster (Aug 08, 2026)', dutyOfficer: 'C/CPT ABAMO, CHRISTIAN B.', offset: 17 },
        { dateStr: '2026-08-15', sessionName: 'Saturday Tactical Training & Ceremonial Parade (Aug 15, 2026)', dutyOfficer: 'C/MAJ CASTILLO, ELENA J.', offset: 34 }
      ];

      const newLogs = [];
      saturdayDates.forEach(cfg => {
        const { dateStr, sessionName, dutyOfficer, offset } = cfg;

        cadetsList.forEach((cadet, idx) => {
          const cid = cadet.id || cadet.cadetId;
          if (!cid) return;
          const h = (idx * 37 + offset + (parseInt(cid.replace(/\D/g, ''), 10) || idx)) % 100;

          if (h < 75) {
            // 75% Present (On-Time before 07:30 cutoff)
            const inMin = 30 + (h % 55);
            const inHour = inMin >= 60 ? 7 : 6;
            const inMinute = inMin >= 60 ? inMin - 60 : inMin;
            const inSec = (h * 7) % 60;
            const tIn = `${dateStr}T${String(inHour).padStart(2, '0')}:${String(inMinute).padStart(2, '0')}:${String(inSec).padStart(2, '0')}`;
            const tOut = `${dateStr}T11:45:${String((h * 13) % 60).padStart(2, '0')}`;

            newLogs.push({
              cadetId: cid,
              name: cadet.name,
              rank: cadet.rank || 'Cadet',
              battalion: cadet.battalion || '1st Battalion',
              company: cadet.company || 'Alpha Company',
              platoon: cadet.platoon || '1st Platoon',
              designation: cadet.designation || 'N/A',
              date: dateStr,
              timeIn: tIn,
              timeOut: tOut,
              timestamp: tIn,
              scanMode: 'Time-Out',
              timeInStatus: 'PRESENT',
              timeOutStatus: 'PRESENT',
              status: 'PRESENT',
              finalDailyStatus: 'PRESENT',
              dutyOfficer: dutyOfficer,
              sessionName: sessionName,
              receivedAt: `${dateStr}T12:00:00`
            });
          } else if (h < 90) {
            // 15% Late (Arrival between 07:31 and 07:54 AM)
            const lateMin = 31 + (h % 24);
            const tIn = `${dateStr}T07:${String(lateMin).padStart(2, '0')}:${String((h * 11) % 60).padStart(2, '0')}`;
            const tOut = `${dateStr}T11:55:${String((h * 17) % 60).padStart(2, '0')}`;

            newLogs.push({
              cadetId: cid,
              name: cadet.name,
              rank: cadet.rank || 'Cadet',
              battalion: cadet.battalion || '1st Battalion',
              company: cadet.company || 'Alpha Company',
              platoon: cadet.platoon || '1st Platoon',
              designation: cadet.designation || 'N/A',
              date: dateStr,
              timeIn: tIn,
              timeOut: tOut,
              timestamp: tIn,
              scanMode: 'Time-Out',
              timeInStatus: 'LATE',
              timeOutStatus: 'PRESENT',
              status: 'LATE',
              finalDailyStatus: 'LATE',
              dutyOfficer: dutyOfficer,
              sessionName: sessionName,
              receivedAt: `${dateStr}T12:00:00`
            });
          }
          // 10% Absent: no row generated
        });
      });

      // Save locally to localStorage
      localStorage.setItem('csu_rotc_master_attendance', JSON.stringify(newLogs));
      window.dispatchEvent(new Event('local-attendance-update'));

      // Try bulk upsert to Supabase
      await bulkUpsertAttendanceToSupabase(newLogs).catch(err => console.warn('Supabase sync note:', err));

      if (onRefresh) onRefresh();
      setSelectedDate('2026-08-15');

      setExportNotice({
        type: 'success',
        text: `Loaded ${newLogs.length} attendance logs for Aug 08 & Aug 15 (75% Present, 15% Late, 10% Absent)!`
      });
    } catch (e) {
      console.error('Error seeding Saturday formations:', e);
      setExportNotice({
        type: 'error',
        text: 'Failed to load Saturday formation data: ' + e.message
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // Turnout percentage for the date
  const turnoutRate = summary.totalStrength > 0
    ? Math.round(((summary.presentCompleteCount + summary.lateCompleteCount) / summary.totalStrength) * 100)
    : 0;

  const hasActiveFilters = searchQuery || statusFilter !== 'ALL' || battalionFilter !== 'ALL' || companyFilter !== 'ALL' || platoonFilter !== 'ALL';

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

  const latestRecordedDate = historicalDates[0]?.dateKey;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Real-time Toast Notice */}
      {exportNotice && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: exportNotice.type === 'warning' ? '#fef3c7' : exportNotice.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: exportNotice.type === 'warning' ? '#92400e' : exportNotice.type === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${exportNotice.type === 'warning' ? '#fde68a' : exportNotice.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
          padding: '0.85rem 1.4rem',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          fontSize: '0.88rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {exportNotice.type === 'warning' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{exportNotice.text}</span>
        </div>
      )}
      
      {/* ========================================================================= */}
      {/* Streamlined Header Banner & Restricted Formation Date Picker               */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-sm)',
          padding: '1.25rem 1.5rem',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Title and Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'var(--rotc-green-dark)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Archive size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', letterSpacing: '0.5px' }}>
                ATTENDANCE HISTORY & PAST FORMATIONS
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Review archived muster logs and inspect recorded training formations
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onRefresh}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '7px', padding: '0.45rem 0.8rem' }}
              title="Refresh attendance records"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsLetterheadModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '7px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: '#ffffff',
                color: 'var(--text-dark)',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              title="Configure official headquarters, letterhead text, and logos for Excel reports"
            >
              <Settings size={14} color="#64748b" />
              <span>⚙️ Header & Footer Settings</span>
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleExportHistoricalExcel}
              disabled={isExporting || !isRecordedDate || reconciledRoster.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '7px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                border: '1px solid #b45309',
                boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)',
                cursor: (!isRecordedDate || reconciledRoster.length === 0 || isExporting) ? 'not-allowed' : 'pointer',
                opacity: (!isRecordedDate || reconciledRoster.length === 0) ? 0.6 : 1,
                transition: 'all 0.15s ease'
              }}
              title={!isRecordedDate ? "No formation recorded on this date" : "Save attendance records to Excel (.xlsx)"}
            >
              <FileSpreadsheet size={15} />
              <span>{isExporting ? 'Generating (.xlsx)...' : '📊 Save to Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Restricted Date Selection Bar */}
        <div
          style={{
            marginTop: '1.1rem',
            paddingTop: '0.9rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--rotc-green-dark)', letterSpacing: '0.5px' }}>
              RECORDED FORMATION:
            </span>

            {/* Interactive Calendar Popover Trigger Button */}
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
                  border: isCalendarOpen ? '1.5px solid var(--rotc-green-dark)' : '1px solid #cbd5e1',
                  background: isCalendarOpen ? '#ecfdf5' : '#ffffff',
                  color: 'var(--text-dark)',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                title="Open interactive formation calendar"
              >
                <CalendarDays size={15} color="var(--rotc-green-dark)" />
                <span>Calendar Selector</span>
                <ChevronDown size={13} style={{ transform: isCalendarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Custom Restricted Calendar Dropdown (Unrecorded dates disabled & grayed out) */}
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
                        color: 'var(--text-dark)'
                      }}
                      title="Previous Month"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--rotc-green-dark)' }}>
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
                        color: 'var(--text-dark)'
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

                  {/* Days Grid: ONLY recorded dates are selectable; non-formation dates disabled/grayed out */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {/* Empty padding slots before day 1 */}
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                      <div key={`empty-${idx}`} style={{ height: '32px' }} />
                    ))}

                    {/* Month Days */}
                    {Array.from({ length: daysInCalMonth }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const dayKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isRecorded = historicalDatesMap.has(dayKey);
                      const isSelected = selectedDate === dayKey;
                      const isToday = dayKey === todayKey;
                      const dateMeta = historicalDatesMap.get(dayKey);

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
                              border: isSelected ? '2px solid var(--rotc-green-dark)' : '1px solid #10b981',
                              background: isSelected ? 'var(--rotc-green-dark)' : '#ecfdf5',
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
                            title={`Recorded Formation: ${dateMeta?.scansCount} scans`}
                          >
                            <span>{dayNum}</span>
                            <span
                              style={{
                                width: '4px',
                                height: '4px',
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

                  {/* Calendar Legend & Quick Return to Latest */}
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9', fontSize: '0.72rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
                        <span style={{ color: '#065f46', fontWeight: 600 }}>Formation Recorded</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} />
                        <span>No Formation</span>
                      </div>
                    </div>

                    {latestRecordedDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(latestRecordedDate);
                          setIsCalendarOpen(false);
                        }}
                        style={{
                          width: '100%',
                          marginTop: '6px',
                          padding: '4px 8px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '6px',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Jump to Most Recent ({formatHumanDate(latestRecordedDate)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Date Header Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--rotc-green-dark)' }}>
            <CalendarCheck size={16} />
            <span>{formatHumanDate(selectedDate)}</span>
            {isRecordedDate && (
              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                {selectedDateMeta.scansCount} SCANS
              </span>
            )}
            {isTodaySelected && (
              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                LIVE TODAY
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Today Live Formation Active In-Progress Notice */}
      {isTodaySelected && isRecordedDate && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.84rem',
            fontWeight: 600,
            background: '#f0fdf4',
            color: '#065f46',
            border: '1.5px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#059669" />
            <div>
              <strong style={{ color: 'var(--rotc-green-dark)' }}>Today's Formation ({formatHumanDate(selectedDate)}) is Active</strong>
              <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '1px' }}>
                Active scans and incoming smartphone batches for today are currently being processed in real-time. Completed past formations are archived below.
              </div>
            </div>
          </div>
          {onNavigateToSyncLogs && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onNavigateToSyncLogs}
              style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '6px', fontWeight: 700 }}
            >
              Open Live Master Records
            </button>
          )}
        </div>
      )}

      {exportNotice && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: exportNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: exportNotice.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${exportNotice.type === 'success' ? '#a7f3d0' : '#fecaca'}`
          }}
        >
          {exportNotice.text}
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMPTY STATE GUARD: Rendered when user selects an unrecorded date          */}
      {/* ========================================================================= */}
      {!isRecordedDate ? (
        <div
          className="card"
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            background: '#ffffff',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}
          >
            <AlertCircle size={32} />
          </div>

          <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '1.3rem', fontWeight: 800 }}>
            No Formation Recorded for {formatHumanDate(selectedDate)}
          </h3>

          <p style={{ margin: '0 auto 1.5rem', maxWidth: '520px', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
            No muster parade, drill session, or attendance logs exist in the system for this date.
            Cadet absentee records are <strong>not generated</strong> for unrecorded non-formation dates.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#166534',
              fontWeight: 600,
              marginBottom: '1.75rem'
            }}
          >
            <Shield size={16} />
            <span>Roster Guard Active: 1,194 cadets protected from false absentee marking.</span>
          </div>

          <div>
            {/* 1-Click Action to load Saturday August 8 & August 15 formations */}
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleQuickSeedSaturdays}
                disabled={isSeeding}
                className="btn btn-primary"
                style={{
                  padding: '0.65rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(6, 78, 46, 0.25)'
                }}
              >
                <Sparkles size={18} /> {isSeeding ? 'Loading Formation Data...' : 'Load Saturday Formations (Aug 08 & Aug 15, 2026)'}
              </button>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Generates 75% Present, 15% Late, and 10% Absent records across 1,194 cadets.
              </div>
            </div>

            {latestRecordedDate && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedDate(latestRecordedDate)}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.5rem 1.2rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CalendarCheck size={15} /> Go to Most Recent Formation ({formatHumanDate(latestRecordedDate)})
                </button>
              </div>
            )}

            {historicalDates.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  Or Choose from Recorded Formation Dates:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {historicalDates.map(d => (
                    <button
                      key={d.dateKey}
                      type="button"
                      onClick={() => setSelectedDate(d.dateKey)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        borderColor: '#a7f3d0',
                        color: '#065f46',
                        background: '#f0fdf4'
                      }}
                    >
                      📅 {formatHumanDate(d.dateKey)} ({d.scansCount} scans)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 5 Simplified Modern Stat Summary Cards (Clickable to Filter Table)         */}
          {/* ========================================================================= */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
            
            {/* Stat Card 1: TOTAL ROSTER CADETS */}
            <div
              className="card"
              onClick={() => setStatusFilter('ALL')}
              style={{
                border: '1px solid #e2e8f0',
                borderTop: '3px solid var(--rotc-green-dark)',
                borderRadius: '10px',
                padding: '1rem',
                cursor: 'pointer',
                background: statusFilter === 'ALL' ? '#f0fdf4' : '#ffffff',
                boxShadow: statusFilter === 'ALL' ? '0 0 0 2px var(--rotc-green-dark)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
              title="Click to view all cadets on this date"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cadets</span>
                <Users size={16} color="var(--rotc-green-dark)" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {summary.totalStrength}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                {turnoutRate}% Turnout Rate
              </div>
            </div>

            {/* Stat Card 2: PRESENT */}
            <div
              className="card"
              onClick={() => setStatusFilter('PRESENT')}
              style={{
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #059669',
                borderRadius: '10px',
                padding: '1rem',
                cursor: 'pointer',
                background: statusFilter === 'PRESENT' ? '#ecfdf5' : '#ffffff',
                boxShadow: statusFilter === 'PRESENT' ? '0 0 0 2px #059669' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
              title="Click to filter Present cadets"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>Present</span>
                <CheckCircle2 size={16} color="#059669" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#065f46' }}>
                {summary.presentCompleteCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                On-time arrival
              </div>
            </div>

            {/* Stat Card 3: LATE */}
            <div
              className="card"
              onClick={() => setStatusFilter('LATE')}
              style={{
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #d97706',
                borderRadius: '10px',
                padding: '1rem',
                cursor: 'pointer',
                background: statusFilter === 'LATE' ? '#fffbeb' : '#ffffff',
                boxShadow: statusFilter === 'LATE' ? '0 0 0 2px #d97706' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
              title="Click to filter Late cadets"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Late</span>
                <Clock size={16} color="#d97706" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#92400e' }}>
                {summary.lateCompleteCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                After {formationCutoff}
              </div>
            </div>

            {/* Stat Card 4: NO TIME-OUT */}
            <div
              className="card"
              onClick={() => setStatusFilter('INCOMPLETE')}
              style={{
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #ea580c',
                borderRadius: '10px',
                padding: '1rem',
                cursor: 'pointer',
                background: statusFilter === 'INCOMPLETE' ? '#fff7ed' : '#ffffff',
                boxShadow: statusFilter === 'INCOMPLETE' ? '0 0 0 2px #ea580c' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
              title="Click to filter cadets missing Time-Out"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>No Time-Out</span>
                <Activity size={16} color="#ea580c" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#9a3412' }}>
                {summary.incompleteCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Missing afternoon scan
              </div>
            </div>

            {/* Stat Card 5: ABSENT (1-Click Filter) */}
            <div
              className="card"
              onClick={() => setStatusFilter('ABSENT')}
              style={{
                border: '1px solid #e2e8f0',
                borderTop: '3px solid #dc2626',
                borderRadius: '10px',
                padding: '1rem',
                cursor: 'pointer',
                background: statusFilter === 'ABSENT' ? '#fef2f2' : '#ffffff',
                boxShadow: statusFilter === 'ABSENT' ? '0 0 0 2px #dc2626' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
              title="Click to view all Absent cadets"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>Absent Cadets</span>
                <UserX size={16} color="#dc2626" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#991b1b' }}>
                {summary.absentCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '2px', fontWeight: 700 }}>
                {statusFilter === 'ABSENT' ? '● Active Filter' : 'Click to filter absentees'}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Combined Table & Filter Bar                                                */}
          {/* ========================================================================= */}
          <div className="card" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', padding: 0 }}>
            
            {/* Unified Search & Multi-Filter Toolbar */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              {/* Left Side: Search Box */}
              <div style={{ position: 'relative', minWidth: '220px', maxWidth: '300px', flex: 1 }}>
                <Search
                  size={14}
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
                    padding: '0.4rem 1.8rem 0.4rem 1.9rem',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: 'var(--text-dark)',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '2px'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Center: Unit Echelon Dropdowns */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <select
                  value={battalionFilter}
                  onChange={(e) => {
                    setBattalionFilter(e.target.value);
                    setCompanyFilter('ALL');
                    setPlatoonFilter('ALL');
                  }}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }}
                >
                  <option value="ALL">All Battalions</option>
                  <option value="1st Battalion">1st Battalion</option>
                  <option value="2nd Battalion">2nd Battalion</option>
                  <option value="CADET OFFICERS">Cadet Officers</option>
                </select>

                <select
                  value={companyFilter}
                  onChange={(e) => {
                    setCompanyFilter(e.target.value);
                    setPlatoonFilter('ALL');
                  }}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }}
                >
                  <option value="ALL">All Companies</option>
                  <option value="Alpha">Alpha Company</option>
                  <option value="Bravo">Bravo Company</option>
                  <option value="Charlie">Charlie Company</option>
                  <option value="Delta">Delta Company</option>
                </select>

                <select
                  value={platoonFilter}
                  onChange={(e) => setPlatoonFilter(e.target.value)}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }}
                >
                  <option value="ALL">All Platoons</option>
                  <option value="1st Platoon">1st Platoon</option>
                  <option value="2nd Platoon">2nd Platoon</option>
                  <option value="3rd Platoon">3rd Platoon</option>
                  <option value="4th Platoon">4th Platoon</option>
                </select>
              </div>

              {/* Right Side: Status Filter Pill Tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: statusFilter === 'ALL' ? '1px solid var(--rotc-green-dark)' : '1px solid #cbd5e1',
                    background: statusFilter === 'ALL' ? 'var(--rotc-green-dark)' : '#ffffff',
                    color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-dark)'
                  }}
                >
                  All
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('PRESENT')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: statusFilter === 'PRESENT' ? '1px solid #059669' : '1px solid #cbd5e1',
                    background: statusFilter === 'PRESENT' ? '#059669' : '#ffffff',
                    color: statusFilter === 'PRESENT' ? '#ffffff' : '#065f46'
                  }}
                >
                  Present
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('LATE')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: statusFilter === 'LATE' ? '1px solid #d97706' : '1px solid #cbd5e1',
                    background: statusFilter === 'LATE' ? '#d97706' : '#ffffff',
                    color: statusFilter === 'LATE' ? '#ffffff' : '#92400e'
                  }}
                >
                  Late
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('INCOMPLETE')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: statusFilter === 'INCOMPLETE' ? '1px solid #ea580c' : '1px solid #cbd5e1',
                    background: statusFilter === 'INCOMPLETE' ? '#ea580c' : '#ffffff',
                    color: statusFilter === 'INCOMPLETE' ? '#ffffff' : '#9a3412'
                  }}
                >
                  No Time-Out
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('ABSENT')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: statusFilter === 'ABSENT' ? '1px solid #dc2626' : '1px solid #fca5a5',
                    background: statusFilter === 'ABSENT' ? '#dc2626' : '#fee2e2',
                    color: statusFilter === 'ABSENT' ? '#ffffff' : '#991b1b'
                  }}
                >
                  Absent ({summary.absentCount})
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('ALL');
                      setBattalionFilter('ALL');
                      setCompanyFilter('ALL');
                      setPlatoonFilter('ALL');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#dc2626', borderColor: '#fca5a5', borderRadius: '6px' }}
                    title="Reset all search & echelon filters"
                  >
                    <RotateCcw size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Records Table */}
            {filteredCadets.length === 0 ? (
              <div style={{ textTransform: 'uppercase', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No cadet attendance records matching current filters for {formatHumanDate(selectedDate)}.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Cadet ID</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Cadet Name</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Battalion</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Company</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Platoon</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Time-In</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Time-Out</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Daily Status</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', textAlign: 'left' }}>Duty Officer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCadets.map((cadet, idx) => {
                      const timeInDisplay = cadet.timeIn
                        ? new Date(cadet.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null;
                      const timeOutDisplay = cadet.timeOut
                        ? new Date(cadet.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null;

                      const status = cadet.finalDailyStatus;

                      return (
                        <tr
                          key={cadet.cadetId || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {idx + 1}
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--rotc-green-dark)', fontSize: '0.85rem' }}>
                            {cadet.cadetId}
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                            {cadet.name}
                          </td>

                          {/* Soft Pill Tag: Battalion */}
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
                              {cadet.battalion}
                            </span>
                          </td>

                          {/* Soft Pill Tag: Company */}
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                              {cadet.company}
                            </span>
                          </td>

                          {/* Soft Pill Tag: Platoon */}
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                              {cadet.platoon}
                            </span>
                          </td>

                          {/* Time-In */}
                          <td style={{ padding: '12px 16px' }}>
                            {timeInDisplay ? (
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: cadet.isLate ? '#b45309' : '#065f46' }}>
                                {timeInDisplay}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>

                          {/* Time-Out */}
                          <td style={{ padding: '12px 16px' }}>
                            {timeOutDisplay ? (
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065f46' }}>
                                {timeOutDisplay}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {cadet.hasTimeIn ? (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5' }}>
                                    NO TIME-OUT
                                  </span>
                                ) : '—'}
                              </span>
                            )}
                          </td>

                          {/* Daily Status */}
                          <td style={{ padding: '12px 16px' }}>
                            {(status === 'PRESENT' || status === 'PRESENT (Complete)') && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={11} /> PRESENT
                              </span>
                            )}
                            {(status === 'LATE' || status === 'LATE (Complete)') && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Clock size={11} /> LATE
                              </span>
                            )}
                            {(status === 'NO TIME-OUT' || status === 'INCOMPLETE (No Time-Out)') && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Activity size={11} /> NO TIME-OUT
                              </span>
                            )}
                            {(status === 'LATE / NO TIME-OUT' || status === 'INCOMPLETE (Late / No Time-Out)') && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Activity size={11} /> LATE / NO TIME-OUT
                              </span>
                            )}
                            {status === 'ABSENT' && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <UserX size={11} /> ABSENT
                              </span>
                            )}
                            {!['PRESENT', 'PRESENT (Complete)', 'LATE', 'LATE (Complete)', 'NO TIME-OUT', 'INCOMPLETE (No Time-Out)', 'LATE / NO TIME-OUT', 'INCOMPLETE (Late / No Time-Out)', 'ABSENT'].includes(status) && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                                {status}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {cadet.dutyOfficer || (selectedDateMeta.dutyOfficers.size > 0 ? Array.from(selectedDateMeta.dutyOfficers).join(', ') : 'Duty Officer')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Official Excel Header & Footer Configuration Modal */}
      <LetterheadSettingsModal
        isOpen={isLetterheadModalOpen}
        onClose={() => setIsLetterheadModalOpen(false)}
        onSaved={() => {
          setExportNotice({
            type: 'success',
            text: 'Official Excel letterhead settings updated successfully!'
          });
          setTimeout(() => setExportNotice(null), 3000);
        }}
      />
    </div>
  );
}
