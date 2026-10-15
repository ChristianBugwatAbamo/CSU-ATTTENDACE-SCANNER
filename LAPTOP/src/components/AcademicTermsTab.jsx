import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  CalendarRange,
  CalendarPlus,
  GraduationCap,
  Users,
  Plus,
  X,
  ChevronRight,
  Target,
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  Power,
  Trash2,
  Calendar,
  Lock,
  Archive,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import {
  mapTermRow,
  fetchAcademicTerms,
  createAcademicTerm,
  setActiveAcademicTerm,
  archiveAcademicTerm,
  deleteAcademicTerm,
  evaluateTermStatusByDates,
  describeTermError,
  requireClient
} from '../utils/academicTermsApi';
import { supabase, getSupabaseClient } from '../utils/supabaseClient';
import { useAcademicTerm } from '../context/AcademicTermContext';
import './AcademicTermsManager.css';

/**
 * Delete is strictly allowed ONLY for UPCOMING terms with 0 completed days and 0 enrolled cadets.
 * Deletion is blocked for CURRENT or ARCHIVED terms to preserve historical attendance data integrity.
 */
export const isDeletableUpcoming = (term) => {
  if (!term) return false;
  const isUpcoming = String(term.status || '').trim().toLowerCase() === 'upcoming';
  const noCompletedDays = Number(term.completedDays ?? term.completed_training_days ?? 0) === 0;
  const noEnrolledCadets = Number(term.enrolledCadets ?? term.enrolled_cadets ?? 0) === 0;
  return isUpcoming && noCompletedDays && noEnrolledCadets;
};

export const formatTermDates = (start, end) => {
  if (!start || !end) return null;
  try {
    const [sY, sM, sD] = String(start).split('-');
    const [eY, eM, eD] = String(end).split('-');
    const sDate = new Date(Number(sY), Number(sM) - 1, Number(sD));
    const eDate = new Date(Number(eY), Number(eM) - 1, Number(eD));
    const sStr = sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const eStr = eDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${sStr} – ${eStr}`;
  } catch (_) {
    return `${start} to ${end}`;
  }
};

export const SEMESTER_OPTIONS = [
  { value: '1st Semester', course: 'ROTC 1 (MS 1)', label: '1st Semester • ROTC 1 (MS 1)' },
  { value: '2nd Semester', course: 'ROTC 2 (MS 2)', label: '2nd Semester • ROTC 2 (MS 2)' }
];

const DEFAULT_TRAINING_DAYS = 15;

const getProgressPct = (term) => {
  if (!term || !term.expectedDays) return 0;
  return Math.min(100, Math.round((term.completedDays / term.expectedDays) * 100));
};

// Accepts "2027-2028", "AY 2027-2028", "ay2027 - 2028" → "AY 2027-2028"
const normalizeAcademicYear = (raw) => {
  const match = String(raw || '').trim().match(/^(?:AY\s*)?(\d{4})\s*[-–]\s*(\d{4})$/i);
  if (!match) return null;
  return { label: `AY ${match[1]}-${match[2]}`, start: Number(match[1]), end: Number(match[2]) };
};

/**
 * StatusBadge:
 * Consistently renders uppercase military badges ('CURRENT', 'UPCOMING', 'ARCHIVED')
 * mapped from database statuses (which are stored lowercase 'current', 'upcoming', 'archived').
 */
export function StatusBadge({ status, useLongLabel = false }) {
  const raw = String(status || '').trim();
  const norm = raw.toLowerCase();
  const themeClass = norm.includes('current')
    ? 'current'
    : norm.includes('archive')
      ? 'archived'
      : 'upcoming';

  let displayLabel = 'UPCOMING';
  if (themeClass === 'current') {
    displayLabel = useLongLabel ? 'CURRENT ACTIVE' : 'CURRENT';
  } else if (themeClass === 'archived') {
    displayLabel = 'ARCHIVED';
  } else {
    displayLabel = 'UPCOMING';
  }

  return (
    <span className={`at-status at-status--${themeClass}`}>
      <span className="at-status-dot" />
      {displayLabel}
    </span>
  );
}

/**
 * Academic Year & Semester Management Tab (Settings > Academic Terms)
 *
 * Strictly backed by Supabase `academic_terms`:
 *  - Initial terms state: [] (strictly empty array, zero mock fallback)
 *  - Populated exclusively via supabase.from('academic_terms').select('*')
 *  - Displays exact status values stored in the database
 */
export default function AcademicTermsTab() {
  const {
    selectedTermId: headerSelectedTermId,
    selectedTerm: headerSelectedTerm,
    setActiveTermId: setGlobalActiveTermId,
    refreshTerms: refreshGlobalTerms
  } = useAcademicTerm();

  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [pendingActivateTerm, setPendingActivateTerm] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [pendingArchiveTerm, setPendingArchiveTerm] = useState(null);
  const [archiveNextTermId, setArchiveNextTermId] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [pendingDeleteTerm, setPendingDeleteTerm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMountedRef = useRef(true);
  const selectedIdRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => { selectedIdRef.current = selectedTermId; }, [selectedTermId]);

  const loadTerms = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Query academic_terms with live relational count from cadets table via academic_term_id
      // Also handles one-time legacy cadet auto-link and distinct formation session counts
      const rows = await fetchAcademicTerms();
      if (!isMountedRef.current) return;
      setTerms(rows);

      // Keep current selection if valid, else pick header selection or active or first record
      const prevId = selectedIdRef.current;
      if (!prevId || !rows.some(t => t.id === prevId)) {
        const preferredId = headerSelectedTermId && rows.some(t => t.id === headerSelectedTermId)
          ? headerSelectedTermId
          : (rows.find(t => String(t.status || '').toLowerCase() === 'current')?.id || rows[0]?.id || null);
        setSelectedTermId(preferredId);
      }
    } catch (err) {
      console.error('Failed to load academic terms from Supabase:', err);
      if (isMountedRef.current) {
        // Strictly empty array on error — zero mock fallback data
        setTerms([]);
        setSelectedTermId(null);
        setLoadError(describeTermError(err));
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [headerSelectedTermId]);

  useEffect(() => { loadTerms(); }, [loadTerms]);

  // Keep local inspection in sync when header term changes
  useEffect(() => {
    if (headerSelectedTermId && terms.some(t => t.id === headerSelectedTermId)) {
      setSelectedTermId(headerSelectedTermId);
    }
  }, [headerSelectedTermId, terms]);

  const selectedTerm = useMemo(
    () => terms.find(t => t.id === selectedTermId) || terms.find(t => t.id === headerSelectedTermId) || terms[0] || null,
    [terms, selectedTermId, headerSelectedTermId]
  );

  const visibleTerms = useMemo(() => {
    if (statusFilter === 'all') return terms;
    return terms.filter(t => String(t.status || '').trim().toLowerCase() === String(statusFilter || '').trim().toLowerCase());
  }, [terms, statusFilter]);

  const counts = useMemo(() => ({
    all: terms.length,
    current: terms.filter(t => String(t.status || '').trim().toLowerCase() === 'current').length,
    upcoming: terms.filter(t => String(t.status || '').trim().toLowerCase() === 'upcoming').length,
    archived: terms.filter(t => String(t.status || '').trim().toLowerCase() === 'archived').length
  }), [terms]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddTerm = async (draft) => {
    const created = await createAcademicTerm(draft);
    await loadTerms();
    refreshGlobalTerms?.();
    setSelectedTermId(created.id);
    setIsModalOpen(false);
    showToast(`✓ ${created.academicYear} • ${created.semester} (${created.status}) saved to Supabase.`);
  };

  const handleConfirmDelete = async () => {
    const term = pendingDeleteTerm;
    if (!term) return;
    if (!isDeletableUpcoming(term)) {
      setActionError('Deletion blocked: Only UPCOMING terms with 0 completed training days and 0 enrolled cadets can be deleted to protect historical attendance data integrity.');
      setPendingDeleteTerm(null);
      return;
    }
    setPendingDeleteTerm(null);
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteAcademicTerm(term.id);
      refreshGlobalTerms?.();
      setTerms(prev => {
        const nextList = prev.filter(t => t.id !== term.id);
        if (selectedTermId === term.id) {
          const fallback = nextList.find(t => String(t.status || '').toLowerCase() === 'current') || nextList[0] || null;
          setSelectedTermId(fallback?.id ?? null);
        }
        return nextList;
      });
      showToast(`✓ ${term.academicYear} • ${term.semester} has been permanently deleted.`);
    } catch (err) {
      console.error('Failed to delete academic term:', err);
      if (isMountedRef.current) setActionError(describeTermError(err));
    } finally {
      if (isMountedRef.current) setIsDeleting(false);
    }
  };

  const handleConfirmActivate = async () => {
    const term = pendingActivateTerm;
    if (!term) return;
    setPendingActivateTerm(null);
    setIsActivating(true);
    setActionError(null);
    try {
      const rows = await setActiveAcademicTerm(term.id);
      if (!isMountedRef.current) return;
      setTerms(rows);
      setSelectedTermId(term.id);
      setGlobalActiveTermId?.(term.id);
      refreshGlobalTerms?.();
      showToast(`✓ ${term.academicYear} • ${term.semester} is now the active system term.`);
    } catch (err) {
      console.error('Failed to set active academic term:', err);
      if (isMountedRef.current) setActionError(describeTermError(err));
    } finally {
      if (isMountedRef.current) setIsActivating(false);
    }
  };

  const handleConfirmArchive = async () => {
    const term = pendingArchiveTerm;
    if (!term) return;
    setIsArchiving(true);
    setActionError(null);
    try {
      const rows = await archiveAcademicTerm(term.id, archiveNextTermId || null);
      if (!isMountedRef.current) return;
      setTerms(rows);
      if (archiveNextTermId) {
        setSelectedTermId(archiveNextTermId);
        setGlobalActiveTermId?.(archiveNextTermId);
      }
      refreshGlobalTerms?.();
      showToast(`✓ "${term.academicYear} • ${term.semester}" has been archived.`);
      setPendingArchiveTerm(null);
      setArchiveNextTermId('');
    } catch (err) {
      console.error('Failed to archive academic term:', err);
      if (isMountedRef.current) setActionError(describeTermError(err));
    } finally {
      if (isMountedRef.current) setIsArchiving(false);
    }
  };

  const pct = getProgressPct(selectedTerm);

  return (
    <div className="at-root">
      {loadError && (
        <div className="at-alert-box" role="alert">
          <div>
            <strong>Unable to load Academic Terms</strong>
            <span>{loadError}</span>
          </div>
          <button type="button" onClick={loadTerms}>
            <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} /> Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="at-alert-box" role="alert">
          <div>
            <strong>Action Failed</strong>
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* ===================== TOP SELECTION BANNER ===================== */}
      <section className="at-banner" aria-label="Selected academic term overview">
        {isLoading && terms.length === 0 ? (
          <div className="at-banner-inner" style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <RefreshCw size={20} className="animate-spin" />
            <span style={{ fontWeight: 700 }}>Connecting to Supabase &amp; loading academic terms...</span>
          </div>
        ) : selectedTerm ? (
          <div className="at-banner-inner" key={selectedTerm.id}>
            <div className="at-banner-top">
              <div>
                <div className="at-eyebrow">
                  <CalendarRange size={13} />
                  <span>INSPECTING ACADEMIC TERM</span>
                </div>
                <h3 className="at-banner-title" id="at-selected-term-title">
                  <span>
                    {selectedTerm.academicYear} <span className="at-dot">•</span> {selectedTerm.semester}
                  </span>
                  <StatusBadge status={selectedTerm.status} useLongLabel />
                </h3>
                <p className="at-banner-sub">
                  {selectedTerm.course} • Per-semester training calendar &amp; enrollment snapshot
                </p>
                {selectedTerm.startDate && selectedTerm.endDate && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                    <Calendar size={13} />
                    <span>{formatTermDates(selectedTerm.startDate, selectedTerm.endDate)}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {String(selectedTerm.status || '').toLowerCase() !== 'current' && (
                  <button
                    type="button"
                    className="at-btn-activate"
                    onClick={() => setPendingActivateTerm(selectedTerm)}
                    disabled={isActivating}
                    title="Set this semester as the system-wide active term"
                  >
                    {isActivating ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
                    <span>Set as Active Term</span>
                  </button>
                )}

                {String(selectedTerm.status || '').toLowerCase() === 'current' && (
                  <button
                    type="button"
                    className="at-btn-activate"
                    style={{ background: 'rgba(255, 255, 255, 0.16)', borderColor: 'rgba(255, 255, 255, 0.35)', color: '#ffffff' }}
                    onClick={() => {
                      setPendingArchiveTerm(selectedTerm);
                      const nextUp = terms.find(t => String(t.status || '').toLowerCase() === 'upcoming');
                      setArchiveNextTermId(nextUp?.id || '');
                    }}
                    title="Archive this active term"
                  >
                    <Archive size={14} />
                    <span>Archive Term</span>
                  </button>
                )}

                {isDeletableUpcoming(selectedTerm) && (
                  <button
                    type="button"
                    className="at-btn-delete"
                    onClick={() => setPendingDeleteTerm(selectedTerm)}
                    disabled={isDeleting}
                    title="Delete this upcoming term"
                  >
                    <Trash2 size={14} />
                    <span>Delete Term</span>
                  </button>
                )}

                <button
                  type="button"
                  id="at-open-create-term"
                  className="at-create-btn"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Plus size={18} strokeWidth={3} />
                  Create Per-Sem Term
                </button>
              </div>
            </div>

            <div className="at-banner-stats">
              {/* Training Progress Meter */}
              <div className="at-glass">
                <div className="at-meter-head">
                  <div>
                    <div className="at-meter-label"><Target size={13} /> Training Progress</div>
                    <div className="at-meter-text" id="at-progress-text">
                      <strong>{selectedTerm.completedDays}</strong> of {selectedTerm.expectedDays} Training Days Completed
                    </div>
                  </div>
                  <div className="at-meter-pct">{pct}%</div>
                </div>
                <div
                  className="at-meter-track"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Training days completed"
                >
                  <div className="at-meter-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="at-meter-ticks">
                  <span>Day 0</span>
                  <span>{Math.max(0, selectedTerm.expectedDays - selectedTerm.completedDays)} day(s) remaining</span>
                  <span>Day {selectedTerm.expectedDays}</span>
                </div>
              </div>

              {/* Cadet Enrollment Counter */}
              <div className="at-glass at-enroll">
                <div className="at-enroll-icon"><Users size={24} /></div>
                <div>
                  <div className="at-meter-label">Enrolled Cadets</div>
                  <div className="at-enroll-value" id="at-enrolled-count">
                    {selectedTerm.enrolledCadets.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: '3px' }}>
                    This semester only
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="at-banner-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 className="at-banner-title">No academic terms found in Supabase</h3>
              <p className="at-banner-sub">Create your first per-semester term to start tracking training days.</p>
            </div>
            <button type="button" className="at-create-btn" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} strokeWidth={3} /> Create Per-Sem Term
            </button>
          </div>
        )}
      </section>

      {toast && (
        <div style={{
          background: '#d1fae5',
          border: '1.5px solid #10b981',
          color: '#065f46',
          padding: '0.8rem 1.1rem',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 700,
          fontSize: '0.88rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={20} color="#059669" />
          <span>{toast}</span>
        </div>
      )}

      {/* ===================== SEMESTER DIRECTORY & TERM MANAGEMENT TABLE ===================== */}
      <section className="card" aria-label="Term management and semester directory">
        <div className="at-dir-head" style={{ marginBottom: '1.25rem' }}>
          <div>
            <h3 className="at-dir-title">
              <Layers size={20} color="var(--rotc-green-dark)" />
              Term Management &amp; Semester Directory
            </h3>
            <p className="at-dir-sub">
              Dynamic per-term cadet enrollment, training progress metrics, and system-wide term lifecycle controls.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="at-filter" role="tablist" aria-label="Filter terms by status">
              {[
                { id: 'all', label: 'All Terms' },
                { id: 'current', label: 'Current' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'archived', label: 'Archived' }
              ].map(f => (
                <button
                  key={f.id}
                  id={`at-filter-${f.id}`}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f.id}
                  className={statusFilter === f.id ? 'is-active' : ''}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label} ({counts[f.id]})
                </button>
              ))}
            </div>

            <div className="at-view-toggle">
              <button
                type="button"
                className={viewMode === 'table' ? 'is-active' : ''}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <TableIcon size={14} /> <span>Table View</span>
              </button>
              <button
                type="button"
                className={viewMode === 'cards' ? 'is-active' : ''}
                onClick={() => setViewMode('cards')}
                title="Cards View"
              >
                <LayoutGrid size={14} /> <span>Cards View</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="at-table-container">
            <table className="at-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Academic Term</th>
                  <th style={{ width: '25%' }}>Status &amp; Header Inspection</th>
                  <th style={{ width: '15%' }}>Term Dates</th>
                  <th style={{ width: '18%' }}>Training Progress</th>
                  <th style={{ width: '10%' }}>Cadets</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTerms.map(term => {
                  const isSelected = selectedTerm?.id === term.id;
                  const isHeaderSelected = term.id === headerSelectedTermId;
                  const isCurrent = String(term.status || '').toLowerCase() === 'current';
                  const isArchived = String(term.status || '').toLowerCase() === 'archived';
                  const isUpcoming = String(term.status || '').toLowerCase() === 'upcoming';
                  const termPct = getProgressPct(term);

                  return (
                    <tr
                      key={term.id}
                      className={`at-table-row${isHeaderSelected ? ' is-header-selected' : ''}${isArchived ? ' is-archived' : ''}`}
                      onClick={() => setSelectedTermId(term.id)}
                      title={isHeaderSelected ? 'Currently selected in top header switcher' : 'Click to preview term in top banner'}
                    >
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '0.92rem' }}>
                          {term.academicYear} • {term.semester}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {term.course}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <StatusBadge status={term.status} />
                          {isHeaderSelected && (
                            isArchived ? (
                              <span className="at-badge-inspecting-archived">
                                <Lock size={11} /> CURRENTLY INSPECTING (ARCHIVED)
                              </span>
                            ) : isCurrent ? (
                              <span className="at-badge-inspecting-active">
                                <CheckCircle2 size={11} /> CURRENT ACTIVE
                              </span>
                            ) : (
                              <span className="at-badge-inspecting-upcoming">
                                <Calendar size={11} /> CURRENTLY INSPECTING (UPCOMING)
                              </span>
                            )
                          )}
                        </div>
                      </td>

                      <td>
                        {term.startDate && term.endDate ? (
                          <div style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} color="#64748b" />
                            <span>{formatTermDates(term.startDate, term.endDate)}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dates unconfigured</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700 }}>
                            <span><strong>{term.completedDays}</strong> / {term.expectedDays} days</span>
                            <span style={{ color: 'var(--text-muted)' }}>{termPct}%</span>
                          </div>
                          <div className="at-mini-track" style={{ height: '6px' }}>
                            <div className={`at-mini-fill at-mini-fill--${String(term.status || '').toLowerCase()}`} style={{ width: `${termPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, fontSize: '0.88rem', color: '#065f46' }}>
                          <GraduationCap size={15} color="#059669" />
                          <span>{term.enrolledCadets.toLocaleString()}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          {!isCurrent && (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setPendingActivateTerm(term)}
                              title="Promote this term to system active"
                            >
                              <Power size={11} color="#059669" />
                              <span>Set Active</span>
                            </button>
                          )}

                          {isCurrent && (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                setPendingArchiveTerm(term);
                                const nextCandidate = terms.find(t => String(t.status || '').toLowerCase() === 'upcoming');
                                setArchiveNextTermId(nextCandidate?.id || '');
                              }}
                              title="Archive active term"
                            >
                              <Archive size={11} color="#b45309" />
                              <span>Archive</span>
                            </button>
                          )}

                          {isArchived && (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Completed training days and dates are locked for archived terms">
                              <Lock size={11} /> Locked
                            </span>
                          )}

                          {isDeletableUpcoming(term) && (
                            <button
                              type="button"
                              className="at-card-delete-btn"
                              style={{ width: '26px', height: '26px' }}
                              onClick={() => setPendingDeleteTerm(term)}
                              title="Delete upcoming term"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.74rem' }}
                            onClick={() => setSelectedTermId(term.id)}
                            title="Inspect in top banner"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {visibleTerms.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      {isLoading ? 'Loading academic terms from Supabase...' : `No ${statusFilter === 'all' ? '' : statusFilter} terms found in Supabase.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="at-grid">
            {visibleTerms.map(term => {
              const isSelected = selectedTerm?.id === term.id;
              const isHeaderSelected = term.id === headerSelectedTermId;
              const termPct = getProgressPct(term);
              const isCurrent = String(term.status || '').toLowerCase() === 'current';
              const isArchived = String(term.status || '').toLowerCase() === 'archived';

              return (
                <button
                  key={term.id}
                  id={`at-term-card-${term.id}`}
                  type="button"
                  className={`at-card${isSelected ? ' is-selected' : ''}${isHeaderSelected ? ' is-header-selected' : ''}${isArchived ? ' is-archived' : ''}`}
                  onClick={() => setSelectedTermId(term.id)}
                  aria-pressed={isSelected}
                >
                  {isCurrent && (
                    <span className="at-card-ribbon">
                      <CheckCircle2 size={11} /> CURRENT
                    </span>
                  )}

                  <div className="at-card-top">
                    <div>
                      <div className="at-card-ay">{term.academicYear}</div>
                      <div className="at-card-sem">{term.semester}</div>
                      <div className="at-card-course">{term.course}</div>
                      {term.startDate && term.endDate && (
                        <div className="at-card-dates">
                          <Calendar size={11} />
                          <span>{formatTermDates(term.startDate, term.endDate)}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <StatusBadge status={term.status} />
                      {isHeaderSelected && (
                        isArchived ? (
                          <span className="at-badge-inspecting-archived" style={{ marginTop: '2px' }}>
                            <Lock size={10} /> CURRENTLY INSPECTING (ARCHIVED)
                          </span>
                        ) : isCurrent ? (
                          <span className="at-badge-inspecting-active" style={{ marginTop: '2px' }}>
                            <CheckCircle2 size={10} /> CURRENT ACTIVE
                          </span>
                        ) : (
                          <span className="at-badge-inspecting-upcoming" style={{ marginTop: '2px' }}>
                            <Calendar size={10} /> CURRENTLY INSPECTING (UPCOMING)
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="at-mini">
                    <div className="at-mini-head">
                      <span><strong>{term.completedDays}</strong> / {term.expectedDays} days</span>
                      <span>{termPct}%</span>
                    </div>
                    <div className="at-mini-track">
                      <div className={`at-mini-fill at-mini-fill--${String(term.status || '').toLowerCase()}`} style={{ width: `${termPct}%` }} />
                    </div>
                  </div>

                  <div className="at-card-foot">
                    <span className="at-cadets">
                      <GraduationCap size={14} color="#059669" />
                      {term.enrolledCadets.toLocaleString()} cadets
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {!isCurrent && (
                        <button
                          type="button"
                          className="at-card-activate-btn"
                          title="Set as active system term"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingActivateTerm(term);
                          }}
                        >
                          <Power size={11} color="#059669" />
                          <span>Set Active</span>
                        </button>
                      )}

                      {isDeletableUpcoming(term) && (
                        <button
                          type="button"
                          className="at-card-delete-btn"
                          title="Delete upcoming term"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteTerm(term);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      <span className="at-inspect">
                        {isSelected ? 'Inspecting' : 'Inspect'} <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {visibleTerms.length === 0 && (
              <div className="at-empty">
                {isLoading ? 'Loading from Supabase...' : `No ${statusFilter === 'all' ? '' : statusFilter} terms found in Supabase.`}
              </div>
            )}
          </div>
        )}
      </section>

      {isModalOpen && (
        <CreateTermModal
          existingTerms={terms}
          onClose={() => setIsModalOpen(false)}
          onCreate={handleAddTerm}
        />
      )}

      {pendingActivateTerm && (
        <ConfirmModal
          isOpen={Boolean(pendingActivateTerm)}
          title="Set Active System Term"
          message={`Are you sure you want to set "${pendingActivateTerm.academicYear} • ${pendingActivateTerm.semester}" as the CURRENT ACTIVE term? This will update system_settings and synchronize active formation training days.`}
          confirmText="Yes, Set Active"
          cancelText="Cancel"
          isDestructive={false}
          onConfirm={handleConfirmActivate}
          onCancel={() => setPendingActivateTerm(null)}
        />
      )}

      {pendingArchiveTerm && (
        <ConfirmModal
          isOpen={Boolean(pendingArchiveTerm)}
          title="Archive Active Academic Term"
          message={`Are you sure you want to archive "${pendingArchiveTerm.academicYear} • ${pendingArchiveTerm.semester}"? Its historical attendance logs and roster records will be preserved in read-only mode.`}
          confirmText={isArchiving ? 'Archiving...' : 'Yes, Archive Term'}
          cancelText="Cancel"
          isDestructive={false}
          onConfirm={handleConfirmArchive}
          onCancel={() => setPendingArchiveTerm(null)}
        />
      )}

      {pendingDeleteTerm && (
        <ConfirmModal
          isOpen={Boolean(pendingDeleteTerm)}
          title="Delete Upcoming Term"
          message={`Are you sure you want to permanently delete "${pendingDeleteTerm.academicYear} • ${pendingDeleteTerm.semester}"? This term has 0 completed training days and 0 enrolled cadets. This action cannot be undone.`}
          confirmText={isDeleting ? 'Deleting...' : 'Yes, Delete Term'}
          cancelText="Cancel"
          isDestructive={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteTerm(null)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   Create New Semester Modal
   ========================================================================= */
function computeDefaultDates(ayStr, semStr) {
  const parsed = normalizeAcademicYear(ayStr);
  const startYr = parsed ? parsed.start : new Date().getFullYear();
  const endYr = parsed ? parsed.end : startYr + 1;
  if (semStr === '2nd Semester') {
    return {
      start: `${endYr}-01-15`,
      end: `${endYr}-05-30`
    };
  }
  return {
    start: `${startYr}-08-15`,
    end: `${startYr}-12-20`
  };
}

function CreateTermModal({ existingTerms, onClose, onCreate }) {
  const currentYear = new Date().getFullYear();
  const defaultAY = `AY ${currentYear}-${currentYear + 1}`;
  const [academicYear, setAcademicYear] = useState(defaultAY);
  const [semester, setSemester] = useState(SEMESTER_OPTIONS[0].value);
  const initialDates = computeDefaultDates(defaultAY, SEMESTER_OPTIONS[0].value);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [expectedDays, setExpectedDays] = useState(DEFAULT_TRAINING_DAYS);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parsedAY = normalizeAcademicYear(academicYear);
  const semOption = SEMESTER_OPTIONS.find(o => o.value === semester) || SEMESTER_OPTIONS[0];

  const dynamicStatus = useMemo(() => {
    if (!startDate || !endDate) return 'upcoming';
    return evaluateTermStatusByDates({ startDate, endDate }, new Date());
  }, [startDate, endDate]);

  const handleAcademicYearChange = (newAy) => {
    setAcademicYear(newAy);
    const parsed = normalizeAcademicYear(newAy);
    if (parsed) {
      const nextDates = computeDefaultDates(newAy, semester);
      setStartDate(nextDates.start);
      setEndDate(nextDates.end);
    }
    setErrors(p => ({ ...p, academicYear: undefined, startDate: undefined, endDate: undefined }));
    setSubmitError(null);
  };

  const handleSemesterChange = (newSem) => {
    setSemester(newSem);
    const nextDates = computeDefaultDates(academicYear, newSem);
    setStartDate(nextDates.start);
    setEndDate(nextDates.end);
    setErrors(p => ({ ...p, startDate: undefined, endDate: undefined }));
    setSubmitError(null);
  };

  const validate = () => {
    const next = {};
    if (!parsedAY) {
      next.academicYear = 'Use the format AY YYYY-YYYY (e.g., AY 2027-2028).';
    } else if (parsedAY.end !== parsedAY.start + 1) {
      next.academicYear = 'End year must be exactly one year after the start year.';
    } else if (existingTerms.some(t => t.academicYear === parsedAY.label && t.semester === semester)) {
      next.academicYear = `${parsedAY.label} • ${semester} already exists.`;
    }

    if (!startDate) {
      next.startDate = 'Please select a term start date.';
    }
    if (!endDate) {
      next.endDate = 'Please select a term end date.';
    }
    if (startDate && endDate && startDate > endDate) {
      next.endDate = 'End date cannot be earlier than start date.';
    }

    const days = Number(expectedDays);
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      next.expectedDays = 'Enter a whole number between 1 and 60.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const evaluatedStatus = evaluateTermStatusByDates({ startDate, endDate }, new Date());

      await onCreate({
        academicYear: parsedAY.label,
        semester,
        course: semOption.course,
        expectedDays: Number(expectedDays),
        startDate,
        endDate,
        status: evaluatedStatus
      });
    } catch (err) {
      console.error('Failed to create academic term:', err);
      setSubmitError(describeTermError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="at-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}>
      <form
        className="at-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="at-modal-title"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="at-modal-head">
          <div>
            <h3 id="at-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarPlus size={20} /> Create Per-Sem Term
            </h3>
            <p>Save a new semester entry directly into Supabase with automatic real-time status detection.</p>
          </div>
          <button type="button" className="at-modal-close" onClick={onClose} aria-label="Close" disabled={isSubmitting}>
            <X size={16} />
          </button>
        </div>

        <div className="at-modal-body">
          {submitError && (
            <div className="at-alert-box" role="alert" style={{ margin: 0 }}>
              <div>
                <strong>Error Saving Term</strong>
                <span>{submitError}</span>
              </div>
            </div>
          )}

          <div className={`at-field${errors.academicYear ? ' has-error' : ''}`}>
            <label htmlFor="at-input-ay">Academic Year</label>
            <input
              ref={firstInputRef}
              id="at-input-ay"
              type="text"
              placeholder="AY 2027-2028"
              value={academicYear}
              disabled={isSubmitting}
              onChange={(e) => handleAcademicYearChange(e.target.value)}
            />
            {errors.academicYear
              ? <span className="at-error"><AlertTriangle size={13} /> {errors.academicYear}</span>
              : <span className="at-hint">"2027-2028" is accepted and auto-formatted.</span>}
          </div>

          <div className="at-field">
            <label htmlFor="at-input-sem">Semester &amp; ROTC Course</label>
            <select
              id="at-input-sem"
              value={semester}
              disabled={isSubmitting}
              onChange={(e) => handleSemesterChange(e.target.value)}
            >
              {SEMESTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="at-date-fields">
            <div className={`at-field${errors.startDate ? ' has-error' : ''}`}>
              <label htmlFor="at-input-start-date">Term Start Date</label>
              <input
                id="at-input-start-date"
                type="date"
                value={startDate}
                disabled={isSubmitting}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setErrors(p => ({ ...p, startDate: undefined, endDate: undefined }));
                  setSubmitError(null);
                }}
              />
              {errors.startDate && <span className="at-error"><AlertTriangle size={13} /> {errors.startDate}</span>}
            </div>

            <div className={`at-field${errors.endDate ? ' has-error' : ''}`}>
              <label htmlFor="at-input-end-date">Term End Date</label>
              <input
                id="at-input-end-date"
                type="date"
                value={endDate}
                disabled={isSubmitting}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setErrors(p => ({ ...p, startDate: undefined, endDate: undefined }));
                  setSubmitError(null);
                }}
              />
              {errors.endDate && <span className="at-error"><AlertTriangle size={13} /> {errors.endDate}</span>}
            </div>
          </div>

          <div className={`at-field${errors.expectedDays ? ' has-error' : ''}`}>
            <label htmlFor="at-input-days">Expected Training Days</label>
            <input
              id="at-input-days"
              type="number"
              min={1}
              max={60}
              value={expectedDays}
              disabled={isSubmitting}
              onChange={(e) => { setExpectedDays(e.target.value); setErrors(p => ({ ...p, expectedDays: undefined })); setSubmitError(null); }}
            />
            {errors.expectedDays
              ? <span className="at-error"><AlertTriangle size={13} /> {errors.expectedDays}</span>
              : <span className="at-hint">Standard ROTC semester: {DEFAULT_TRAINING_DAYS} training days.</span>}
          </div>

          <div className="at-preview">
            <CalendarRange size={20} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.8px' }}>CARD PREVIEW &amp; REAL-TIME STATUS</span>
                <StatusBadge status={dynamicStatus} />
              </div>
              <strong>{parsedAY?.label || 'AY ____-____'} • {semester}</strong>
              <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                {semOption.course} • {Number(expectedDays) || 0} training days
                {startDate && endDate && (
                  <span style={{ display: 'block', color: 'rgba(255,255,255,0.78)', fontSize: '0.73rem', marginTop: '3px' }}>
                    📅 {formatTermDates(startDate, endDate)}
                    {dynamicStatus === 'current' && ' — Auto-detected: Active Today (CURRENT)'}
                    {dynamicStatus === 'upcoming' && ' — Auto-detected: Starts in Future (UPCOMING)'}
                    {dynamicStatus === 'archived' && ' — Auto-detected: Term Ended (ARCHIVED)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="at-modal-foot">
          <button type="button" className="at-btn-ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" id="at-submit-add-term" className="at-btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />}
            <span>{isSubmitting ? 'Saving to Supabase...' : 'Add Term Card'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
