import React from 'react';
import { Edit3, Phone, MapPin, HeartHandshake, UserCheck, Lock } from 'lucide-react';

// Department Color Scheme Mapping
const DEPARTMENT_BADGES = {
  CAA: {
    bg: '#fef3c7',
    text: '#92400e',
    border: '#fcd34d',
    className: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  CCIS: {
    bg: '#ffedd5',
    text: '#9a3412',
    border: '#fdba74',
    className: 'bg-orange-100 text-orange-800 border-orange-300'
  },
  CED: {
    bg: '#dbeafe',
    text: '#1e40af',
    border: '#93c5fd',
    className: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  CEGS: {
    bg: '#4c0519',
    text: '#ffe4e6',
    border: '#881337',
    className: 'bg-rose-950 text-rose-100 border-rose-900'
  },
  CHASS: {
    bg: '#f3e8ff',
    text: '#6b21a8',
    border: '#d8b4fe',
    className: 'bg-purple-100 text-purple-800 border-purple-300'
  },
  CMNS: {
    bg: '#fee2e2',
    text: '#991b1b',
    border: '#fca5a5',
    className: 'bg-red-100 text-red-800 border-red-300'
  },
  COFES: {
    bg: '#d1fae5',
    text: '#065f46',
    border: '#6ee7b7',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  }
};

export function getDepartmentStyle(dept) {
  if (!dept) return null;
  const clean = String(dept).trim().toUpperCase();
  return DEPARTMENT_BADGES[clean] || {
    bg: '#f1f5f9',
    text: '#334155',
    border: '#cbd5e1',
    className: 'bg-slate-100 text-slate-700 border-slate-200'
  };
}


export default function CadetRosterTable({
  cadets = [],
  onEditCadet,
  onReinstateCadet,
  isReadOnlyTerm = false
}) {

  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs"
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff'
      }}
    >
      <table
        className="w-full text-left border-collapse"
        style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
      >
        {/* Table Header */}
        <thead>
          <tr
            className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-wider"
            style={{
              backgroundColor: '#022c22',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <th className="py-3.5 px-4 text-center w-12" style={{ padding: '0.875rem 1rem', textAlign: 'center', width: '3rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>#</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Cadet ID</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Cadet Name</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Gender</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Department</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Academic Program</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Permanent Address</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Religion</th>
            <th className="py-3.5 px-4" style={{ padding: '0.875rem 1rem', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Contact Number</th>
            <th className="py-3.5 px-4 text-center" style={{ padding: '0.875rem 1rem', textAlign: 'center', backgroundColor: '#022c22', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>Action</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-800">
          {cadets.length === 0 ? (
            <tr>
              <td
                colSpan="10"
                className="py-8 text-center text-xs text-slate-400 font-medium"
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  fontStyle: 'normal'
                }}
              >
                No cadets found in this unit section.
              </td>
            </tr>
          ) : (
            cadets.map((cadet, index) => {
              const deptStyle = getDepartmentStyle(cadet.department);
              const fullAddress = [cadet.barangay, cadet.city, cadet.province].filter(Boolean).join(', ') || cadet.address || null;
              const isDropped = cadet.enrollment_status === 'DROPPED' || cadet.status === 'DROPPED' || Boolean(cadet.is_dropped);

              return (
                <tr
                  key={cadet.id || cadet.cadetId || index}
                  className="hover:bg-slate-50/80 transition-colors"
                  style={{
                    borderBottom: index === cadets.length - 1 ? 'none' : '1px solid #f1f5f9',
                    transition: 'background-color 0.15s ease',
                    backgroundColor: isDropped ? 'rgba(254, 242, 242, 0.4)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDropped ? '#fee2e2' : 'rgba(248, 250, 252, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDropped ? 'rgba(254, 242, 242, 0.4)' : 'transparent';
                  }}
                >
                  {/* Row Number */}
                  <td
                    className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400"
                    style={{
                      padding: '0.875rem 1rem',
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#94a3b8'
                    }}
                  >
                    {index + 1}
                  </td>

                  {/* Cadet ID */}
                  <td
                    className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 text-xs"
                    style={{
                      padding: '0.875rem 1rem',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#047857',
                      fontSize: '0.8rem'
                    }}
                  >
                    {cadet.id || cadet.cadetId}
                  </td>

                  {/* Cadet Full Name */}
                  <td
                    className="py-3.5 px-4"
                    style={{
                      padding: '0.875rem 1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}>
                        {cadet.name}
                      </span>
                      {isDropped && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          backgroundColor: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          DROPPED
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Gender */}
                  <td
                    className="py-3.5 px-4 text-xs font-semibold"
                    style={{
                      padding: '0.875rem 1rem',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    {cadet.gender ? (
                      <span
                        className={cadet.gender === 'Female' ? 'text-purple-600' : 'text-blue-600'}
                        style={{
                          color: cadet.gender === 'Female' ? '#9333ea' : '#2563eb',
                          fontWeight: 700
                        }}
                      >
                        {cadet.gender}
                      </span>
                    ) : (
                      <span className="text-slate-300" style={{ color: '#cbd5e1' }}>N/A</span>
                    )}
                  </td>

                  {/* Department */}
                  <td
                    className="py-3.5 px-4 text-xs"
                    style={{
                      padding: '0.875rem 1rem',
                      fontSize: '0.75rem'
                    }}
                  >
                    {cadet.department && deptStyle ? (
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold border ${deptStyle.className}`}
                        style={{
                          backgroundColor: deptStyle.bg,
                          color: deptStyle.text,
                          borderColor: deptStyle.border,
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          display: 'inline-block'
                        }}
                      >
                        {cadet.department}
                      </span>
                    ) : (
                      <span className="text-slate-300" style={{ color: '#cbd5e1' }}>—</span>
                    )}
                  </td>

                  {/* Academic Program Column */}
                  <td
                    className="py-3.5 px-4 text-xs"
                    style={{
                      padding: '0.875rem 1rem',
                      fontSize: '0.75rem',
                      color: '#475569'
                    }}
                  >
                    {cadet.program || cadet.course || cadet.degree ? (
                      <span className="font-semibold text-slate-700" style={{ color: '#334155', fontWeight: 600 }}>
                        {cadet.program || cadet.course || cadet.degree}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal" style={{ color: '#94a3b8' }}>No Program</span>
                    )}
                  </td>

                  {/* Permanent Address Column */}
                  <td
                    className="py-3.5 px-4 text-xs"
                    style={{
                      padding: '0.875rem 1rem',
                      fontSize: '0.75rem',
                      color: '#334155'
                    }}
                  >
                    {fullAddress ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <MapPin size={12} color="#047857" style={{ flexShrink: 0 }} />
                        {fullAddress}
                      </span>
                    ) : (
                      <span className="text-slate-300" style={{ color: '#cbd5e1' }}>—</span>
                    )}
                  </td>

                  {/* Religion Column */}
                  <td
                    className="py-3.5 px-4 text-xs"
                    style={{
                      padding: '0.875rem 1rem',
                      fontSize: '0.75rem'
                    }}
                  >
                    {cadet.religion ? (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#f8fafc',
                          color: '#1e293b',
                          border: '1px solid #cbd5e1',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          display: 'inline-block'
                        }}
                      >
                        {cadet.religion}
                      </span>
                    ) : (
                      <span className="text-slate-300" style={{ color: '#cbd5e1' }}>—</span>
                    )}
                  </td>

                  {/* Contact Number Column */}
                  <td
                    className="py-3.5 px-4 text-xs font-mono"
                    style={{
                      padding: '0.875rem 1rem',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}
                  >
                    {cadet.contact_number || cadet.contactNumber ? (
                      <span
                        className="text-slate-700 font-semibold flex items-center gap-1"
                        style={{
                          color: '#334155',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Phone size={12} className="w-3 h-3 text-slate-400" style={{ color: '#94a3b8' }} />
                        {cadet.contact_number || cadet.contactNumber}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-normal" style={{ color: '#cbd5e1' }}>N/A</span>
                    )}
                  </td>

                  {/* Action Column */}
                  <td
                    className="py-3.5 px-4 text-center"
                    style={{
                      padding: '0.875rem 1rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {/* Re-instate Button (If Cadet is Dropped) */}
                      {isDropped && !isReadOnlyTerm && (
                        <button
                          type="button"
                          onClick={() => onReinstateCadet && onReinstateCadet(cadet)}
                          title="Admin Re-instate Override for Current Semester"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#065f46',
                            backgroundColor: '#d1fae5',
                            border: '1px solid #6ee7b7',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <UserCheck size={13} />
                          <span>Re-instate</span>
                        </button>
                      )}

                      {/* Edit Cadet Details Button */}
                      {!isReadOnlyTerm ? (
                        <button
                          type="button"
                          onClick={() => onEditCadet && onEditCadet(cadet)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-colors"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#047857',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid rgba(167, 243, 208, 0.8)',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#94a3b8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Lock size={12} />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export { CadetRosterTable as CadetsRosterTable };
