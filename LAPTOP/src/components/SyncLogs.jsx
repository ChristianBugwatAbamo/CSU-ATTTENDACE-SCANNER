import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Trash2,
  Users,
  Shield,
  Award,
  Layers,
  ChevronRight,
  AlertTriangle,
  X,
  RotateCcw,
  Settings,
  MoreVertical,
  Activity,
  Archive,
  Calendar
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import LetterheadSettingsModal from './LetterheadSettingsModal';
import {
  getAttendanceStatus,
  getScannedUnitEchelon,
  evaluateSingleScan,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from '../utils/attendanceStatus';
import { exportAttendanceToExcel } from '../utils/excelExport';
import { useAttendanceData } from '../hooks/useAttendanceData';

export default function SyncLogs({ attendanceLogs: propsLogs, onRefresh, onClearLogs, onOpenScanner }) {
  const { records: hookLogs, activeCutoff } = useAttendanceData();
  const attendanceLogs = hookLogs && hookLogs.length > 0 ? hookLogs : (propsLogs || []);

  const [dateScope, setDateScope] = useState('TODAY'); // 'TODAY' | 'ALL'
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [excelReports, setExcelReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cascading Dropdown Filter States
  const [battalionFilter, setBattalionFilter] = useState('ALL'); // 'ALL' | '1st Battalion' | '2nd Battalion' | 'CADET OFFICERS'
  const [companyFilter, setCompanyFilter] = useState('ALL');     // 'ALL' | 'Alpha' | 'Bravo' | 'Charlie' | 'Delta'
  const [platoonFilter, setPlatoonFilter] = useState('ALL');     // 'ALL' | '1st Platoon' | '2nd Platoon' | '3rd Platoon' | '4th Platoon'

  // Header Table Settings Menu State
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const tableMenuRef = useRef(null);

  // Clear Master Log Options State
  const [clearModalMode, setClearModalMode] = useState(null); // null | 'ALL' | 'FILTERED' | 'PLATOON' | 'CADET'
  const [clearPlatoonTarget, setClearPlatoonTarget] = useState({
    battalion: '1st Battalion',
    company: 'Alpha Company',
    platoon: '1st Platoon'
  });
  const [clearCadetInput, setClearCadetInput] = useState('');
  const [statusNotice, setStatusNotice] = useState(null);

  const currentCutoff = activeCutoff || '07:30';

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setExcelReports(data);
      }
    } catch (err) {
      console.error("Failed to fetch reports list:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(event.target)) {
        setIsTableMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When Battalion dropdown changes, reset child company/platoon
  const handleBattalionChange = (bn) => {
    setBattalionFilter(bn);
    setCompanyFilter('ALL');
    setPlatoonFilter('ALL');
  };

  // When Company dropdown changes, reset child platoon
  const handleCompanyChange = (co) => {
    setCompanyFilter(co);
    setPlatoonFilter('ALL');
  };

  // Export to Excel with Multi-Sheet [Battalion] - [Company] - [Platoon] layout
  const handleSaveToExcel = async () => {
    if (attendanceLogs.length === 0) {
      setStatusNotice({ type: 'warning', text: 'No attendance records available to export.' });
      setTimeout(() => setStatusNotice(null), 3500);
      return;
    }

    setIsExportingExcel(true);
    try {
      const result = await exportAttendanceToExcel(attendanceLogs, 'Master Field Drill Session');
      setStatusNotice({
        type: 'success',
        text: `Excel Report generated and downloaded successfully! (${result.count} records organized by Battalion - Company - Platoon)`
      });
      fetchReports();
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      setStatusNotice({ type: 'error', text: 'Failed to generate Excel file.' });
    } finally {
      setIsExportingExcel(false);
      setTimeout(() => setStatusNotice(null), 4500);
    }
  };

  // Filter records based on date scope, cascading dropdowns and search query
  const filteredLogs = attendanceLogs.filter(log => {
    // 1. Date Scope filter (Today vs All)
    if (dateScope === 'TODAY') {
      const logDate = log.date || (log.timestamp ? log.timestamp.slice(0, 10) : '');
      if (logDate !== todayStr) return false;
    }

    const echelon = getScannedUnitEchelon(log);
    const matchesSearch = (log.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.cadetId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const isOfficer = log.battalion === 'CADET OFFICERS' ||
      log.type === 'Cadet Officer' ||
      (log.rank && (log.rank.includes('1CL') || log.rank.includes('2CL') || log.rank.includes('3CL') || log.rank.includes('4CL') || log.rank.includes('ASPIRANT')));

    let matchesBn = true;
    if (battalionFilter === 'CADET OFFICERS') {
      matchesBn = isOfficer;
    } else if (battalionFilter !== 'ALL') {
      matchesBn = !isOfficer && (normalizeBattalion(echelon.battalion || log.battalion) === normalizeBattalion(battalionFilter));
    }

    let matchesCo = true;
    if (companyFilter !== 'ALL') {
      matchesCo = normalizeCompany(echelon.company || log.company) === normalizeCompany(companyFilter);
    }

    let matchesPl = true;
    if (platoonFilter !== 'ALL') {
      matchesPl = normalizePlatoon(echelon.platoon || log.platoon) === normalizePlatoon(platoonFilter);
    }

    return matchesSearch && matchesBn && matchesCo && matchesPl;
  });

  // Perform Clears (All / Filtered View / Specific Platoon / Specific Cadet)
  const handleExecuteClear = async () => {
    if (!clearModalMode) return;

    if (onClearLogs) {
      if (clearModalMode === 'ALL') {
        await onClearLogs('ALL');
        setStatusNotice({ type: 'success', text: 'All Master Attendance records cleared.' });
      } else if (clearModalMode === 'FILTERED') {
        const cids = filteredLogs.map(l => l.cadetId || l.id);
        await onClearLogs('FILTERED', cids);
        setStatusNotice({
          type: 'success',
          text: `Cleared ${cids.length} currently filtered attendance records.`
        });
      } else if (clearModalMode === 'PLATOON') {
        await onClearLogs('PLATOON', clearPlatoonTarget);
        setStatusNotice({
          type: 'success',
          text: `Records cleared for ${clearPlatoonTarget.battalion} • ${clearPlatoonTarget.company} • ${clearPlatoonTarget.platoon}.`
        });
      } else if (clearModalMode === 'CADET') {
        if (!clearCadetInput.trim()) return;
        await onClearLogs('CADET', clearCadetInput.trim());
        setStatusNotice({
          type: 'success',
          text: `Attendance record cleared for Cadet ${clearCadetInput.trim().toUpperCase()}.`
        });
      }
    }

    setClearModalMode(null);
    setClearCadetInput('');
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const presentCount = filteredLogs.filter(l => {
    const tIn = l.timeIn || (l.scanMode !== 'Time-Out' ? l.timestamp : null);
    return tIn && evaluateSingleScan({ timestamp: tIn, scanMode: 'Time-In' }, currentCutoff) === 'PRESENT';
  }).length;

  const lateCount = filteredLogs.filter(l => {
    const tIn = l.timeIn || (l.scanMode !== 'Time-Out' ? l.timestamp : null);
    return tIn && evaluateSingleScan({ timestamp: tIn, scanMode: 'Time-In' }, currentCutoff) === 'LATE';
  }).length;

  const isAnyFilterActive = battalionFilter !== 'ALL' || companyFilter !== 'ALL' || platoonFilter !== 'ALL' || searchTerm.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Real-time Toast Notice */}
      {statusNotice && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: statusNotice.type === 'warning' ? '#fef3c7' : statusNotice.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: statusNotice.type === 'warning' ? '#92400e' : statusNotice.type === 'error' ? '#991b1b' : '#065f46',
          border: `1px solid ${statusNotice.type === 'warning' ? '#fde68a' : statusNotice.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
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
          {statusNotice.type === 'warning' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Header Banner & Primary Action Buttons */}
      <div className="card" style={{ borderTop: '4px solid var(--rotc-green-dark)' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <FileSpreadsheet size={22} style={{ color: 'var(--rotc-green-dark)' }} />
              LOCAL EXCEL REPORTS & MASTER ATTENDANCE
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
              Multi-sheet Excel export automatically formats tabs by <code>[Battalion] - [Company] - [Platoon]</code> with real-time status evaluations.
            </p>
          </div>

          {/* Action Buttons: Save to Excel & Header/Footer Settings */}
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsLetterheadModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                padding: '0.5rem 0.9rem'
              }}
              title="Edit Official Letterhead & Signatories (Motto, Headquarters, Unit Name, Location)"
            >
              <Settings size={15} /> Header & Footer Settings
            </button>

            <button
              className="btn btn-gold btn-sm"
              onClick={handleSaveToExcel}
              disabled={isExportingExcel || attendanceLogs.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 800,
                padding: '0.5rem 1.15rem',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.2)'
              }}
            >
              <FileSpreadsheet size={16} />
              {isExportingExcel ? 'Generating Multi-Sheet Excel...' : 'Save to Excel (.xlsx)'}
            </button>
          </div>
        </div>
      </div>

      {/* Master Records Card with Header Right Dropdowns and Dedicated Search Bar */}
      <div className="card">
        {/* Header Row: Title & Counters (Left) + Cascading Dropdown Filters (Right Corner) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          {/* Header Row: Title, Scope Switcher & Live Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--rotc-green-dark)', margin: 0 }}>
              Master Records ({filteredLogs.length} Cadets Displayed)
            </h3>

            {/* Date Scope Toggle Pill */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setDateScope('TODAY')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  background: dateScope === 'TODAY' ? 'var(--rotc-green-dark)' : 'transparent',
                  color: dateScope === 'TODAY' ? '#ffffff' : 'var(--text-dark)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Activity size={12} />
                <span>Today's Live ({todayStr})</span>
              </button>
              <button
                type="button"
                onClick={() => setDateScope('ALL')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  background: dateScope === 'ALL' ? 'var(--rotc-green-dark)' : 'transparent',
                  color: dateScope === 'ALL' ? '#ffffff' : 'var(--text-dark)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Archive size={12} />
                <span>All Logs ({attendanceLogs.length})</span>
              </button>
            </div>

            {filteredLogs.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>
                <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>
                  ✓ PRESENT: {presentCount}
                </span>
                {lateCount > 0 && (
                  <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                    ⏱️ LATE: {lateCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Header Right Corner: Cascading Dropdowns for Battalion, Company, and Platoon */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />

            {/* 1. Battalion Dropdown */}
            <select
              className="form-control form-control-sm"
              value={battalionFilter}
              onChange={(e) => handleBattalionChange(e.target.value)}
              style={{ minWidth: '150px', fontWeight: 600, fontSize: '0.8rem' }}
            >
              <option value="ALL">All Battalions / Units</option>
              <option value="1st Battalion">1st Battalion</option>
              <option value="2nd Battalion">2nd Battalion</option>
              <option value="CADET OFFICERS">CADET OFFICERS</option>
            </select>

            {/* 2. Company Dropdown (Appears ONLY when a specific Battalion is picked) */}
            {battalionFilter !== 'ALL' && battalionFilter !== 'CADET OFFICERS' && (
              <select
                className="form-control form-control-sm"
                value={companyFilter}
                onChange={(e) => handleCompanyChange(e.target.value)}
                style={{
                  minWidth: '140px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderColor: 'var(--rotc-gold)',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <option value="ALL">All Companies</option>
                <option value="Alpha">Alpha Company</option>
                <option value="Bravo">Bravo Company</option>
                <option value="Charlie">Charlie Company</option>
                <option value="Delta">Delta Company</option>
              </select>
            )}

            {/* 3. Platoon Dropdown (Appears ONLY when a specific Company is picked) */}
            {battalionFilter !== 'ALL' && battalionFilter !== 'CADET OFFICERS' && companyFilter !== 'ALL' && (
              <select
                className="form-control form-control-sm"
                value={platoonFilter}
                onChange={(e) => setPlatoonFilter(e.target.value)}
                style={{
                  minWidth: '130px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderColor: '#0f766e',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <option value="ALL">All Platoons</option>
                <option value="1st Platoon">1st Platoon (37)</option>
                <option value="2nd Platoon">2nd Platoon (37)</option>
                <option value="3rd Platoon">3rd Platoon (37)</option>
                <option value="4th Platoon">4th Platoon (37)</option>
              </select>
            )}

            {/* Reset Filters Shortcut Button */}
            {isAnyFilterActive && (
              <button
                onClick={() => {
                  setBattalionFilter('ALL');
                  setCompanyFilter('ALL');
                  setPlatoonFilter('ALL');
                  setSearchTerm('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px'
                }}
                title="Reset all filters"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Search Bar Below Master Records Header */}
        <div style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--rotc-green-dark)'
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search Cadet ID or Name (e.g. 2024-0001, Juan Dela Cruz)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 2.2rem 0.55rem 2.4rem',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Clear search input"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Master Attendance Table */}
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>Cadet ID</th>
                <th>Cadet Name</th>
                <th>Battalion</th>
                <th>Company</th>
                <th>Platoon</th>
                <th>Time-In</th>
                <th>Time-Out</th>
                <th>Final Status</th>

                {/* Top-Right Corner: Duty Officer Header with Settings Gear / More Options Menu */}
                <th style={{ position: 'relative', minWidth: '160px', paddingRight: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span>Duty Officer</span>

                    {/* Settings Gear / More Options Button in the top-right corner of <thead> */}
                    <div ref={tableMenuRef} style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsTableMenuOpen(prev => !prev);
                        }}
                        style={{
                          background: isTableMenuOpen ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid rgba(255, 255, 255, 0.35)',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'all 0.15s ease',
                          boxShadow: isTableMenuOpen ? '0 0 0 2px rgba(255,255,255,0.4)' : 'none'
                        }}
                        title="Master Attendance Clear & Reset Options"
                        aria-label="Table options menu"
                      >
                        <Settings size={13} style={{ transform: isTableMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }} />
                        <MoreVertical size={13} />
                      </button>

                      {/* Floating Dropdown Menu */}
                      {isTableMenuOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(100% + 6px)',
                            background: '#ffffff',
                            borderRadius: '10px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e2e8f0',
                            zIndex: 9999,
                            minWidth: '230px',
                            padding: '6px 0',
                            textAlign: 'left',
                            color: '#1e293b',
                            animation: 'slideDown 0.18s ease-out'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{
                            padding: '6px 14px 8px 14px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <Settings size={12} /> Master Table Actions
                          </div>

                          {/* 1. Clear All Records */}
                          <button
                            onClick={() => {
                              setIsTableMenuOpen(false);
                              setClearModalMode('ALL');
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '9px',
                              padding: '8px 14px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              color: '#dc2626',
                              fontWeight: 700,
                              textAlign: 'left',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Trash2 size={14} style={{ color: '#dc2626' }} />
                            <span>Clear All Master Logs</span>
                          </button>

                          {/* 2. Clear Current Filtered View */}
                          <button
                            onClick={() => {
                              setIsTableMenuOpen(false);
                              setClearModalMode('FILTERED');
                            }}
                            disabled={filteredLogs.length === 0}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '9px',
                              padding: '8px 14px',
                              background: 'none',
                              border: 'none',
                              cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              color: '#b45309',
                              fontWeight: 700,
                              textAlign: 'left',
                              opacity: filteredLogs.length === 0 ? 0.5 : 1,
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => { if (filteredLogs.length > 0) e.currentTarget.style.background = '#fef3c7'; }}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Filter size={14} style={{ color: '#b45309' }} />
                            <span>Clear Filtered View ({filteredLogs.length})</span>
                          </button>

                          {/* 3. Clear Specific Platoon */}
                          <button
                            onClick={() => {
                              setIsTableMenuOpen(false);
                              setClearModalMode('PLATOON');
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '9px',
                              padding: '8px 14px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              color: '#334155',
                              fontWeight: 600,
                              textAlign: 'left',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Layers size={14} style={{ color: '#475569' }} />
                            <span>Clear Specific Platoon...</span>
                          </button>

                          {/* 4. Clear Specific Cadet */}
                          <button
                            onClick={() => {
                              setIsTableMenuOpen(false);
                              setClearModalMode('CADET');
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '9px',
                              padding: '8px 14px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              color: '#334155',
                              fontWeight: 600,
                              textAlign: 'left',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <Users size={14} style={{ color: '#475569' }} />
                            <span>Clear Specific Cadet...</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No attendance records matching active filter options or search term.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const echelon = getScannedUnitEchelon(log);
                  const timeInTimestamp = log.timeIn || (log.scanMode !== 'Time-Out' ? log.timestamp : null);
                  const timeOutTimestamp = log.timeOut || (log.scanMode === 'Time-Out' ? log.timestamp : null);

                  const hasValidTimeIn = Boolean(timeInTimestamp && String(timeInTimestamp).trim());
                  const hasValidTimeOut = Boolean(timeOutTimestamp && String(timeOutTimestamp).trim());

                  const timeInStatus = hasValidTimeIn
                    ? evaluateSingleScan({ timestamp: timeInTimestamp, scanMode: 'Time-In' }, currentCutoff)
                    : null;

                  let finalStatus = 'ABSENT';
                  if (hasValidTimeIn && hasValidTimeOut) {
                    finalStatus = timeInStatus === 'LATE' ? 'LATE' : 'PRESENT';
                  } else if (hasValidTimeIn && !hasValidTimeOut) {
                    finalStatus = timeInStatus === 'LATE' ? 'LATE / NO TIME-OUT' : 'NO TIME-OUT';
                  } else if (!hasValidTimeIn && hasValidTimeOut) {
                    finalStatus = 'NO TIME-IN';
                  } else {
                    finalStatus = 'ABSENT';
                  }

                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>{log.cadetId}</td>
                      <td style={{ fontWeight: 600 }}>{log.name}</td>
                      <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>{echelon.battalion}</span></td>
                      <td><span className="badge badge-company">{echelon.company}</span></td>
                      <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{echelon.platoon}</span></td>

                      {/* Time-In Column */}
                      <td>
                        {hasValidTimeIn ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {new Date(timeInTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {timeInStatus === 'LATE' ? (
                              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, padding: '2px 6px', fontSize: '0.68rem' }}>
                                <Clock size={10} /> LATE
                              </span>
                            ) : (
                              <span className="badge badge-present" style={{ padding: '2px 6px', fontSize: '0.68rem' }}>
                                <CheckCircle size={10} /> PRESENT
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      {/* Time-Out Column */}
                      <td>
                        {hasValidTimeOut ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {new Date(timeOutTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="badge badge-present" style={{ padding: '2px 6px', fontSize: '0.68rem' }}>
                              <CheckCircle size={10} /> PRESENT
                            </span>
                          </div>
                        ) : (
                          <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.68rem', padding: '2px 6px' }}>
                            NO TIME-OUT
                          </span>
                        )}
                      </td>

                      {/* Final Status */}
                      <td>
                        {finalStatus === 'PRESENT' || finalStatus === 'PRESENT (Complete)' ? (
                          <span className="badge badge-present" style={{ fontWeight: 800, gap: '3px' }}>
                            <CheckCircle size={11} /> PRESENT
                          </span>
                        ) : finalStatus === 'LATE' || finalStatus === 'LATE (Complete)' ? (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 800, gap: '3px' }}>
                            <Clock size={11} /> LATE
                          </span>
                        ) : finalStatus === 'NO TIME-OUT' || finalStatus === 'INCOMPLETE (No Time-Out)' ? (
                          <span className="badge" style={{ background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa', fontWeight: 800, gap: '3px' }}>
                            NO TIME-OUT
                          </span>
                        ) : finalStatus === 'LATE / NO TIME-OUT' || finalStatus === 'INCOMPLETE (Late / No Time-Out)' ? (
                          <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                            LATE / NO TIME-OUT
                          </span>
                        ) : finalStatus === 'ABSENT' ? (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 700, gap: '3px' }}>
                            ABSENT
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                            {finalStatus}
                          </span>
                        )}
                      </td>

                      <td>{log.dutyOfficer || 'Duty Officer'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Confirmation & Selection Modal */}
      {clearModalMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '480px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-light)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.1rem', color: '#b91c1c' }}>
                <Trash2 size={20} />
                {clearModalMode === 'ALL' && 'Clear All Master Logs'}
                {clearModalMode === 'FILTERED' && 'Clear Current Filtered View'}
                {clearModalMode === 'PLATOON' && 'Clear Specific Platoon Logs'}
                {clearModalMode === 'CADET' && 'Clear Specific Cadet Attendance'}
              </div>
              <button
                onClick={() => setClearModalMode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {clearModalMode === 'ALL' && (
              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Are you sure you want to <strong>wipe all master attendance logs</strong>? This will clear all recorded Time-In and Time-Out timestamps across all units and battalions.
              </p>
            )}

            {clearModalMode === 'FILTERED' && (
              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Are you sure you want to clear <strong>{filteredLogs.length} cadet record(s)</strong> currently displayed under the active filters and search query?
              </p>
            )}

            {clearModalMode === 'PLATOON' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.84rem', color: '#475569', margin: 0 }}>
                  Select the platoon whose attendance logs you wish to clear:
                </p>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Battalion</label>
                  <select
                    className="form-control"
                    value={clearPlatoonTarget.battalion}
                    onChange={(e) => setClearPlatoonTarget(prev => ({ ...prev, battalion: e.target.value }))}
                  >
                    <option value="1st Battalion">1st Battalion</option>
                    <option value="2nd Battalion">2nd Battalion</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Company</label>
                  <select
                    className="form-control"
                    value={clearPlatoonTarget.company}
                    onChange={(e) => setClearPlatoonTarget(prev => ({ ...prev, company: e.target.value }))}
                  >
                    <option value="Alpha Company">Alpha Company</option>
                    <option value="Bravo Company">Bravo Company</option>
                    <option value="Charlie Company">Charlie Company</option>
                    <option value="Delta Company">Delta Company</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Platoon</label>
                  <select
                    className="form-control"
                    value={clearPlatoonTarget.platoon}
                    onChange={(e) => setClearPlatoonTarget(prev => ({ ...prev, platoon: e.target.value }))}
                  >
                    <option value="1st Platoon">1st Platoon</option>
                    <option value="2nd Platoon">2nd Platoon</option>
                  </select>
                </div>
              </div>
            )}

            {clearModalMode === 'CADET' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.84rem', color: '#475569', margin: 0 }}>
                  Enter the Cadet ID (e.g. <code>2024-0001</code>) to remove their attendance record:
                </p>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Cadet ID..."
                  value={clearCadetInput}
                  onChange={(e) => setClearCadetInput(e.target.value)}
                  style={{ textTransform: 'uppercase', fontWeight: 700 }}
                  autoFocus
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setClearModalMode(null)}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteClear}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Letterhead & Header/Footer Settings Modal */}
      <LetterheadSettingsModal
        isOpen={isLetterheadModalOpen}
        onClose={() => setIsLetterheadModalOpen(false)}
        onSaved={() => {
          setStatusNotice({
            type: 'success',
            text: 'Official Excel letterhead and footer settings updated!'
          });
          setTimeout(() => setStatusNotice(null), 3500);
        }}
      />
    </div>
  );
}
