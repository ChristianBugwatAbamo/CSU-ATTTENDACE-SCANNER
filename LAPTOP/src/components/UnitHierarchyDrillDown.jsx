import React from 'react';
import { Users } from 'lucide-react';

export default function UnitHierarchyDrillDown({
  selectedBattalion,
  setSelectedBattalion,
  selectedCompany,
  setSelectedCompany,
  selectedPlatoon,
  setSelectedPlatoon,
}) {
  const battalions = ['1ST BATTALION', '2ND BATTALION'];
  const companies = ['ALPHA COY', 'BRAVO COY', 'CHARLIE COY', 'DELTA COY'];
  const platoons = ['1ST PLATOON', '2ND PLATOON'];

  return (
    <div
      className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs mb-6 space-y-4"
      style={{
        backgroundColor: '#ffffff',
        padding: '1.5rem',
        borderRadius: '1rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      {/* Title Header */}
      <div
        className="flex items-center gap-3 mb-2"
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}
      >
        <div
          className="p-2 bg-emerald-50 text-emerald-800 rounded-xl"
          style={{
            padding: '0.5rem',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Users className="w-5 h-5" size={20} />
        </div>
        <div>
          <h3
            className="text-base font-black text-emerald-950 tracking-tight uppercase"
            style={{
              fontSize: '1rem',
              fontWeight: 900,
              color: '#022c22',
              letterSpacing: '-0.025em',
              textTransform: 'uppercase',
              margin: 0
            }}
          >
            Unit Hierarchy Drill-Down & Cadet Roster
          </h3>
          <p
            className="text-xs font-semibold text-slate-400"
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#94a3b8',
              margin: '2px 0 0 0'
            }}
          >
            Inspect echelon assignments, edit cadet details (Gender, Department, Program, Contact Number), and sync to Supabase
          </p>
        </div>
      </div>

      {/* Row 1: Battalion Selector */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem'
        }}
      >
        {battalions.map((b) => {
          const isSelected = selectedBattalion === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setSelectedBattalion(b)}
              className={`py-3.5 px-6 rounded-xl font-black text-sm tracking-wide transition-all border-2 ${
                isSelected
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-md shadow-emerald-700/20'
                  : 'bg-emerald-50/40 text-emerald-800 border-emerald-600/40 hover:bg-emerald-100/60'
              }`}
              style={{
                padding: '0.875rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: 900,
                fontSize: '0.875rem',
                letterSpacing: '0.025em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: `2px solid ${isSelected ? '#047857' : 'rgba(5, 150, 105, 0.4)'}`,
                backgroundColor: isSelected ? '#047857' : 'rgba(236, 253, 245, 0.4)',
                color: isSelected ? '#ffffff' : '#065f46',
                boxShadow: isSelected ? '0 4px 12px rgba(4, 120, 87, 0.25)' : 'none'
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* Row 2: Company Selector */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem'
        }}
      >
        {companies.map((c) => {
          const isSelected = selectedCompany === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCompany(c)}
              className={`py-3 px-4 rounded-xl font-black text-xs tracking-wider transition-all border-2 ${
                isSelected
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                  : 'bg-emerald-50/30 text-emerald-800 border-emerald-600/40 hover:bg-emerald-100/50'
              }`}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                fontWeight: 900,
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: `2px solid ${isSelected ? '#065f46' : 'rgba(5, 150, 105, 0.4)'}`,
                backgroundColor: isSelected ? '#065f46' : 'rgba(236, 253, 245, 0.3)',
                color: isSelected ? '#ffffff' : '#065f46',
                boxShadow: isSelected ? '0 2px 6px rgba(6, 95, 70, 0.2)' : 'none'
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Row 3: Platoon Selector */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem'
        }}
      >
        {platoons.map((p) => {
          const isSelected = selectedPlatoon === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPlatoon(p)}
              className={`py-3 px-4 rounded-xl font-black text-xs tracking-wider transition-all border-2 ${
                isSelected
                  ? 'bg-emerald-950 text-white border-emerald-950 shadow-sm'
                  : 'bg-emerald-50/30 text-emerald-800 border-emerald-600/40 hover:bg-emerald-100/50'
              }`}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                fontWeight: 900,
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: `2px solid ${isSelected ? '#022c22' : 'rgba(5, 150, 105, 0.4)'}`,
                backgroundColor: isSelected ? '#022c22' : 'rgba(236, 253, 245, 0.3)',
                color: isSelected ? '#ffffff' : '#065f46',
                boxShadow: isSelected ? '0 2px 6px rgba(2, 44, 34, 0.2)' : 'none'
              }}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
