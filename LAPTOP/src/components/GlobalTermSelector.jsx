import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  ChevronDown,
  Check,
  CheckCircle2,
  Archive,
  Calendar
} from 'lucide-react';
import { useAcademicTerm } from '../context/AcademicTermContext';

export default function GlobalTermSelector({
  selectedTermId: propSelectedTermId,
  setSelectedTermId: propSetSelectedTermId,
  onSelectTerm
} = {}) {
  const {
    academicTerms,
    selectedTermId: contextSelectedTermId,
    activeTermId,
    selectedTerm: contextSelectedTerm,
    activeTerm,
    setSelectedTermId: contextSetSelectedTermId,
    setActiveTermId,
    isLoadingTerms
  } = useAcademicTerm();

  const currentTermId = propSelectedTermId || contextSelectedTermId || activeTermId;
  const effectiveTerm =
    academicTerms.find((t) => t.id === currentTermId) ||
    contextSelectedTerm ||
    activeTerm;

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // STRICT FILTER: Only allow CURRENT and ARCHIVED terms.
  // UPCOMING terms are completely excluded from the switcher.
  const currentTerms = academicTerms.filter((t) => {
    const s = String(t.status || '').trim().toLowerCase();
    return s === 'current' || t.isActive === true;
  });

  const archivedTerms = academicTerms.filter((t) => {
    const s = String(t.status || '').trim().toLowerCase();
    return s === 'archived' && !t.isActive;
  });

  // Selected status normalization
  const currentStatus = String(
    effectiveTerm?.status || (effectiveTerm?.isActive ? 'current' : 'archived')
  )
    .trim()
    .toLowerCase();

  const isCurrent = currentStatus === 'current';

  const badgeStyle = isCurrent
    ? {
        bg: '#ecfdf5',
        border: '#a7f3d0',
        text: '#047857',
        dot: '#10b981',
        label: 'CURRENT'
      }
    : {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        text: '#475569',
        dot: '#64748b',
        label: 'ARCHIVED'
      };

  const handleSelectTerm = (termId) => {
    if (typeof onSelectTerm === 'function') {
      try {
        onSelectTerm(termId);
      } catch (err) {
        console.warn('onSelectTerm callback error:', err);
      }
    }
    if (typeof propSetSelectedTermId === 'function') {
      try {
        propSetSelectedTermId(termId);
      } catch (err) {
        console.warn('propSetSelectedTermId callback error:', err);
      }
    }
    if (typeof contextSetSelectedTermId === 'function') {
      try {
        contextSetSelectedTermId(termId);
      } catch (err) {
        console.warn('contextSetSelectedTermId callback error:', err);
      }
    }
    if (typeof setActiveTermId === 'function') {
      try {
        setActiveTermId(termId);
      } catch (err) {
        console.warn('setActiveTermId callback error:', err);
      }
    }
    setIsOpen(false);
  };

  // Fallback if no terms loaded yet
  if (academicTerms.length === 0 && !isLoadingTerms) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(6, 78, 46, 0.08)',
          border: '1px solid rgba(6, 78, 46, 0.2)',
          padding: '0.35rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: 'var(--rotc-green-dark, #064e2e)'
        }}
      >
        <GraduationCap size={15} color="#059669" />
        <span>AY 2026-2027 • 1st Sem</span>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '9999px',
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0'
          }}
        >
          CURRENT
        </span>
      </div>
    );
  }

  const selectedDisplay = effectiveTerm
    ? `${effectiveTerm.academicYear} • ${effectiveTerm.semester}`
    : 'Select Academic Term';

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      {/* ── Header Pill Button Trigger (Clean, rounded, no native select truncation) ── */}
      <button
        type="button"
        id="global-academic-term-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ffffff',
          border: isOpen ? '1.5px solid #059669' : '1.5px solid #cbd5e1',
          borderRadius: '9999px',
          padding: '0.32rem 0.85rem',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(5, 150, 105, 0.15), 0 1px 3px rgba(0,0,0,0.08)'
            : '0 1px 2px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.18s ease-in-out',
          userSelect: 'none'
        }}
        title="Click to switch Academic Term (filters Command Dashboard, Cadets Roster, and Attendance records)"
      >
        {/* Academic Cap Icon */}
        <GraduationCap size={16} color="var(--rotc-green-dark, #064e2e)" style={{ flexShrink: 0 }} />

        {/* Selected Term Label (Never truncated) */}
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap'
          }}
        >
          {selectedDisplay}
        </span>

        {/* Inline Status Pill Badge (CURRENT / ARCHIVED) */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.65rem',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '9999px',
            background: badgeStyle.bg,
            border: `1px solid ${badgeStyle.border}`,
            color: badgeStyle.text,
            letterSpacing: '0.5px',
            flexShrink: 0
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: badgeStyle.dot
            }}
          />
          {badgeStyle.label}
        </span>

        {/* Animated Chevron Down */}
        <ChevronDown
          size={14}
          color="#64748b"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '2px'
          }}
        />
      </button>

      {/* ── Custom React Popover Menu (No native select styling / truncation) ── */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '320px',
            maxWidth: '380px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
            padding: '0.5rem',
            zIndex: 1050,
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header Note */}
          <div
            style={{
              padding: '6px 10px 8px 10px',
              borderBottom: '1px solid #f1f5f9',
              marginBottom: '4px'
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Switch Academic Term
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '1px' }}>
              Dynamically scopes Command Dashboard, Roster & History
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {/* ── SECTION 1: CURRENT SEMESTER ── */}
            {currentTerms.length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    color: '#059669',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    padding: '6px 10px 4px 10px'
                  }}
                >
                  <CheckCircle2 size={12} color="#059669" />
                  <span>Current Active Formation</span>
                </div>

                {currentTerms.map((t) => {
                  const isSelected = t.id === currentTermId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectTerm(t.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isSelected ? '#ecfdf5' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected ? '#065f46' : '#1e293b'
                          }}
                        >
                          {t.academicYear} • {t.semester}
                        </span>
                        {t.startDate && t.endDate && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {t.startDate} to {t.endDate}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '9999px',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            color: '#047857'
                          }}
                        >
                          CURRENT
                        </span>
                        {isSelected && <Check size={14} color="#059669" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Divider if both sections present */}
            {currentTerms.length > 0 && archivedTerms.length > 0 && (
              <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 6px' }} />
            )}

            {/* ── SECTION 2: ARCHIVED SEMESTERS ── */}
            {archivedTerms.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    color: '#64748b',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    padding: '6px 10px 4px 10px'
                  }}
                >
                  <Archive size={12} color="#64748b" />
                  <span>Archived Historical Records</span>
                </div>

                {archivedTerms.map((t) => {
                  const isSelected = t.id === currentTermId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectTerm(t.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isSelected ? '#f1f5f9' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected ? '#1e293b' : '#334155'
                          }}
                        >
                          {t.academicYear} • {t.semester}
                        </span>
                        {t.startDate && t.endDate && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            {t.startDate} to {t.endDate}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '9999px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#475569'
                          }}
                        >
                          ARCHIVED
                        </span>
                        {isSelected && <Check size={14} color="#475569" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state if no Current or Archived terms */}
            {currentTerms.length === 0 && archivedTerms.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                No active or archived terms found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
