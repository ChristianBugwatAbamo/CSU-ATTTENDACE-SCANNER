import React, { useState, useEffect } from 'react';
import { supabase, getSupabaseClient } from '../supabaseClient';
import {
  Users,
  RefreshCw,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Building,
  GraduationCap,
  User,
  Phone,
  Search
} from 'lucide-react';
import CadetRosterTable from './CadetRosterTable';
import IncompleteCadetsWarning from './IncompleteCadetsWarning';
import UnitHierarchyDrillDown from './UnitHierarchyDrillDown';

export default function CadetRosterHierarchy() {
  const [selectedBattalion, setSelectedBattalion] = useState('1ST BATTALION');
  const [selectedCompany, setSelectedCompany] = useState('ALPHA COY');
  const [selectedPlatoon, setSelectedPlatoon] = useState('1ST PLATOON');
  const [cadets, setCadets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cadet Edit Modal State
  const [selectedCadet, setSelectedCadet] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gender: 'Male',
    department: '',
    program: '',
    contact_number: ''
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Fetch cadets when Platoon is selected
  useEffect(() => {
    if (selectedBattalion && selectedCompany && selectedPlatoon) {
      let isMounted = true;
      async function fetchCadets() {
        setLoading(true);
        try {
          const client = getSupabaseClient() || supabase;
          let fetchedCadets = [];

          const bnClean = (selectedBattalion || '').toLowerCase().includes('2') ? '2' : '1';
          const coClean = (selectedCompany || '').replace(/ COY| COMPANY/i, '').trim();
          const plClean = (selectedPlatoon || '').toLowerCase().includes('4') ? '4'
            : (selectedPlatoon || '').toLowerCase().includes('3') ? '3'
            : (selectedPlatoon || '').toLowerCase().includes('2') ? '2' : '1';

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

  // Open Modal & Populate Form Data
  const handleEditClick = (cadet) => {
    setSelectedCadet(cadet);
    setFormData({
      name: cadet.name || '',
      gender: cadet.gender === 'Female' ? 'Female' : 'Male',
      department: cadet.department || '',
      program: cadet.program || cadet.course || '',
      contact_number: cadet.contact_number || cadet.contactNumber || ''
    });
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Save updated cadet details to Supabase
  const handleSaveCadet = async (e) => {
    e.preventDefault();
    if (!selectedCadet) return;
    setSaving(true);
    setSaveError(null);

    const updates = {
      name: formData.name.trim() || selectedCadet.name,
      gender: formData.gender === 'Female' ? 'Female' : 'Male',
      department: formData.department.trim(),
      program: formData.program.trim(),
      course: formData.program.trim(),
      contact_number: formData.contact_number.trim(),
      rank: selectedCadet.rank || 'Cadet',
      designation: selectedCadet.designation || 'Cadet'
    };

    try {
      const client = getSupabaseClient() || supabase;
      if (client) {
        const { error } = await client
          .from('cadets')
          .update(updates)
          .eq('id', selectedCadet.id);

        if (error) {
          // Check if it's a schema column error
          if (error.message && error.message.includes('schema cache') && (error.message.includes('department') || error.message.includes('gender') || error.message.includes('program'))) {
            // Attempt fallback to base columns so basic edits still succeed
            const baseUpdates = {
              name: updates.name,
              course: updates.program || updates.course || '',
              contact_number: updates.contact_number,
              rank: updates.rank,
              designation: updates.designation
            };
            await client
              .from('cadets')
              .update(baseUpdates)
              .eq('id', selectedCadet.id);

            // Update local state and localStorage with full info
            setCadets((prev) =>
              prev.map((c) => (c.id === selectedCadet.id ? { ...c, ...updates } : c))
            );

            try {
              const saved = localStorage.getItem('csu_rotc_cadets_roster');
              if (saved) {
                const localCadets = JSON.parse(saved);
                const updatedLocal = localCadets.map((c) =>
                  c.id === selectedCadet.id || c.cadetId === selectedCadet.id
                    ? { ...c, ...updates }
                    : c
                );
                localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(updatedLocal));
              }
            } catch (_) { }

            setSaveError("Notice: 'gender', 'department', and 'program' columns do not exist in your Supabase 'cadets' table yet. Please execute the SQL snippet in Supabase SQL Editor. (Saved locally & base fields synced).");
            setSaving(false);
            return;
          }
          throw error;
        }
      }

      // Refresh local list state
      setCadets((prev) =>
        prev.map((c) => (c.id === selectedCadet.id ? { ...c, ...updates } : c))
      );

      // Update localStorage roster if stored
      try {
        const saved = localStorage.getItem('csu_rotc_cadets_roster');
        if (saved) {
          const localCadets = JSON.parse(saved);
          const updatedLocal = localCadets.map((c) =>
            c.id === selectedCadet.id || c.cadetId === selectedCadet.id
              ? { ...c, ...updates }
              : c
          );
          localStorage.setItem('csu_rotc_cadets_roster', JSON.stringify(updatedLocal));
        }
      } catch (_) { }

      setSaveSuccess(true);
      setTimeout(() => {
        setSelectedCadet(null);
        setSaveSuccess(false);
      }, 400);
    } catch (err) {
      console.error('Failed to update cadet:', err);
      setSaveError(err.message || 'Failed to update cadet in Supabase');
    } finally {
      setSaving(false);
    }
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
                  placeholder="Search name, ID, contact, dept..."
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
      {selectedCadet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.875rem',
            maxWidth: '480px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.875rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#064e3b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={18} color="#047857" /> Edit Cadet Details
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ID: <code style={{ fontFamily: 'monospace', fontWeight: 700, color: '#047857' }}>{selectedCadet.id}</code> • {selectedCadet.battalion}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCadet(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error / Success Feedback */}
            {saveError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.8rem' }}>
                <AlertCircle size={16} />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontSize: '0.8rem' }}>
                <CheckCircle2 size={16} />
                <span>Cadet record updated successfully!</span>
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSaveCadet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  required
                  placeholder="e.g. DELA CRUZ, JUAN A."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Gender (Limited strictly to Male and Female) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* DEPARTMENT */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
                  <Building size={14} color="#047857" /> DEPARTMENT
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >

                  {['CAA', 'CCIS', 'CED', 'CEGS', 'CHASS', 'CMNS', 'COFES'].map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  {formData.department && !['CAA', 'CCIS', 'CED', 'CEGS', 'CHASS', 'CMNS', 'COFES'].includes(formData.department) && (
                    <option value={formData.department}>{formData.department}</option>
                  )}
                </select>
              </div>

              {/* ACADEMIC PROGRAM / DEGREE */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
                  <GraduationCap size={14} color="#047857" /> ACADEMIC PROGRAM / DEGREE
                </label>
                <input
                  type="text"
                  placeholder="e.g. BSIT"
                  value={formData.program}
                  onChange={(e) => setFormData({ ...formData, program: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* CONTACT NUMBER */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
                  <Phone size={14} color="#047857" /> Contact Number
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="e.g. 09123456789"
                  value={formData.contact_number}
                  onChange={(e) => {
                    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setFormData({ ...formData, contact_number: numericOnly });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    fontFamily: 'monospace',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCadet(null)}
                  disabled={saving}
                  style={{
                    padding: '0.6rem 1.1rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#64748b',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    backgroundColor: saving ? '#6ee7b7' : '#047857',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(4, 120, 87, 0.3)'
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
