import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

export default function IncompleteCadetsWarning({ cadets = [], onEditCadet }) {
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

  if (incompleteCadets.length === 0) return null;

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
            The following cadets are missing critical details. Click any item below to update.
          </p>
        </div>
      </div>

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
            <button
              key={cadet.id}
              type="button"
              onClick={() => onEditCadet({ ...cadet, _highlightMissing: true })}
              className="flex items-center justify-between p-3 bg-white hover:bg-amber-100/50 border border-amber-200/80 hover:border-amber-400 rounded-xl transition-all text-left group shadow-2xs"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(253, 230, 138, 0.8)',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(254, 243, 199, 0.4)';
                e.currentTarget.style.borderColor = '#fbbf24';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(253, 230, 138, 0.8)';
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    className="text-xs font-black text-slate-800 group-hover:text-amber-950"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      color: '#1e293b'
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCadet({ ...cadet, _highlightMissing: true, focusField: item });
                      }}
                      title={`Click to edit missing ${item}`}
                      className="text-[9.5px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md border border-rose-200 hover:bg-rose-200 transition-colors cursor-pointer"
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        backgroundColor: '#ffe4e6',
                        color: '#9f1239',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #fecdd3',
                        cursor: 'pointer'
                      }}
                    >
                      Missing {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Icon */}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
