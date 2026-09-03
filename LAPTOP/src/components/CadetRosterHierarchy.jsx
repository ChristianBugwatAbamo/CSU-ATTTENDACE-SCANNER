import React, { useState, useEffect, useCallback } from 'react';
import { supabase, getSupabaseClient } from '../supabaseClient';
import {
  Users,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import CadetRosterTable from './CadetRosterTable';
import IncompleteCadetsWarning from './IncompleteCadetsWarning';
import UnitHierarchyDrillDown from './UnitHierarchyDrillDown';
import EditCadetModal from './EditCadetModal';

export default function CadetRosterHierarchy() {
  const [selectedBattalion, setSelectedBattalion] = useState('1ST BATTALION');
  const [selectedCompany, setSelectedCompany] = useState('ALPHA COY');
  const [selectedPlatoon, setSelectedPlatoon] = useState('1ST PLATOON');
  const [cadets, setCadets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Cadet Edit Modal State
  const [selectedCadet, setSelectedCadet] = useState(null);

  // Fetch cadets when Platoon is selected
  const fetchCadets = useCallback(async () => {
    if (!selectedBattalion || !selectedCompany || !selectedPlatoon) {
      setCadets([]);
      return;
    }

    setLoading(true);
    try {
      const client = getSupabaseClient() || supabase;
      let fetchedCadets = [];

      const bnMatch = (selectedBattalion || '').match(/(\d+)/);
      const bnClean = bnMatch ? bnMatch[1] : (selectedBattalion || '').trim();
      const coClean = (selectedCompany || '').replace(/ COY| COMPANY/i, '').trim();
      const plMatch = (selectedPlatoon || '').match(/(\d+)/);
      const plClean = plMatch ? plMatch[1] : (selectedPlatoon || '').trim();

      if (client) {
        const { data, error } = await client
          .from('cadets')
          .select('*')
          .ilike('battalion', `%${bnClean}%`)
          .ilike('company', `%${coClean}%`)
          .ilike('platoon', `%${plClean}%`)
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          fetchedCadets = data;
        }
      }

      // Fallback to local storage roster if offline or empty
      if (fetchedCadets.length === 0) {
        try {
          const saved = localStorage.getItem('csu_rotc_cadets_roster');
          if (saved) {
            const localCadets = JSON.parse(saved);

            fetchedCadets = localCadets.filter(c => {
              const cBn = String(c.battalion || '').toLowerCase();
              const cCo = String(c.company || '').toLowerCase();
              const cPl = String(c.platoon || '').toLowerCase();
              return cBn.includes(bnClean) &&
                cCo.includes(coClean.toLowerCase()) &&
                cPl.includes(plClean);
            });
          }
        } catch (_) { }
      }

      setCadets(fetchedCadets || []);
    } catch (err) {
      console.error('Failed to fetch platoon cadets:', err);
      setCadets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBattalion, selectedCompany, selectedPlatoon]);

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

  // Open Modal
  const handleEditClick = (cadet) => {
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
      {/* Simplified Unit Hierarchy Drill-Down Selector Container */}
      <UnitHierarchyDrillDown
        selectedBattalion={selectedBattalion}
        setSelectedBattalion={setSelectedBattalion}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        selectedPlatoon={selectedPlatoon}
        setSelectedPlatoon={setSelectedPlatoon}
      />

      {/* CADET ROSTER TABLE */}
      {selectedPlatoon && (
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
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                Enrolled Cadets &bull; {selectedBattalion} &bull; {selectedCompany} &bull; {selectedPlatoon}
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Total: <strong>{filteredCadets.length}</strong> {filteredCadets.length === 1 ? 'cadet' : 'cadets'} in formation view
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
              <RefreshCw size={18} className="spin" style={{ color: '#047857' }} /> Loading platoon roster from Supabase...
            </div>
          ) : (
            <>
              {/* 1. Cadets Roster Data Table */}
              <CadetRosterTable
                cadets={filteredCadets}
                onEditCadet={handleEditClick}
              />

              {/* 2. Incomplete Profile Alert Box */}
              <IncompleteCadetsWarning
                cadets={cadets}
                onEditCadet={handleEditClick}
              />
            </>
          )}
        </div>
      )}

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
