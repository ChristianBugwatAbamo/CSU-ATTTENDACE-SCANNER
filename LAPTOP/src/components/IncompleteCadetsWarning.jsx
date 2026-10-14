import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

export default function IncompleteCadetsWarning({ cadets = [], onEditCadet, isReadOnlyTerm = false }) {
  // Filter cadets missing any essential detail
  const incompleteCadets = cadets.filter((cadet) => {
    const isMissingDept = !cadet.department;
    const isMissingProgram = !cadet.program && !cadet.course && !cadet.degree;
    const isMissingContact = !cadet.contact_number && !cadet.contactNumber;
    const isMissingGender = !cadet.gender;
    const isMissingAddress = !cadet.address && (!cadet.province || !cadet.city || !cadet.barangay);
    const isMissingReligion = !cadet.religion;

    return (
      isMissingDept ||
      isMissingProgram ||
      isMissingContact ||
      isMissingGender ||
      isMissingAddress ||
      isMissingReligion
    );
  });

  // When inspecting an ARCHIVED term, completely hide/unmount the warning banner
  if (isReadOnlyTerm || incompleteCadets.length === 0) return null;

  return (
    <div
      className="mt-6 bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5 shadow-xs transition-all"
      style={{
        marginTop: '1.5rem',
        backgroundColor: 'rgba(254, 243, 199, 0.45)',
        border: '1px solid #fde68a',
        borderRadius: '1rem',
        padding: '1.25rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}
    >
      {/* Header Banner */}
      <div
        className="flex items-center gap-3 mb-3.5 pb-3 border-b border-amber-200/60"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.875rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(253, 230, 138, 0.6)'
        }}
      >
        <div
          className="p-2 bg-amber-500 text-white rounded-xl shadow-sm"
          style={{
            padding: '0.5rem',
            backgroundColor: '#f59e0b',
            color: '#ffffff',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(245, 158, 11, 0.3)'
          }}
        >
          <AlertTriangle className="w-5 h-5" size={20} />
        </div>
        <div>
          <h4
            className="text-sm font-black text-amber-950 uppercase tracking-tight"
            style={{
              fontSize: '0.875rem',
              fontWeight: 900,
              color: '#451a03',
              textTransform: 'uppercase',
              margin: 0,
              letterSpacing: '-0.01em'
            }}
          >
            Action Required: {incompleteCadets.length} Cadet{incompleteCadets.length > 1 ? 's' : ''} Have Incomplete Profiles
          </h4>
          <p
            className="text-xs font-semibold text-amber-800/90"
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#92400e',
              margin: '2px 0 0 0'
            }}
          >
            {isReadOnlyTerm
              ? 'The following cadets are missing critical details. Past records are locked and cannot be edited in an archived semester.'
              : 'The following cadets are missing critical details. Click any item below to update.'}
          </p>
        </div>
      </div>

      {/* Vertical Scroll Container for Action Required Cadets */}
      <div
        className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-xl shadow-xs p-2.5 bg-white/50"
        style={{
          maxHeight: '500px',
          overflowY: 'auto',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          padding: '0.625rem'
        }}
      >
        {/* Grid List of Cadets Needing Update */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.625rem'
          }}
        >
        {incompleteCadets.map((cadet) => {
          // Identify missing attributes
          const missing = [];
          if (!cadet.gender) missing.push('Gender');
          if (!cadet.department) missing.push('Department');
          if (!cadet.program && !cadet.course && !cadet.degree) missing.push('Program');
          if (!cadet.contact_number && !cadet.contactNumber) missing.push('Contact #');
          if (!cadet.address && (!cadet.province || !cadet.city || !cadet.barangay)) missing.push('Address');
          if (!cadet.religion) missing.push('Religion');

          return (
            <div
              key={cadet.id}
              role={isReadOnlyTerm ? undefined : 'button'}
              tabIndex={isReadOnlyTerm ? undefined : 0}
              onClick={isReadOnlyTerm ? undefined : () => onEditCadet({ ...cadet, _highlightMissing: true })}
              onKeyDown={isReadOnlyTerm ? undefined : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEditCadet({ ...cadet, _highlightMissing: true });
                }
              }}
              className={`flex items-center justify-between p-3 rounded-xl transition-all text-left shadow-2xs ${
                isReadOnlyTerm
                  ? 'bg-slate-50/80 border border-slate-200 cursor-default'
                  : 'bg-white hover:bg-amber-100/50 border border-amber-200/80 hover:border-amber-400 group cursor-pointer'
              }`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: isReadOnlyTerm ? '#f8fafc' : '#ffffff',
                border: isReadOnlyTerm ? '1px solid #cbd5e1' : '1px solid rgba(253, 230, 138, 0.8)',
                borderRadius: '0.75rem',
                cursor: isReadOnlyTerm ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => {
                if (!isReadOnlyTerm) {
                  e.currentTarget.style.backgroundColor = 'rgba(254, 243, 199, 0.4)';
                  e.currentTarget.style.borderColor = '#fbbf24';
                }
              }}
              onMouseLeave={(e) => {
                if (!isReadOnlyTerm) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = 'rgba(253, 230, 138, 0.8)';
                }
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    className={`text-xs font-black ${isReadOnlyTerm ? 'text-slate-700' : 'text-slate-800 group-hover:text-amber-950'}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      color: isReadOnlyTerm ? '#334155' : '#1e293b'
                    }}
                  >
                    {cadet.name}
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold text-slate-400"
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#94a3b8'
                    }}
                  >
                    ({cadet.id})
                  </span>
                </div>

                {/* Missing Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {missing.map((item, idx) => (
                    <span
                      key={idx}
                      onClick={isReadOnlyTerm ? undefined : (e) => {
                        e.stopPropagation();
                        onEditCadet({ ...cadet, _highlightMissing: true, focusField: item });
                      }}
                      title={isReadOnlyTerm ? undefined : `Click to edit missing ${item}`}
                      className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border transition-colors ${
                        isReadOnlyTerm
                          ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
                          : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200 cursor-pointer'
                      }`}
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        backgroundColor: isReadOnlyTerm ? '#f1f5f9' : '#ffe4e6',
                        color: isReadOnlyTerm ? '#475569' : '#9f1239',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.375rem',
                        border: isReadOnlyTerm ? '1px solid #cbd5e1' : '1px solid #fecdd3',
                        cursor: isReadOnlyTerm ? 'default' : 'pointer'
                      }}
                    >
                      Missing {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Area: 🔒 Archived Record (Read-Only) badge if archived, else Fix button */}
              {isReadOnlyTerm ? (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#475569',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    marginLeft: '0.5rem'
                  }}
                >
                  🔒 Archived Record (Read-Only)
                </span>
              ) : (
                <div
                  className="flex items-center gap-1 text-amber-700 font-extrabold text-xs group-hover:translate-x-0.5 transition-transform"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: '#b45309',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    marginLeft: '0.5rem',
                    flexShrink: 0
                  }}
                >
                  <span>Fix</span>
                  <ChevronRight className="w-4 h-4" size={16} />
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
