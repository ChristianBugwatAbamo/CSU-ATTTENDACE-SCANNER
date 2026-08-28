import React, { useState, useEffect, useCallback } from 'react';
import { supabase, getSupabaseClient } from '../supabaseClient';
import {
  Users,
  RefreshCw,
  Search
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

      const bnClean = (selectedBattalion || '').toLowerCase().includes('2') ? '2' : '1';
      const coClean = (selectedCompany || '').replace(/ COY| COMPANY/i, '').trim();
      const plClean = (selectedPlatoon || '').toLowerCase().includes('2') ? '2' : '1';

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

            {/* Quick Filter Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '240px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search name, ID, contact, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem 0.45rem 2rem',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem',
                    outline: 'none'
                  }}
                />
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
