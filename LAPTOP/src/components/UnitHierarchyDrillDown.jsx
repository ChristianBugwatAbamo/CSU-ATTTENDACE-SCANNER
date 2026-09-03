import React from 'react';
import { Users } from 'lucide-react';
import { DEFAULT_UNIT_STRUCTURE } from './AdminSettings';
import { fetchSettingsFromSupabase } from '../utils/supabaseClient';

export default function UnitHierarchyDrillDown({
  selectedBattalion,
  setSelectedBattalion,
  selectedCompany,
  setSelectedCompany,
  selectedPlatoon,
  setSelectedPlatoon,
  unitStructure: propUnitStructure
}) {
  const [localStructure, setLocalStructure] = React.useState(() => {
    try {
      const saved = localStorage.getItem('csu_rotc_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.unit_structure || parsed.unitStructure || null;
      }
    } catch (_) {}
    return null;
  });

  // Sync with cloud settings on mount
  React.useEffect(() => {
    let isMounted = true;
    async function syncCloudStructure() {
      try {
        const sb = await fetchSettingsFromSupabase();
        if (sb && isMounted) {
          const struct = sb.unit_structure || sb.unitStructure;
          if (Array.isArray(struct) && struct.length > 0) {
            setLocalStructure(struct);
          }
        }
      } catch (_) {}
    }
    syncCloudStructure();
    return () => { isMounted = false; };
  }, []);

  React.useEffect(() => {
    const handleUpdate = (e) => {
      const s = e?.detail || (() => {
        try { return JSON.parse(localStorage.getItem('csu_rotc_admin_settings') || '{}'); } catch (_) { return {}; }
      })();
      const struct = s.unit_structure || s.unitStructure;
      if (struct && Array.isArray(struct) && struct.length > 0) {
        setLocalStructure(struct);
      }
    };
    window.addEventListener('csu_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('csu_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const activeStructure = (propUnitStructure && Array.isArray(propUnitStructure) && propUnitStructure.length > 0)
    ? propUnitStructure
    : (localStructure && Array.isArray(localStructure) && localStructure.length > 0 ? localStructure : DEFAULT_UNIT_STRUCTURE);

  const battalions = activeStructure.map(b => (b.name || '').toUpperCase());

  // Clean normalizer for robust string matching
  const cleanStr = (s) => String(s || '').trim().toUpperCase().replace(/ COMPANY$| COY$/i, '');

  // Robust matcher for Battalion identifier or name
  const matchBattalion = (b, sel) => {
    if (!b || !sel) return false;
    const s = String(sel).trim().toUpperCase();
    const bId = String(b.id || '').trim().toUpperCase();
    const bName = String(b.name || '').trim().toUpperCase();
    const bCode = String(b.shortCode || '').trim().toUpperCase();

    if (bId === s || bName === s || bCode === s) return true;

    const getBnNum = (str) => {
      const m = String(str).match(/(?:^|\D)(\d+)(?:ST|ND|RD|TH)?(?:\s*BN|\s*BATTALION)?(?:\D|$)/i);
      return m ? m[1] : null;
    };

    const selNum = getBnNum(s);
    const bNum = getBnNum(bName) || getBnNum(bId) || getBnNum(bCode);
    if (selNum && bNum && selNum === bNum) return true;

    return bName.includes(s) || s.includes(bName);
  };

  // 1. Resolve active battalion object strictly from selection
  let activeBnObj = null;
  if (selectedBattalion) {
    activeBnObj = activeStructure.find((b) => matchBattalion(b, selectedBattalion));
  }

  // Fallback to first battalion for company selector list if none selected
  const displayBnObj = activeBnObj || activeStructure[0] || null;

  // 2. Dynamically extract companies from the currently active Battalion (NO STATIC FALLBACK)
  const companies = (displayBnObj && Array.isArray(displayBnObj.companies) && displayBnObj.companies.length > 0)
    ? displayBnObj.companies.map(c => (c.name || c).toUpperCase().replace(/ COMPANY$/i, ' COY'))
    : [];

  // 3. Resolve active company from displayBnObj.companies
  let activeCoObj = null;
  if (selectedCompany && displayBnObj && Array.isArray(displayBnObj.companies)) {
    const normCo = cleanStr(selectedCompany);
    activeCoObj = displayBnObj.companies.find(
      (c) => String(c.id || '').toUpperCase() === String(selectedCompany).toUpperCase() ||
             cleanStr(c.name) === normCo
    );
  }

  // If no company selected or if selectedCompany does not exist in this battalion,
  // default to the first company of the active battalion so platoons can be displayed
  if (!activeCoObj && displayBnObj && Array.isArray(displayBnObj.companies) && displayBnObj.companies.length > 0) {
    activeCoObj = displayBnObj.companies[0];
  }

  // 4. Dynamically extract platoons from the active company (NO STATIC FALLBACK)
  const platoons = (activeCoObj && Array.isArray(activeCoObj.platoons) && activeCoObj.platoons.length > 0)
    ? activeCoObj.platoons.map(p => (p.name || p).toUpperCase())
    : [];

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
