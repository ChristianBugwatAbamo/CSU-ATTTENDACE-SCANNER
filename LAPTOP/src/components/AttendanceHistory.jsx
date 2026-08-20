import React, { useState, useMemo } from 'react';
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
  Printer,
  ChevronLeft,
  ChevronRight,
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
  X
} from 'lucide-react';
import {
  reconcileRosterAttendance,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from '../utils/attendanceStatus';
import { exportAttendanceToExcel } from '../utils/excelExport';

/**
 * Format helper for ISO date string YYYY-MM-DD
 */
function toDateKey(dateInput) {
  if (!dateInput) return '';
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

export default function AttendanceHistory({
  cadets = [],
  attendanceLogs = [],
  onRefresh,
  onNavigateToSyncLogs
}) {
  const formationCutoff = getActiveFormationCutoff();
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // 1. Discover all unique dates present in attendanceLogs
  const historicalDates = useMemo(() => {
    const datesMap = new Map();

    attendanceLogs.forEach((log) => {
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

    // Ensure default recorded formation dates are present if logs are populated
    const defaultDates = ['2026-08-19', '2026-08-18', '2026-08-17', '2026-08-16'];
    defaultDates.forEach(dKey => {
      if (!datesMap.has(dKey)) {
        const count = attendanceLogs.filter(l => (l.date === dKey || (l.timestamp && l.timestamp.startsWith(dKey)))).length;
        if (count > 0) {
          datesMap.set(dKey, {
            dateKey: dKey,
            scansCount: count,
            sessionNames: new Set([`Formation on ${dKey}`]),
            dutyOfficers: new Set(),
            sampleDate: new Date(`${dKey}T12:00:00`)
          });
        }
      }
    });

    // Sort descending (latest dates first)
    return Array.from(datesMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [attendanceLogs]);

  // Selected Historical Date state (defaults to latest recorded archived formation or today)
  const [selectedDate, setSelectedDate] = useState(() => {
    const firstArchivedWithScans = historicalDates.find(d => d.scansCount > 0 && d.dateKey !== toDateKey(new Date()));
    if (firstArchivedWithScans) return firstArchivedWithScans.dateKey;
    const firstWithScans = historicalDates.find(d => d.scansCount > 0);
    return firstWithScans ? firstWithScans.dateKey : toDateKey(new Date());
  });

  const isTodaySelected = selectedDate === todayKey;

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

  // 2. Reconcile complete cadet roster for the selected historical date
  const { reconciledRoster, summary } = useMemo(() => {
    return reconcileRosterAttendance(
      cadets,
      attendanceLogs,
      selectedDate ? new Date(`${selectedDate}T12:00:00`) : null,
      formationCutoff
    );
  }, [cadets, attendanceLogs, selectedDate, formationCutoff]);

  // Selected date session metadata
  const selectedDateMeta = useMemo(() => {
    return historicalDates.find(d => d.dateKey === selectedDate) || {
      dateKey: selectedDate,
      scansCount: 0,
      sessionNames: new Set(),
      dutyOfficers: new Set()
    };
  }, [historicalDates, selectedDate]);

  // 3. Filtered Cadets list for table display
  const filteredCadets = useMemo(() => {
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
  }, [reconciledRoster, statusFilter, battalionFilter, companyFilter, platoonFilter, searchQuery]);

  // Navigate dates step-by-step
  const handleStepDate = (direction) => {
    const currentIndex = historicalDates.findIndex(d => d.dateKey === selectedDate);
    if (currentIndex === -1) {
      if (historicalDates.length > 0) setSelectedDate(historicalDates[0].dateKey);
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

  // Turnout percentage for the date
  const turnoutRate = summary.totalStrength > 0
    ? Math.round(((summary.presentCompleteCount + summary.lateCompleteCount) / summary.totalStrength) * 100)
    : 0;

  const hasActiveFilters = searchQuery || statusFilter !== 'ALL' || battalionFilter !== 'ALL' || companyFilter !== 'ALL' || platoonFilter !== 'ALL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ========================================================================= */}
      {/* Streamlined Header Banner & Single Date Selection Control                  */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-sm)',
          padding: '1.25rem 1.5rem'
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
                Review archived muster logs, track attendance trends, and inspect date-specific absences
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onRefresh}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
              title="Refresh attendance records"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportHistoricalExcel}
              disabled={isExporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
              title="Export historical attendance records to Excel"
            >
              <Download size={13} /> {isExporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>
        </div>

        {/* Single Streamlined Date Selector Control */}
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--rotc-green-dark)', letterSpacing: '0.5px' }}>
              FORMATION DATE:
            </span>

            {/* Quick Prev / Older Button */}
            <button
              type="button"
              onClick={() => handleStepDate('prev')}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
              title="Previous recorded formation date"
            >
              <ChevronLeft size={13} /> Older
            </button>

            {/* Native Date Picker */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1.5px solid var(--rotc-green-dark)',
                background: '#ffffff',
                color: 'var(--text-dark)',
                cursor: 'pointer',
                outline: 'none'
              }}
            />

            {/* Quick Next / Newer Button */}
            <button
              type="button"
              onClick={() => handleStepDate('next')}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
              title="Next recorded formation date"
            >
              Newer <ChevronRight size={13} />
            </button>

            {/* Quick Dropdown of Available Formation Dates */}
            {historicalDates.length > 0 && (
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: 'var(--text-dark)',
                  cursor: 'pointer',
                  outline: 'none',
                  maxWidth: '220px'
                }}
              >
                {historicalDates.map((item) => (
                  <option key={item.dateKey} value={item.dateKey}>
                    {formatHumanDate(item.dateKey)} ({item.scansCount} Scans)
                  </option>
                ))}
              </select>
            )}

            {/* Jump to Today Button */}
            {selectedDate !== toDateKey(new Date()) && (
              <button
                type="button"
                onClick={() => setSelectedDate(toDateKey(new Date()))}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--rotc-green-dark)',
                  borderColor: 'var(--rotc-green-dark)',
                  borderRadius: '6px'
                }}
                title="Jump to today's date"
              >
                Today
              </button>
            )}
          </div>

          {/* Clean Active Date Header Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--rotc-green-dark)' }}>
            <Calendar size={15} />
            <span>{formatHumanDate(selectedDate)}</span>
            {isTodaySelected && (
              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                LIVE TODAY
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Today Live Formation Active In-Progress Notice */}
      {isTodaySelected && (
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
    </div>
  );
}
