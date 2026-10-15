import React, { useState, useEffect, useCallback } from 'react';
import { supabase, getSupabaseClient } from '../utils/supabaseClient';
import {
  Users,
  RefreshCw,
  Search,
  X,
  GraduationCap
} from 'lucide-react';
import CadetRosterTable from './CadetRosterTable';
import IncompleteCadetsWarning from './IncompleteCadetsWarning';
import UnitHierarchyDrillDown from './UnitHierarchyDrillDown';
import EditCadetModal from './EditCadetModal';
import { useAcademicTerm } from '../context/AcademicTermContext';

export default function CadetRosterHierarchy() {
  const { selectedTermId, activeTermId, selectedTerm, activeTerm } = useAcademicTerm();
  const currentTermId = selectedTermId || activeTermId;
  const effectiveTerm = selectedTerm || activeTerm;

  const [viewMode, setViewMode] = useState('master'); // 'master' (All Cadets in Term) | 'drilldown' (By Platoon)
  const [selectedBattalion, setSelectedBattalion] = useState('1ST BATTALION');
  const [selectedCompany, setSelectedCompany] = useState('ALPHA COY');
  const [selectedPlatoon, setSelectedPlatoon] = useState('1ST PLATOON');
  const [cadets, setCadets] = useState([]);
  const [totalTermCadetCount, setTotalTermCadetCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Cadet Edit Modal State
  const [selectedCadet, setSelectedCadet] = useState(null);

  // Fetch cadets based on viewMode and selectedTermId
  const fetchCadets = useCallback(async () => {
    setLoading(true);
    try {
      const client = getSupabaseClient() || supabase;
      let fetchedCadets = [];
      let fetchedSuccessfully = false;

      const bnMatch = (selectedBattalion || '').match(/(\d+)/);
      const bnClean = bnMatch ? bnMatch[1] : (selectedBattalion || '').trim();
      const coClean = (selectedCompany || '').replace(/ COY| COMPANY/i, '').trim();
      const plMatch = (selectedPlatoon || '').match(/(\d+)/);
      const plClean = plMatch ? plMatch[1] : (selectedPlatoon || '').trim();

      if (client) {
        // Query read-optimized 3NF database view
        let query = client.from('vw_cadet_master_roster').select('*');

        // Always scope strictly to the selected academic term
        if (currentTermId) {
          query = query.eq('academic_term_id', currentTermId);
        }

        // If in platoon drilldown mode, filter by echelon
        if (viewMode === 'drilldown') {
          if (bnClean) query = query.ilike('battalion', `%${bnClean}%`);
          if (coClean) query = query.ilike('company', `%${coClean}%`);
          if (plClean) query = query.ilike('platoon', `%${plClean}%`);
        }

        let { data, error } = await query.order('name', { ascending: true });

        // Resilient fallback to cadets table if view has not yet been applied
        if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
          let fbQuery = client.from('cadets').select('*');
          if (currentTermId) fbQuery = fbQuery.eq('academic_term_id', currentTermId);
          if (viewMode === 'drilldown') {
            if (bnClean) fbQuery = fbQuery.ilike('battalion', `%${bnClean}%`);
            if (coClean) fbQuery = fbQuery.ilike('company', `%${coClean}%`);
            if (plClean) fbQuery = fbQuery.ilike('platoon', `%${plClean}%`);
          }
          const fbRes = await fbQuery.order('name', { ascending: true });
          data = fbRes.data;
          error = fbRes.error;
        }

        if (!error && Array.isArray(data)) {
          fetchedCadets = data;
          fetchedSuccessfully = true;
          if (viewMode === 'master') {
            setTotalTermCadetCount(data.length);
          }
        }
      }


      // Fallback to local storage roster strictly if offline / network error
      if (!fetchedSuccessfully) {
        try {
          const saved = localStorage.getItem('csu_rotc_cadets_roster');
          if (saved) {
            const localCadets = JSON.parse(saved);

            fetchedCadets = localCadets.filter((c) => {
              if (currentTermId) {
                const tid = c.academic_term_id || c.academicTermId;
                if (String(tid || '') !== String(currentTermId)) return false;
              }
              if (viewMode === 'drilldown') {
                const cBn = String(c.battalion || '').toLowerCase();
                const cCo = String(c.company || '').toLowerCase();
                const cPl = String(c.platoon || '').toLowerCase();
                return (
                  cBn.includes(bnClean.toLowerCase()) &&
                  cCo.includes(coClean.toLowerCase()) &&
                  cPl.includes(plClean.toLowerCase())
                );
              }
              return true;
            });
          }
        } catch (_) {}
      }

      setCadets(fetchedCadets || []);
    } catch (err) {
      console.error('Failed to fetch cadets roster:', err);
      setCadets([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedBattalion, selectedCompany, selectedPlatoon, currentTermId]);

  // Handle Optimistic Cadet Update
  const handleCadetUpdated = useCallback((updatedCadet) => {
    if (updatedCadet) {
      setCadets((prev) =>
        prev.map((c) => {
          const cId = String(c.id || c.cadetId || c.cadet_id || '').toUpperCase();
          const uId = String(updatedCadet.id || updatedCadet.cadetId || updatedCadet.cadet_id || '').toUpperCase();
          if (cId && uId && cId === uId) {
            return { ...c, ...updatedCadet };
          }
          return c;
        })
      );
    }
    fetchCadets();
  }, [fetchCadets]);

  useEffect(() => {
    fetchCadets();

    const handleGlobalCadetUpdate = (e) => {
      if (e.detail) {
        handleCadetUpdated(e.detail);
      }
    };

    window.addEventListener('local-cadet-update', handleGlobalCadetUpdate);
    return () => window.removeEventListener('local-cadet-update', handleGlobalCadetUpdate);
  }, [fetchCadets, handleCadetUpdated]);

  const isReadOnlyTerm = String(effectiveTerm?.status || '').toUpperCase() === 'ARCHIVED';

  // Open Modal (Blocked if archived term is read-only)
  const handleEditClick = (cadet) => {
    if (isReadOnlyTerm) return;
    setSelectedCadet(cadet);
  };

  // Filter cadets by search term
  const filteredCadets = cadets.filter((cadet) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cadet.name && cadet.name.toLowerCase().includes(q)) ||
      (cadet.id && String(cadet.id).toLowerCase().includes(q)) ||
      (cadet.department && cadet.department.toLowerCase().includes(q)) ||
      (cadet.program && cadet.program.toLowerCase().includes(q)) ||
      (cadet.course && cadet.course.toLowerCase().includes(q)) ||
      (cadet.province && cadet.province.toLowerCase().includes(q)) ||
      (cadet.city && cadet.city.toLowerCase().includes(q)) ||
      (cadet.barangay && cadet.barangay.toLowerCase().includes(q)) ||
      (cadet.religion && cadet.religion.toLowerCase().includes(q)) ||
      (cadet.contact_number && String(cadet.contact_number).toLowerCase().includes(q)) ||
      (cadet.contactNumber && String(cadet.contactNumber).toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* View Mode Switcher Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.875rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} color="var(--rotc-green-dark, #064e2e)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {viewMode === 'master' ? 'Master Cadet Roster' : 'Unit Hierarchy Drill-Down'}
          </h3>
          {effectiveTerm && (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: String(effectiveTerm.status || '').toLowerCase() === 'current' ? '#ecfdf5' : '#f1f5f9',
                color: String(effectiveTerm.status || '').toLowerCase() === 'current' ? '#047857' : '#475569',
                border: `1px solid ${String(effectiveTerm.status || '').toLowerCase() === 'current' ? '#a7f3d0' : '#cbd5e1'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <GraduationCap size={12} />
              {effectiveTerm.academicYear} • {effectiveTerm.semester} ({String(effectiveTerm.status || '').toUpperCase()})
            </span>
          )}
        </div>

        {/* Mode Toggle Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setViewMode('master')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: viewMode === 'master' ? 800 : 600,
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'master' ? '#ffffff' : 'transparent',
              color: viewMode === 'master' ? 'var(--rotc-green-dark, #064e2e)' : '#64748b',
              boxShadow: viewMode === 'master' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📋 Master Roster ({totalTermCadetCount || cadets.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('drilldown')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: viewMode === 'drilldown' ? 800 : 600,
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'drilldown' ? '#ffffff' : 'transparent',
              color: viewMode === 'drilldown' ? 'var(--rotc-green-dark, #064e2e)' : '#64748b',
              boxShadow: viewMode === 'drilldown' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            🎖️ Platoon Drill-Down
          </button>
        </div>
      </div>

      {/* Simplified Unit Hierarchy Drill-Down Selector Container */}
      {viewMode === 'drilldown' && (
        <UnitHierarchyDrillDown
          selectedBattalion={selectedBattalion}
          setSelectedBattalion={setSelectedBattalion}
          selectedCompany={selectedCompany}
          setSelectedCompany={setSelectedCompany}
          selectedPlatoon={selectedPlatoon}
          setSelectedPlatoon={setSelectedPlatoon}
        />
      )}

      {/* CADET ROSTER TABLE */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                {viewMode === 'master'
                  ? `Master Cadet Roster (${filteredCadets.length} Cadets Enrolled)`
                  : `Enrolled Cadets • ${selectedBattalion} • ${selectedCompany} • ${selectedPlatoon}`}
              </h4>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Total: <strong>{filteredCadets.length}</strong> {filteredCadets.length === 1 ? 'cadet' : 'cadets'} in view
            </span>
          </div>

            {/* Quick Filter Search - Emphasized & Prominent */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '320px', maxWidth: '440px', flex: '1 1 320px', justifyContent: 'flex-end' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: '0.625rem',
                border: isSearchFocused ? '2px solid #059669' : '2px solid #94a3b8',
                boxShadow: isSearchFocused
                  ? '0 0 0 4px rgba(16, 185, 129, 0.18), 0 2px 6px rgba(0,0,0,0.08)'
                  : '0 2px 5px rgba(15, 23, 42, 0.06)',
                transition: 'all 0.2s ease-in-out'
              }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    color: isSearchFocused ? '#059669' : '#64748b',
                    transition: 'color 0.2s ease'
                  }}
                />
                <input
                  type="text"
                  placeholder="Search name, ID, contact, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 2.2rem 0.6rem 2.4rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '0.625rem',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                    title="Clear search filter"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', padding: '3rem 0', justifyContent: 'center' }}>
              <RefreshCw size={18} className="spin" style={{ color: '#047857' }} /> Loading cadets roster from Supabase...
            </div>
          ) : (
            <>
              {/* 1. Cadets Roster Data Table */}
              <CadetRosterTable
                cadets={filteredCadets}
                onEditCadet={handleEditClick}
                isReadOnlyTerm={isReadOnlyTerm}
              />

              {/* 2. Incomplete Profile Alert Box (Only rendered for CURRENT active term where profile fixes are actionable) */}
              {!isReadOnlyTerm && (
                <IncompleteCadetsWarning
                  cadets={cadets}
                  onEditCadet={handleEditClick}
                  isReadOnlyTerm={isReadOnlyTerm}
                />
              )}
            </>
          )}
        </div>

      {/* EDIT CADET MODAL */}
      <EditCadetModal
        cadet={selectedCadet}
        isOpen={Boolean(selectedCadet)}
        onClose={() => setSelectedCadet(null)}
        onRefresh={handleCadetUpdated}
      />
    </div>
  );
}

export { CadetRosterHierarchy as CadetsRoster };
