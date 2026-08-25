import React, { useState, useEffect } from 'react';
import { supabase, getSupabaseClient } from '../supabaseClient';
import { Users, RefreshCw } from 'lucide-react';

export default function CadetRosterHierarchy() {
  const [selectedBattalion, setSelectedBattalion] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPlatoon, setSelectedPlatoon] = useState(null);
  const [cadets, setCadets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch cadets when Platoon is selected
  useEffect(() => {
    if (selectedBattalion && selectedCompany && selectedPlatoon) {
      let isMounted = true;
      async function fetchCadets() {
        setLoading(true);
        try {
          const client = getSupabaseClient() || supabase;
          let fetchedCadets = [];

          if (client) {
            const { data, error } = await client
              .from('cadets')
              .select('*')
              .ilike('battalion', `%${selectedBattalion}%`)
              .ilike('company', `%${selectedCompany}%`)
              .ilike('platoon', `%${selectedPlatoon}%`)
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
                const coClean = (selectedCompany || '').toLowerCase();
                const plClean = (selectedPlatoon || '').toLowerCase();
                const bnClean = (selectedBattalion || '').toLowerCase();

                fetchedCadets = localCadets.filter(c => {
                  const cBn = String(c.battalion || '').toLowerCase();
                  const cCo = String(c.company || '').toLowerCase();
                  const cPl = String(c.platoon || '').toLowerCase();
                  return cBn.includes(bnClean.replace(' battalion', '')) &&
                         cCo.includes(coClean) &&
                         cPl.includes(plClean.replace(' platoon', ''));
                });
              }
            } catch (_) {}
          }

          if (isMounted) {
            setCadets(fetchedCadets || []);
          }
        } catch (err) {
          console.error('Failed to fetch platoon cadets:', err);
          if (isMounted) setCadets([]);
        } finally {
          if (isMounted) setLoading(false);
        }
      }

      fetchCadets();

      return () => {
        isMounted = false;
      };
    } else {
      setCadets([]);
    }
  }, [selectedBattalion, selectedCompany, selectedPlatoon]);

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: '#ffffff',
      borderRadius: '0.75rem',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', borderRadius: '0.5rem', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#064e3b', textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>
            Unit Hierarchy Drill-Down Roster
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
            Navigate through Battalions, Companies, and Platoons to inspect assigned cadets
          </p>
        </div>
      </div>

      {/* LEVEL 1: BATTALIONS */}
      <div>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
          1. Select Battalion
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {['1st Battalion', '2nd Battalion'].map((b) => {
            const isSelected = selectedBattalion === b;
            return (
              <button
                key={b}
                onClick={() => {
                  setSelectedBattalion(b);
                  setSelectedCompany(null);
                  setSelectedPlatoon(null);
                }}
                style={{
                  padding: '1.5rem',
                  border: '2px solid #059669',
                  borderRadius: '0.75rem',
                  fontWeight: 900,
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: isSelected ? '#059669' : 'rgba(236, 253, 245, 0.6)',
                  color: isSelected ? '#ffffff' : '#064e3b',
                  boxShadow: isSelected ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* LEVEL 2: COMPANIES (COY) */}
      {selectedBattalion && (
        <div style={{ paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
            2. Select Company (COY) — {selectedBattalion}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'].map((c) => {
              const isSelected = selectedCompany === c;
              return (
                <button
                  key={c}
                  onClick={() => {
                    setSelectedCompany(c);
                    setSelectedPlatoon(null);
                  }}
                  style={{
                    padding: '1rem',
                    border: `1px solid ${isSelected ? '#059669' : '#34d399'}`,
                    borderRadius: '0.5rem',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isSelected ? '#047857' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#065f46',
                    boxShadow: isSelected ? '0 2px 6px rgba(4, 120, 87, 0.2)' : 'none'
                  }}
                >
                  {c} COY
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LEVEL 3: PLATOONS (PL) */}
      {selectedCompany && (
        <div style={{ paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
            3. Select Platoon (PL) — {selectedCompany} Company
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'].map((p) => {
              const isSelected = selectedPlatoon === p;
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPlatoon(p)}
                  style={{
                    padding: '1rem',
                    border: `1px solid ${isSelected ? '#064e3b' : '#6ee7b7'}`,
                    borderRadius: '0.5rem',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isSelected ? '#064e3b' : 'rgba(236, 253, 245, 0.4)',
                    color: isSelected ? '#ffffff' : '#064e3b',
                    boxShadow: isSelected ? '0 2px 6px rgba(6, 78, 59, 0.25)' : 'none'
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LEVEL 4: CADET ROSTER LIST */}
      {selectedPlatoon && (
        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Enrolled Cadets — {selectedBattalion} | {selectedCompany} COY | {selectedPlatoon}
            </h4>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', backgroundColor: '#ecfdf5', padding: '0.25rem 0.75rem', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
              Total Enrolled: {cadets.length} cadets
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', padding: '1rem 0' }}>
              <RefreshCw size={16} className="spin" /> Loading roster from Supabase...
            </div>
          ) : cadets.length > 0 ? (
            <ol style={{ listStyle: 'none', padding: '0.5rem', margin: 0, backgroundColor: 'rgba(248, 250, 252, 0.7)', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
              {cadets.map((cadet, idx) => (
                <li
                  key={cadet.id || idx}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 800,
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: idx === cadets.length - 1 ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '24px' }}>
                      {idx + 1}.
                    </span>
                    <span>{cadet.name}</span>
                    {cadet.rank && cadet.rank !== 'Cadet' && (
                      <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: '4px', border: '1px solid #a7f3d0', fontWeight: 600 }}>
                        {cadet.rank}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cadet.designation && cadet.designation !== 'N/A' && (
                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
                        {cadet.designation}
                      </span>
                    )}
                    <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      {cadet.id}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#64748b', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', textAlign: 'center', margin: 0, border: '1px dashed #cbd5e1' }}>
              No cadets assigned to {selectedBattalion} - {selectedCompany} COY - {selectedPlatoon} in Supabase.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
