import React, { useState, useMemo } from 'react';
import { Shield, Building, Users, Plus, Trash2, Edit2, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { useUnitStructure } from '../context/UnitContext';

// Standard NATO Military Phonetic Alphabet array for automatic Company naming
export const MILITARY_ALPHABET = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
  'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
  'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray',
  'Yankee', 'Zulu'
];

/**
 * Returns ordinal suffix for numbers (1st, 2nd, 3rd, 4th, 11th, etc.)
 */
export function getOrdinalSuffix(n) {
  const num = Math.abs(Number(n) || 1);
  const tens = num % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  const rem = num % 10;
  if (rem === 1) return 'st';
  if (rem === 2) return 'nd';
  if (rem === 3) return 'rd';
  return 'th';
}

/**
 * Auto Battalions: Dynamically compute Nth Battalion where N = total battalions + 1.
 */
export function getAutoBattalionName(unitStructure = []) {
  const totalBattalions = Array.isArray(unitStructure) ? unitStructure.length : 0;
  const n = totalBattalions + 1;
  const suffix = getOrdinalSuffix(n);
  return {
    name: `${n}${suffix} Battalion`,
    shortCode: `${n}BN`,
    targetQuota: 148
  };
}

/**
 * Auto Companies: Maintain a military alphabet array (['Alpha', 'Bravo', ... 'Zulu']).
 * Determine the next available letter across all existing companies so letters never repeat.
 * Sets up 2 platoons by default upon company creation.
 */
export function getAutoCompanyName(unitStructure = []) {
  const usedLetters = new Set();

  if (Array.isArray(unitStructure)) {
    unitStructure.forEach(bn => {
      if (Array.isArray(bn.companies)) {
        bn.companies.forEach(co => {
          const rawName = String(co.name || '').trim().toLowerCase();
          const rawCode = String(co.shortCode || '').trim().toLowerCase();
          MILITARY_ALPHABET.forEach(letter => {
            const lLower = letter.toLowerCase();
            if (rawName.includes(lLower) || rawCode === lLower) {
              usedLetters.add(letter);
            }
          });
        });
      }
    });
  }

  // Determine next unused letter in military alphabet
  const nextLetter = MILITARY_ALPHABET.find(letter => !usedLetters.has(letter));
  const chosenLetter = nextLetter || `Company ${usedLetters.size + 1}`;

  const timestamp = Date.now();
  return {
    name: `${chosenLetter} Company`,
    shortCode: chosenLetter.toUpperCase(),
    targetQuota: 74,
    platoons: [
      {
        id: `pl-${timestamp}-1`,
        name: '1st Platoon',
        shortCode: '1PLTN',
        targetQuota: 37
      },
      {
        id: `pl-${timestamp}-2`,
        name: '2nd Platoon',
        shortCode: '2PLTN',
        targetQuota: 37
      }
    ]
  };
}

/**
 * Auto Platoons: Compute Nth Platoon relative to the selected company.
 */
export function getAutoPlatoonName(selectedCompany) {
  const existingPlatoons = (selectedCompany && Array.isArray(selectedCompany.platoons))
    ? selectedCompany.platoons
    : [];
  const n = existingPlatoons.length + 1;
  const suffix = getOrdinalSuffix(n);
  return {
    name: `${n}${suffix} Platoon`,
    shortCode: `${n}PLTN`,
    targetQuota: 37
  };
}

/**
 * UnitManagement Component:
 * Replaces manual text input prompts for Add Battalion, Add Company, and Add Platoon
 * with automatic standard naming logic.
 */
export default function UnitManagement({
  unitStructure: propUnitStructure,
  onUpdateStructure: propOnUpdateStructure
}) {
  const context = useUnitStructure();
  const currentStructure = propUnitStructure || context?.unitStructure || [];
  const updateStructure = propOnUpdateStructure || context?.updateUnitStructure || (() => {});

  const [selectedBnId, setSelectedBnId] = useState(() => currentStructure[0]?.id || '');
  const [selectedCoId, setSelectedCoId] = useState(() => currentStructure[0]?.companies?.[0]?.id || '');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Active Echelon selectors
  const activeBattalion = useMemo(() => {
    return currentStructure.find(b => b.id === selectedBnId) || currentStructure[0] || null;
  }, [currentStructure, selectedBnId]);

  const activeCompany = useMemo(() => {
    if (!activeBattalion?.companies) return null;
    return activeBattalion.companies.find(c => c.id === selectedCoId) || activeBattalion.companies[0] || null;
  }, [activeBattalion, selectedCoId]);

  // =========================================================================
  // AUTOMATIC STANDARD NAMING ACTIONS (NO TEXT INPUT PROMPTS REQUIRED)
  // =========================================================================

  /**
   * Auto Battalions: Dynamically compute Nth Battalion where N = total battalions + 1.
   */
  const handleAutoAddBattalion = () => {
    const autoBn = getAutoBattalionName(currentStructure);
    const newBn = {
      id: `bn-${Date.now()}`,
      name: autoBn.name,
      shortCode: autoBn.shortCode,
      targetQuota: autoBn.targetQuota,
      companies: []
    };

    // Automatically set up first company with 2 default platoons for the new battalion
    const autoCo = getAutoCompanyName(currentStructure);
    newBn.companies.push({
      id: `co-${Date.now()}-1`,
      name: autoCo.name,
      shortCode: autoCo.shortCode,
      targetQuota: autoCo.targetQuota,
      platoons: autoCo.platoons
    });

    const updated = [...currentStructure, newBn];
    updateStructure(updated);
    setSelectedBnId(newBn.id);
    setSelectedCoId(newBn.companies[0].id);
    showToast(`✅ Created ${autoBn.name} with ${autoCo.name} (2 Platoons)`);
  };

  /**
   * Auto Companies: Maintain military alphabet array.
   * Determine next available letter across all existing companies so letters never repeat.
   * Sets up 2 platoons by default upon company creation.
   */
  const handleAutoAddCompany = () => {
    if (!activeBattalion) {
      showToast('Please select a Battalion first.', 'error');
      return;
    }

    const autoCo = getAutoCompanyName(currentStructure);
    const newCo = {
      id: `co-${Date.now()}`,
      name: autoCo.name,
      shortCode: autoCo.shortCode,
      targetQuota: autoCo.targetQuota,
      platoons: autoCo.platoons
    };

    const updated = currentStructure.map(bn => {
      if (bn.id === activeBattalion.id) {
        const companies = Array.isArray(bn.companies) ? [...bn.companies, newCo] : [newCo];
        return { ...bn, companies };
      }
      return bn;
    });

    updateStructure(updated);
    setSelectedCoId(newCo.id);
    showToast(`✅ Added ${autoCo.name} with 2 default platoons under ${activeBattalion.name}`);
  };

  /**
   * Auto Platoons: Compute Nth Platoon relative to the selected company.
   */
  const handleAutoAddPlatoon = () => {
    if (!activeBattalion || !activeCompany) {
      showToast('Please select a Company first.', 'error');
      return;
    }

    const autoPl = getAutoPlatoonName(activeCompany);
    const newPl = {
      id: `pl-${Date.now()}`,
      name: autoPl.name,
      shortCode: autoPl.shortCode,
      targetQuota: autoPl.targetQuota
    };

    const updated = currentStructure.map(bn => {
      if (bn.id === activeBattalion.id) {
        const companies = (bn.companies || []).map(co => {
          if (co.id === activeCompany.id) {
            const platoons = Array.isArray(co.platoons) ? [...co.platoons, newPl] : [newPl];
            return { ...co, platoons };
          }
          return co;
        });
        return { ...bn, companies };
      }
      return bn;
    });

    updateStructure(updated);
    showToast(`✅ Added ${autoPl.name} under ${activeCompany.name}`);
  };

  /**
   * Remove Battalion
   */
  const handleDeleteBattalion = (bnId, bnName) => {
    if (currentStructure.length <= 1) {
      alert('Cannot remove the only remaining Battalion.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${bnName}?`)) return;

    const updated = currentStructure.filter(b => b.id !== bnId);
    updateStructure(updated);
    if (selectedBnId === bnId) {
      setSelectedBnId(updated[0]?.id || '');
      setSelectedCoId(updated[0]?.companies?.[0]?.id || '');
    }
    showToast(`Removed ${bnName}`);
  };

  /**
   * Remove Company
   */
  const handleDeleteCompany = (coId, coName) => {
    if (!activeBattalion) return;
    if ((activeBattalion.companies || []).length <= 1) {
      alert('Cannot remove the only remaining Company in this Battalion.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${coName}?`)) return;

    const updated = currentStructure.map(bn => {
      if (bn.id === activeBattalion.id) {
        const companies = (bn.companies || []).filter(c => c.id !== coId);
        return { ...bn, companies };
      }
      return bn;
    });

    updateStructure(updated);
    if (selectedCoId === coId) {
      const remainingCo = updated.find(b => b.id === activeBattalion.id)?.companies?.[0];
      setSelectedCoId(remainingCo?.id || '');
    }
    showToast(`Removed ${coName}`);
  };

  /**
   * Remove Platoon
   */
  const handleDeletePlatoon = (plId, plName) => {
    if (!activeBattalion || !activeCompany) return;
    if ((activeCompany.platoons || []).length <= 1) {
      alert('Cannot remove the only remaining Platoon in this Company.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${plName}?`)) return;

    const updated = currentStructure.map(bn => {
      if (bn.id === activeBattalion.id) {
        const companies = (bn.companies || []).map(co => {
          if (co.id === activeCompany.id) {
            const platoons = (co.platoons || []).filter(p => p.id !== plId);
            return { ...co, platoons };
          }
          return co;
        });
        return { ...bn, companies };
      }
      return bn;
    });

    updateStructure(updated);
    showToast(`Removed ${plName}`);
  };

  return (
    <div className="unit-management-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner Alert */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '0.85rem 1.15rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color="#059669" />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
            Automatic Standard Unit Naming Active
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
          Auto Battalions (Nth) • Non-Repeating Military Alphabet Companies • 2 Platoons Default
        </span>
      </div>

      {/* 3-Column Hierarchy Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Column 1: Battalions */}
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} color="#2563eb" />
              <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                Battalions ({currentStructure.length})
              </strong>
            </div>
            <button
              type="button"
              onClick={handleAutoAddBattalion}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
              }}
              title={`Click to automatically add ${getAutoBattalionName(currentStructure).name}`}
            >
              <Plus size={13} /> + Add Battalion
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentStructure.map((bn, idx) => {
              const isActive = bn.id === activeBattalion?.id;
              return (
                <div
                  key={bn.id || idx}
                  onClick={() => {
                    setSelectedBnId(bn.id);
                    if (bn.companies?.[0]) setSelectedCoId(bn.companies[0].id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    border: `1.5px solid ${isActive ? '#2563eb' : '#e2e8f0'}`,
                    background: isActive ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isActive ? '#1e40af' : '#1e293b' }}>
                      {bn.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {bn.companies?.length || 0} Companies • {bn.shortCode}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBattalion(bn.id, bn.name);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                      title={`Remove ${bn.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} color={isActive ? '#2563eb' : '#94a3b8'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Companies */}
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building size={16} color="#059669" />
              <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                Companies in {activeBattalion?.name || 'Battalion'} ({activeBattalion?.companies?.length || 0})
              </strong>
            </div>
            <button
              type="button"
              disabled={!activeBattalion}
              onClick={handleAutoAddCompany}
              style={{
                background: activeBattalion ? 'linear-gradient(135deg, #059669, #047857)' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: activeBattalion ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: activeBattalion ? '0 2px 6px rgba(5,150,105,0.3)' : 'none'
              }}
              title={`Click to automatically add ${getAutoCompanyName(currentStructure).name} with 2 default platoons`}
            >
              <Plus size={13} /> + Add Company
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(activeBattalion?.companies || []).map((co, idx) => {
              const isActive = co.id === activeCompany?.id;
              return (
                <div
                  key={co.id || idx}
                  onClick={() => setSelectedCoId(co.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    border: `1.5px solid ${isActive ? '#059669' : '#e2e8f0'}`,
                    background: isActive ? '#ecfdf5' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isActive ? '#065f46' : '#1e293b' }}>
                      {co.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {co.platoons?.length || 0} Platoons • {co.shortCode}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCompany(co.id, co.name);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                      title={`Remove ${co.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} color={isActive ? '#059669' : '#94a3b8'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Platoons */}
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="#d97706" />
              <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                Platoons in {activeCompany?.name || 'Company'} ({activeCompany?.platoons?.length || 0})
              </strong>
            </div>
            <button
              type="button"
              disabled={!activeCompany}
              onClick={handleAutoAddPlatoon}
              style={{
                background: activeCompany ? 'linear-gradient(135deg, #d97706, #b45309)' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: activeCompany ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: activeCompany ? '0 2px 6px rgba(217,119,6,0.3)' : 'none'
              }}
              title={activeCompany ? `Click to automatically add ${getAutoPlatoonName(activeCompany).name}` : undefined}
            >
              <Plus size={13} /> + Add Platoon
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(activeCompany?.platoons || []).map((pl, idx) => {
              return (
                <div
                  key={pl.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#fffbeb'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#92400e' }}>
                      {pl.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#78350f' }}>
                      Quota: {pl.targetQuota || 37} • {pl.shortCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePlatoon(pl.id, pl.name)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                    title={`Remove ${pl.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Status Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          fontSize: '0.85rem',
          fontWeight: 800,
          background: toastMessage.type === 'error' ? '#ef4444' : '#059669',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999
        }}>
          {toastMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastMessage.message}</span>
        </div>
      )}
    </div>
  );
}
