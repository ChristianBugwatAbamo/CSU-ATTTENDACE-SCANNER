import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, X } from 'lucide-react';
import { toDateKey } from '../utils/attendanceRules';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format YYYY-MM-DD into a clean, human-readable date (e.g. "Aug 16, 2026")
 */
export const formatHumanDate = (dateKey) => {
  if (!dateKey) return '';
  try {
    const parts = String(dateKey).trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return dateKey;
  } catch (_) {
    return dateKey;
  }
};

/**
 * FormationCalendarSelector
 * Custom interactive dropdown calendar matching Admin Attendance History.
 * Displays green dot indicators on dates with verified formation drill records,
 * grays out unrecorded dates, and includes a "Jump to Most Recent" quick action.
 */
export default function FormationCalendarSelector({
  selectedDate = '',
  onSelectDate,
  recordedDates = [],
  isLight = true,
  isSessionsLoading = false,
  t,
  fullWidth = false,
  disabled = false,
  placeholder = '',
  allowClear = true,
  legendLabel = 'Formation Recorded'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Normalize recorded dates into a Set of date keys (YYYY-MM-DD)
  const recordedDatesSet = useMemo(() => {
    const set = new Set();
    (recordedDates || []).forEach(d => {
      if (typeof d === 'string') {
        const k = toDateKey(d);
        if (k) set.add(k);
      } else if (d && typeof d === 'object') {
        const k = toDateKey(d.dateKey || d.date || d.session_date);
        if (k) set.add(k);
      }
    });
    return set;
  }, [recordedDates]);

  // Sorted list of recorded formation dates (latest first)
  const sortedRecordedDates = useMemo(() => {
    return Array.from(recordedDatesSet).sort((a, b) => b.localeCompare(a));
  }, [recordedDatesSet]);

  const latestRecordedDate = sortedRecordedDates[0] || '';

  // Active month in the calendar view
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initialKey = selectedDate || latestRecordedDate;
    if (initialKey) {
      const parts = initialKey.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  });

  // When selectedDate changes or calendar is opened, snap calendar view to that month
  useEffect(() => {
    const targetKey = selectedDate || latestRecordedDate;
    if (targetKey) {
      const parts = targetKey.split('-');
      if (parts.length === 3) {
        setCalendarMonth(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
      }
    }
  }, [selectedDate, latestRecordedDate, isOpen]);

  // Click outside listener to dismiss popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

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

  const themeBorder = t?.cardBorder || (isLight ? '#cbd5e1' : '#334155');
  const themeCardBg = t?.cardBg || (isLight ? '#ffffff' : '#0f172a');
  const themeTextMain = t?.textMain || (isLight ? '#0f172a' : '#f8fafc');
  const themeTextMuted = t?.textMuted || (isLight ? '#64748b' : '#94a3b8');

  return (
    <div style={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block', width: fullWidth ? '100%' : 'auto' }}>
      {/* Interactive Calendar Popover Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(prev => !prev);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: fullWidth ? 'space-between' : 'flex-start',
          width: fullWidth ? '100%' : 'auto',
          boxSizing: 'border-box',
          gap: '7px',
          padding: fullWidth ? '0.62rem 0.85rem' : '0.42rem 0.8rem',
          fontSize: fullWidth ? '0.86rem' : '0.78rem',
          fontWeight: 700,
          borderRadius: '8px',
          border: isOpen ? '1.5px solid #064e2e' : `1px solid ${selectedDate ? '#059669' : themeBorder}`,
          background: isOpen
            ? (isLight ? '#ecfdf5' : 'rgba(6, 78, 46, 0.25)')
            : selectedDate
              ? (isLight ? '#f0fdf4' : 'rgba(5, 150, 105, 0.15)')
              : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)'),
          color: selectedDate
            ? (isLight ? '#065f46' : '#34d399')
            : themeTextMain,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap'
        }}
        title={disabled ? 'Date selection disabled' : 'Open interactive formation calendar'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
          <CalendarDays size={16} color={isLight ? '#064e2e' : '#34d399'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isSessionsLoading
              ? 'Loading Sessions...'
              : (selectedDate ? formatHumanDate(selectedDate) : (placeholder || (fullWidth ? 'Select Formation Date' : 'Calendar Selector')))}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isSessionsLoading ? (
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <ChevronDown
              size={13}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
                flexShrink: 0
              }}
            />
          )}

          {/* Quick Clear Button on Trigger */}
          {allowClear && !disabled && selectedDate && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onSelectDate('');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1px 3px',
                borderRadius: '4px',
                marginLeft: '2px',
                color: themeTextMuted,
                cursor: 'pointer',
                lineHeight: 1
              }}
              title="Clear date filter"
            >
              <X size={12} />
            </span>
          )}
        </div>
      </button>

      {/* Custom Restricted Calendar Dropdown: Centered on Mobile (fixed inset-0 with backdrop), Dropdown on Desktop */}
      {isOpen && (
        <div
          className="formation-calendar-overlay fixed inset-0 sm:absolute sm:inset-auto z-50 z-[60] z-60"
          style={{ zIndex: 60 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            ref={popoverRef}
            className="formation-calendar-popover z-50 z-[60] z-60 right-0 sm:right-0 md:right-0"
            style={{
              zIndex: 60,
              background: themeCardBg,
              borderRadius: '12px',
              boxShadow: isLight
                ? '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.15)'
                : '0 20px 40px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${themeBorder}`,
              padding: '1rem',
              animation: 'fadeIn 0.15s ease'
            }}
          >
            {/* Calendar Header with Month Navigation & Mobile Close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={handlePrevCalMonth}
                style={{
                  background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: themeTextMain
                }}
                title="Previous Month"
              >
                <ChevronLeft size={15} />
              </button>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isLight ? '#064e2e' : '#34d399' }}>
                {MONTH_NAMES[calMonth]} {calYear}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={handleNextCalMonth}
                  style={{
                    background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: themeTextMain
                  }}
                  title="Next Month"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  className="mobile-cal-close-btn"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: themeTextMuted
                  }}
                  title="Close Calendar"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

          {/* Day of Week Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <div
                key={i}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: i === 0 || i === 6 ? '#059669' : themeTextMuted
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid: ONLY recorded dates are selectable; non-formation dates disabled/grayed out */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Empty padding slots before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} style={{ height: '34px' }} />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInCalMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isRecorded = recordedDatesSet.has(dayKey);
              const isSelected = selectedDate === dayKey;

              if (isRecorded) {
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => {
                      onSelectDate(dayKey);
                      setIsOpen(false);
                    }}
                    style={{
                      height: '34px',
                      borderRadius: '7px',
                      border: isSelected ? '2px solid #064e2e' : '1px solid #10b981',
                      background: isSelected ? '#064e2e' : (isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)'),
                      color: isSelected ? '#ffffff' : (isLight ? '#065f46' : '#34d399'),
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
                    title={`Recorded Formation: ${formatHumanDate(dayKey)}`}
                  >
                    <span>{dayNum}</span>
                    {/* Green dot indicator matching Admin Attendance History */}
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
                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                    color: isLight ? '#cbd5e1' : '#475569',
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
          <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: `1px solid ${isLight ? '#f1f5f9' : '#334155'}`, fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: themeTextMuted, marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
                <span style={{ color: isLight ? '#065f46' : '#34d399', fontWeight: 600 }}>{legendLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLight ? '#cbd5e1' : '#475569' }} />
                <span>Unavailable</span>
              </div>
            </div>

            {/* Jump to Most Recent Button */}
            {latestRecordedDate && (
              <button
                type="button"
                onClick={() => {
                  onSelectDate(latestRecordedDate);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '5px 8px',
                  background: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.3)'}`,
                  borderRadius: '6px',
                  color: isLight ? '#15803d' : '#4ade80',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'background-color 0.15s ease'
                }}
              >
                ⚡ Jump to Most Recent ({formatHumanDate(latestRecordedDate)})
              </button>
            )}

            {/* Clear Filter / Show All Option */}
            {allowClear && selectedDate && (
              <button
                type="button"
                onClick={() => {
                  onSelectDate('');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  marginTop: '5px',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: `1px dashed ${isLight ? '#cbd5e1' : '#475569'}`,
                  borderRadius: '6px',
                  color: themeTextMuted,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
              >
                Show All Formations
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);
}
