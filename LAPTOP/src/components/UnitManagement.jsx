import React, { useState, useMemo } from 'react';
import { Shield, Building, Users, Plus, Trash2, Edit2, CheckCircle2, ChevronRight, AlertCircle, Archive, RotateCcw, ShieldAlert, RefreshCw } from 'lucide-react';
import { useUnitStructure } from '../context/UnitContext';
import { checkUnitDependencies, reassignUnitDependencies, softArchiveUnitEchelon, restoreUnitEchelon, fetchSystemWidePlatoonCapacities } from '../utils/supabaseClient';

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
  const [showArchivedUnits, setShowArchivedUnits] = useState(false);

  // Safe Deletion & Soft-Archive Modal State
  const [isEchelonDeleteModalOpen, setIsEchelonDeleteModalOpen] = useState(false);
  const [checkingDeleteUnitId, setCheckingDeleteUnitId] = useState(null);
  const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);
  const [echelonDependencies, setEchelonDependencies] = useState({ cadetCount: 0, logCount: 0, hasDependencies: false, sampleCadets: [] });
  const [echelonDeleteConfig, setEchelonDeleteConfig] = useState({
    level: 'battalion',
    parentId: null,
    parentBnId: null,
    parentCoId: null,
    battalionName: '',
    companyName: '',
    item: { id: '', name: '' }
  });
  const [reassignTargetUnit, setReassignTargetUnit] = useState({
    id: '',
    name: '',
    battalionName: '',
    companyName: '',
    platoonName: '',
    defaultCompanyName: '',
    defaultPlatoonName: ''
  });
  const [isArchivingInProgress, setIsArchivingInProgress] = useState(false);
  const [systemPlatoonCapacities, setSystemPlatoonCapacities] = useState({});

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Active platoons system-wide across all battalions and companies (excluding the echelon being deleted)
  const allActivePlatoonsSystemWide = useMemo(() => {
    const list = [];
    (currentStructure || []).forEach(bn => {
      if (bn.is_archived) return;
      (bn.companies || []).forEach(co => {
        if (co.is_archived) return;
        (co.platoons || []).forEach(pl => {
          if (pl.is_archived) return;
          // Exclude the unit echelon being deleted and its descendants
          if (echelonDeleteConfig.level === 'battalion' && bn.id === echelonDeleteConfig.item?.id) return;
          if (echelonDeleteConfig.level === 'company' && co.id === echelonDeleteConfig.item?.id) return;
          if (echelonDeleteConfig.level === 'platoon' && pl.id === echelonDeleteConfig.item?.id) return;

          const key = `${String(bn.name || '').trim().toLowerCase()}__${String(co.name || '').trim().toLowerCase()}__${String(pl.name || '').trim().toLowerCase()}`;
          const currentCount = systemPlatoonCapacities[pl.id] ?? systemPlatoonCapacities[key] ?? 0;
          const quota = Number(pl.targetQuota) || 37;
          const available = Math.max(0, quota - currentCount);
          const isFull = currentCount >= quota;

          const bnNumMatch = String(bn.name || '').match(/\d+/);
          const bnCode = bn.shortCode || (bnNumMatch ? `${bnNumMatch[0]}BN` : 'BN');
          const coLabel = String(co.name || '').replace(/ Company$/i, ' Coy').replace(/ Coy$/i, ' Coy');
          const label = `[${bnCode} - ${coLabel}] ${pl.name} (${currentCount}/${quota} - ${isFull ? 'FULL' : `${available} Available`})`;

          list.push({
            id: pl.id,
            name: pl.name,
            platoonId: pl.id,
            platoonName: pl.name,
            companyId: co.id,
            companyName: co.name,
            battalionId: bn.id,
            battalionName: bn.name,
            currentCount,
            quota,
            available,
            isFull,
            label
          });
        });
      });
    });
    return list;
  }, [currentStructure, echelonDeleteConfig, systemPlatoonCapacities]);

  // Active Echelon selectors (respects soft-archive state)
  const activeBattalion = useMemo(() => {
    return currentStructure.find(b => b.id === selectedBnId && (!b.is_archived || showArchivedUnits))
      || currentStructure.find(b => !b.is_archived)
      || currentStructure[0]
      || null;
  }, [currentStructure, selectedBnId, showArchivedUnits]);

  const activeCompany = useMemo(() => {
    if (!activeBattalion?.companies) return null;
    return activeBattalion.companies.find(c => c.id === selectedCoId && (!c.is_archived || showArchivedUnits))
      || activeBattalion.companies.find(c => !c.is_archived)
      || activeBattalion.companies[0]
      || null;
  }, [activeBattalion, selectedCoId, showArchivedUnits]);

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

  // =========================================================================
  // SAFE DELETION & SOFT-ARCHIVE WORKFLOW
  // =========================================================================

  const executeDirectArchiveUnit = async (level, item, parentId = null) => {
    let updated = JSON.parse(JSON.stringify(currentStructure));
    const nowIso = new Date().toISOString();

    if (level === 'battalion') {
      const activeRemaining = updated.filter(b => b.id !== item.id && !b.is_archived);
      if (activeRemaining.length === 0) {
        alert('Cannot archive the only remaining active Battalion.');
        return false;
      }
      const bIdx = updated.findIndex(b => b.id === item.id);
      if (bIdx !== -1) {
        updated[bIdx].is_archived = true;
        updated[bIdx].archived_at = nowIso;
      }
      if (selectedBnId === item.id) {
        setSelectedBnId(activeRemaining[0]?.id || '');
        const nextCo = (activeRemaining[0]?.companies || []).find(c => !c.is_archived);
        setSelectedCoId(nextCo?.id || '');
      }
    } else if (level === 'company') {
      const bnIdx = updated.findIndex(b => b.id === (parentId || selectedBnId));
      if (bnIdx !== -1) {
        const bnObj = updated[bnIdx];
        const activeCos = (bnObj.companies || []).filter(c => c.id !== item.id && !c.is_archived);
        if (activeCos.length === 0) {
          alert('Cannot archive the only remaining active Company in this Battalion.');
          return false;
        }
        const cIdx = bnObj.companies.findIndex(c => c.id === item.id);
        if (cIdx !== -1) {
          bnObj.companies[cIdx].is_archived = true;
          bnObj.companies[cIdx].archived_at = nowIso;
        }
        if (selectedCoId === item.id) {
          setSelectedCoId(activeCos[0]?.id || '');
        }
      }
    } else if (level === 'platoon') {
      const bnIdx = updated.findIndex(b => b.id === selectedBnId);
      if (bnIdx !== -1) {
        const coIdx = updated[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
        if (coIdx !== -1) {
          const coObj = updated[bnIdx].companies[coIdx];
          const activePls = (coObj.platoons || []).filter(p => p.id !== item.id && !p.is_archived);
          if (activePls.length === 0) {
            alert('Cannot archive the only remaining active Platoon in this Company.');
            return false;
          }
          const pIdx = coObj.platoons.findIndex(p => p.id === item.id);
          if (pIdx !== -1) {
            coObj.platoons[pIdx].is_archived = true;
            coObj.platoons[pIdx].archived_at = nowIso;
          }
        }
      }
    }

    await softArchiveUnitEchelon({ level, id: item.id, name: item.name });
    updateStructure(updated);
    return true;
  };

  const handleOpenDeleteEchelon = async (level, item, parentId = null) => {
    let parentBn = null;
    let parentCo = null;

    if (level === 'battalion') {
      parentBn = item;
    } else if (level === 'company') {
      parentBn = currentStructure.find(b => b.id === (parentId || selectedBnId));
      parentCo = item;
    } else if (level === 'platoon') {
      parentBn = currentStructure.find(b => b.id === selectedBnId);
      parentCo = parentBn?.companies?.find(c => c.id === (parentId || selectedCoId));
    }

    const bnName = parentBn?.name || '';
    const coName = parentCo?.name || '';

    setCheckingDeleteUnitId(item.id);

    try {
      // 1. Check live dependencies & fetch system-wide capacities in parallel
      const [deps, capacities] = await Promise.all([
        checkUnitDependencies({
          level,
          id: item.id,
          name: item.name,
          battalionName: bnName,
          companyName: coName
        }),
        fetchSystemWidePlatoonCapacities()
      ]);

      if (capacities) {
        setSystemPlatoonCapacities(capacities);
      }

      // 2. If Cadets = 0: Proceed with deletion/archiving directly
      if (!deps || deps.cadetCount === 0) {
        const confirmed = window.confirm(
          `Archive "${item.name}"?\n\n✓ 0 active cadets assigned to this unit.\n\nProceed with direct archiving?`
        );
        if (confirmed) {
          const success = await executeDirectArchiveUnit(level, item, parentId);
          if (success) {
            showToast(`✅ Safely archived ${item.name} (0 active cadets affected).`);
          }
        }
        return;
      }

      // 3. If Cadets > 0: Block deletion and open 'Reassign Cadets First' Modal
      if (level === 'battalion') {
        const remainingBns = currentStructure.filter(b => b.id !== item.id && !b.is_archived);
        const firstTarget = remainingBns[0];
        const firstCo = (firstTarget?.companies || []).find(c => !c.is_archived);
        const firstPl = (firstCo?.platoons || []).find(p => !p.is_archived);
        setReassignTargetUnit({
          id: firstTarget?.id || '',
          name: firstTarget?.name || '',
          battalionId: firstTarget?.id || '',
          battalionName: firstTarget?.name || '',
          companyId: firstCo?.id || '',
          companyName: firstCo?.name || '',
          platoonId: firstPl?.id || '',
          platoonName: firstPl?.name || '',
          defaultCompanyName: firstCo?.name || '',
          defaultCompanyId: firstCo?.id || '',
          defaultPlatoonName: firstPl?.name || '',
          defaultPlatoonId: firstPl?.id || ''
        });
      } else if (level === 'company') {
        const remainingCos = [];
        currentStructure.forEach(b => {
          if (b.is_archived) return;
          (b.companies || []).forEach(c => {
            if (!c.is_archived && c.id !== item.id) {
              remainingCos.push({ ...c, parentBn: b });
            }
          });
        });
        const firstTarget = remainingCos[0];
        const firstPl = (firstTarget?.platoons || []).find(p => !p.is_archived);
        setReassignTargetUnit({
          id: firstTarget?.id || '',
          name: firstTarget?.name || '',
          battalionId: firstTarget?.parentBn?.id || bnName,
          battalionName: firstTarget?.parentBn?.name || bnName,
          companyId: firstTarget?.id || '',
          companyName: firstTarget?.name || '',
          platoonId: firstPl?.id || '',
          platoonName: firstPl?.name || '',
          defaultPlatoonName: firstPl?.name || '',
          defaultPlatoonId: firstPl?.id || ''
        });
      } else if (level === 'platoon') {
        // Collect candidate platoons across ALL Battalions and Companies system-wide
        const candidates = [];
        (currentStructure || []).forEach(b => {
          if (b.is_archived) return;
          (b.companies || []).forEach(c => {
            if (c.is_archived) return;
            (c.platoons || []).forEach(p => {
              if (p.is_archived || p.id === item.id) return;
              const k = `${String(b.name || '').trim().toLowerCase()}__${String(c.name || '').trim().toLowerCase()}__${String(p.name || '').trim().toLowerCase()}`;
              const count = capacities?.[p.id] ?? capacities?.[k] ?? 0;
              const q = Number(p.targetQuota) || 37;
              candidates.push({
                id: p.id,
                name: p.name,
                platoonId: p.id,
                platoonName: p.name,
                companyId: c.id,
                companyName: c.name,
                battalionId: b.id,
                battalionName: b.name,
                isFull: count >= q
              });
            });
          });
        });

        // Automatically default to the first available platoon that is not full
        const firstAvailable = candidates.find(c => !c.isFull) || candidates[0];
        if (firstAvailable) {
          setReassignTargetUnit({
            id: firstAvailable.id,
            name: firstAvailable.name,
            platoonId: firstAvailable.platoonId,
            platoonName: firstAvailable.platoonName,
            companyId: firstAvailable.companyId,
            companyName: firstAvailable.companyName,
            battalionId: firstAvailable.battalionId,
            battalionName: firstAvailable.battalionName
          });
        }
      }

      setEchelonDeleteConfig({
        level,
        item,
        parentId,
        parentBnId: parentBn?.id || null,
        parentCoId: parentCo?.id || null,
        battalionName: bnName,
        companyName: coName
      });
      setEchelonDependencies(deps);
      setIsEchelonDeleteModalOpen(true);
    } catch (err) {
      console.error('Dependency check error:', err);
      alert(`Could not verify active cadets: ${err.message || err}`);
    } finally {
      setCheckingDeleteUnitId(null);
    }
  };

  const handleConfirmDeleteEchelon = async () => {
    const { level, item, parentId, battalionName, companyName } = echelonDeleteConfig;
    if (!reassignTargetUnit.name) {
      alert('Please select an available destination unit before proceeding.');
      return;
    }

    setIsArchivingInProgress(true);

    try {
      // Step 1: Reassign all affected cadets to the chosen target unit in Supabase first
      await reassignUnitDependencies({
        level,
        source: { id: item.id, name: item.name, battalionName, companyName },
        target: reassignTargetUnit
      });

      // Step 2: Safely delete/archive the original unit
      await executeDirectArchiveUnit(level, item, parentId);

      setIsEchelonDeleteModalOpen(false);
      showToast(`✅ Successfully reassigned ${echelonDependencies.cadetCount} cadets to ${reassignTargetUnit.name} and archived ${item.name}.`);
    } catch (err) {
      console.error('Error during reassignment and deletion:', err);
      alert(`Error during reassignment: ${err.message || err}`);
    } finally {
      setIsArchivingInProgress(false);
    }
  };

  const handleRestoreArchivedEchelon = async (level, item, parentId = null) => {
    let updated = JSON.parse(JSON.stringify(currentStructure));
    try {
      if (level === 'battalion') {
        const bIdx = updated.findIndex(b => b.id === item.id);
        if (bIdx !== -1) {
          updated[bIdx].is_archived = false;
          updated[bIdx].archived_at = null;
        }
      } else if (level === 'company') {
        const bnIdx = updated.findIndex(b => b.id === (parentId || selectedBnId));
        if (bnIdx !== -1) {
          const cIdx = updated[bnIdx].companies.findIndex(c => c.id === item.id);
          if (cIdx !== -1) {
            updated[bnIdx].companies[cIdx].is_archived = false;
            updated[bnIdx].companies[cIdx].archived_at = null;
          }
        }
      } else if (level === 'platoon') {
        const bnIdx = updated.findIndex(b => b.id === selectedBnId);
        if (bnIdx !== -1) {
          const coIdx = updated[bnIdx].companies.findIndex(c => c.id === (parentId || selectedCoId));
          if (coIdx !== -1) {
            const pIdx = updated[bnIdx].companies[coIdx].platoons.findIndex(p => p.id === item.id);
            if (pIdx !== -1) {
              updated[bnIdx].companies[coIdx].platoons[pIdx].is_archived = false;
              updated[bnIdx].companies[coIdx].platoons[pIdx].archived_at = null;
            }
          }
        }
      }

      await restoreUnitEchelon({ level, id: item.id, name: item.name });
      updateStructure(updated);
      showToast(`✓ Restored ${item.name} to active roster.`);
    } catch (err) {
      alert(`Error restoring unit: ${err.message || err}`);
    }
  };

  const handleDeleteBattalion = (bnId, bnName) => {
    const bn = currentStructure.find(b => b.id === bnId);
    handleOpenDeleteEchelon('battalion', bn || { id: bnId, name: bnName });
  };

  const handleDeleteCompany = (coId, coName) => {
    const co = activeBattalion?.companies?.find(c => c.id === coId);
    handleOpenDeleteEchelon('company', co || { id: coId, name: coName }, activeBattalion?.id);
  };

  const handleDeletePlatoon = (plId, plName) => {
    const pl = activeCompany?.platoons?.find(p => p.id === plId);
    handleOpenDeleteEchelon('platoon', pl || { id: plId, name: plName }, activeCompany?.id);
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
            Automatic Standard Unit Naming & Safe Soft-Archive Active
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowArchivedUnits(!showArchivedUnits)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: `1px solid ${showArchivedUnits ? '#94a3b8' : '#cbd5e1'}`,
              background: showArchivedUnits ? '#e2e8f0' : '#ffffff',
              color: showArchivedUnits ? '#0f172a' : '#475569',
              cursor: 'pointer'
            }}
          >
            <Archive size={13} color={showArchivedUnits ? '#0f172a' : '#64748b'} />
            {showArchivedUnits ? 'Hide Archived Units' : 'Show Archived Units'}
          </button>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Auto Naming • Soft-Archive Protection
          </span>
        </div>
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
                Battalions ({currentStructure.filter(b => !b.is_archived).length})
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
            {currentStructure.filter(b => showArchivedUnits || !b.is_archived).map((bn, idx) => {
              const isActive = bn.id === activeBattalion?.id;
              const isArchived = Boolean(bn.is_archived);
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
                    border: isArchived ? '1.5px dashed #94a3b8' : `1.5px solid ${isActive ? '#2563eb' : '#e2e8f0'}`,
                    background: isArchived ? '#f1f5f9' : isActive ? '#eff6ff' : '#f8fafc',
                    opacity: isArchived ? 0.78 : 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isArchived ? '#64748b' : isActive ? '#1e40af' : '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{bn.name}</span>
                      {isArchived && (
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {(bn.companies || []).filter(c => !c.is_archived).length} Companies • {bn.shortCode}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {!isArchived ? (
                      <button
                        type="button"
                        disabled={checkingDeleteUnitId === bn.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBattalion(bn.id, bn.name);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: checkingDeleteUnitId === bn.id ? 'wait' : 'pointer', color: '#ef4444', padding: '4px' }}
                        title={`Archive / Safe Delete ${bn.name}`}
                      >
                        {checkingDeleteUnitId === bn.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreArchivedEchelon('battalion', bn);
                        }}
                        style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '3px 6px', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        title={`Restore ${bn.name}`}
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                    )}
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
                Companies in {activeBattalion?.name || 'Battalion'} ({(activeBattalion?.companies || []).filter(c => !c.is_archived).length})
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
            {(activeBattalion?.companies || []).filter(c => showArchivedUnits || !c.is_archived).map((co, idx) => {
              const isActive = co.id === activeCompany?.id;
              const isArchived = Boolean(co.is_archived);
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
                    border: isArchived ? '1.5px dashed #94a3b8' : `1.5px solid ${isActive ? '#059669' : '#e2e8f0'}`,
                    background: isArchived ? '#f1f5f9' : isActive ? '#ecfdf5' : '#f8fafc',
                    opacity: isArchived ? 0.78 : 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isArchived ? '#64748b' : isActive ? '#065f46' : '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{co.name}</span>
                      {isArchived && (
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {(co.platoons || []).filter(p => !p.is_archived).length} Platoons • {co.shortCode}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {!isArchived ? (
                      <button
                        type="button"
                        disabled={checkingDeleteUnitId === co.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(co.id, co.name);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: checkingDeleteUnitId === co.id ? 'wait' : 'pointer', color: '#ef4444', padding: '4px' }}
                        title={`Archive / Safe Delete ${co.name}`}
                      >
                        {checkingDeleteUnitId === co.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreArchivedEchelon('company', co, activeBattalion?.id);
                        }}
                        style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '3px 6px', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        title={`Restore ${co.name}`}
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                    )}
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
                Platoons in {activeCompany?.name || 'Company'} ({(activeCompany?.platoons || []).filter(p => !p.is_archived).length})
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
            {(activeCompany?.platoons || []).filter(p => showArchivedUnits || !p.is_archived).map((pl, idx) => {
              const isArchived = Boolean(pl.is_archived);
              return (
                <div
                  key={pl.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    border: isArchived ? '1.5px dashed #94a3b8' : '1.5px solid #e2e8f0',
                    background: isArchived ? '#f1f5f9' : '#fffbeb',
                    opacity: isArchived ? 0.78 : 1
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isArchived ? '#64748b' : '#78350f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{pl.name}</span>
                      {isArchived && (
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#78350f' }}>
                      Quota: {pl.targetQuota || 37} • {pl.shortCode}
                    </div>
                  </div>
                  {!isArchived ? (
                    <button
                      type="button"
                      disabled={checkingDeleteUnitId === pl.id}
                      onClick={() => handleDeletePlatoon(pl.id, pl.name)}
                      style={{ background: 'transparent', border: 'none', cursor: checkingDeleteUnitId === pl.id ? 'wait' : 'pointer', color: '#ef4444', padding: '4px' }}
                      title={`Archive / Safe Delete ${pl.name}`}
                    >
                      {checkingDeleteUnitId === pl.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRestoreArchivedEchelon('platoon', pl, activeCompany?.id)}
                      style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '3px 6px', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      title={`Restore ${pl.name}`}
                    >
                      <RotateCcw size={11} /> Restore
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          REASSIGN CADETS FIRST (DELETION BLOCKED) MODAL
          ========================================================================= */}
      {isEchelonDeleteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 850,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '540px',
            padding: '2rem',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
            border: '2px solid #ef4444'
          }}>
            {/* Header: DELETION BLOCKED */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1.5px solid #fca5a5'
              }}>
                <ShieldAlert size={30} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    background: '#dc2626',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    DELETION BLOCKED
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700 }}>
                    INTEGRITY ENFORCEMENT
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.02em' }}>
                  REASSIGN CADETS FIRST
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isArchivingInProgress && setIsEchelonDeleteModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isArchivingInProgress ? 'not-allowed' : 'pointer',
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>

            {/* Explanation Warning Banner */}
            <div style={{
              background: '#fff1f2',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid #fecdd3',
              marginBottom: '1.25rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#9f1239', lineHeight: 1.5 }}>
                Deletion of <strong>{echelonDeleteConfig.item?.name}</strong> is blocked because active cadets are currently assigned to it. To prevent orphaned cadets and broken attendance records, reassign all affected cadets to an active destination unit before deletion.
              </p>
            </div>

            {/* Prominent Active Cadet Count Stat Box */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(15, 23, 42, 0.25)'
            }}>
              <div>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 800 }}>
                  TOTAL ACTIVE CADETS ASSIGNED
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1.1, marginTop: '2px', fontFamily: 'Oswald, sans-serif' }}>
                  {echelonDependencies.cadetCount} <span style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 600 }}>Cadet{echelonDependencies.cadetCount === 1 ? '' : 's'}</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
                  Current Unit: <strong>{echelonDeleteConfig.item?.name}</strong> ({echelonDeleteConfig.level?.toUpperCase()})
                </div>
              </div>

              {echelonDependencies.logCount > 0 && (
                <div style={{ textAlign: 'right', borderLeft: '1px solid #334155', paddingLeft: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>ATTENDANCE LOGS</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>{echelonDependencies.logCount}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>will be preserved</div>
                </div>
              )}
            </div>

            {/* Sample Affected Cadets Chips */}
            {echelonDependencies.sampleCadets && echelonDependencies.sampleCadets.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Sample Affected Cadets to be Transferred:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {echelonDependencies.sampleCadets.map((c, i) => (
                    <span key={c.id || i} style={{
                      fontSize: '0.72rem',
                      background: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}>
                      {c.name} {c.rank ? `(${c.rank})` : ''}
                    </span>
                  ))}
                  {echelonDependencies.cadetCount > (echelonDependencies.sampleCadets.length) && (
                    <span style={{ fontSize: '0.72rem', color: '#64748b', alignSelf: 'center', fontWeight: 700 }}>
                      + {echelonDependencies.cadetCount - echelonDependencies.sampleCadets.length} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Destination Unit Dropdown Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: '0.45rem'
              }}>
                SELECT DESTINATION UNIT <span style={{ color: '#ef4444' }}>*</span>
              </label>

              {echelonDeleteConfig.level === 'battalion' && (
                <select
                  value={reassignTargetUnit.id}
                  onChange={(e) => {
                    const targetBn = currentStructure.find(b => b.id === e.target.value);
                    const firstCo = (targetBn?.companies || []).find(c => !c.is_archived);
                    const firstPl = (firstCo?.platoons || []).find(p => !p.is_archived);
                    setReassignTargetUnit({
                      id: targetBn?.id || '',
                      name: targetBn?.name || '',
                      battalionName: targetBn?.name || '',
                      companyName: firstCo?.name || '',
                      platoonName: firstPl?.name || '',
                      defaultCompanyName: firstCo?.name || '',
                      defaultPlatoonName: firstPl?.name || ''
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid #2563eb',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                >
                  {currentStructure.filter(b => b.id !== echelonDeleteConfig.item?.id && !b.is_archived).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.shortCode || 'BN'})
                    </option>
                  ))}
                </select>
              )}

              {echelonDeleteConfig.level === 'company' && (() => {
                const allCos = [];
                (currentStructure || []).forEach(bn => {
                  if (bn.is_archived) return;
                  (bn.companies || []).forEach(co => {
                    if (co.is_archived || co.id === echelonDeleteConfig.item?.id) return;
                    const bnNumMatch = String(bn.name || '').match(/\d+/);
                    const bnCode = bn.shortCode || (bnNumMatch ? `${bnNumMatch[0]}BN` : 'BN');
                    allCos.push({
                      id: co.id,
                      name: co.name,
                      companyId: co.id,
                      companyName: co.name,
                      battalionId: bn.id,
                      battalionName: bn.name,
                      platoons: co.platoons || [],
                      label: `[${bnCode}] ${co.name} (${(co.platoons || []).filter(p => !p.is_archived).length} Platoons)`
                    });
                  });
                });
                return (
                  <select
                    value={reassignTargetUnit.companyId || reassignTargetUnit.id}
                    onChange={(e) => {
                      const targetCo = allCos.find(c => c.id === e.target.value);
                      const firstPl = (targetCo?.platoons || []).find(p => !p.is_archived);
                      setReassignTargetUnit({
                        id: targetCo?.id || '',
                        name: targetCo?.name || '',
                        companyId: targetCo?.id || '',
                        companyName: targetCo?.name || '',
                        battalionId: targetCo?.battalionId || '',
                        battalionName: targetCo?.battalionName || '',
                        platoonId: firstPl?.id || '',
                        platoonName: firstPl?.name || '',
                        defaultPlatoonName: firstPl?.name || '',
                        defaultPlatoonId: firstPl?.id || ''
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '8px',
                      border: '1.5px solid #059669',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    {allCos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                );
              })()}

              {echelonDeleteConfig.level === 'platoon' && (
                <div>
                  <select
                    value={reassignTargetUnit.platoonId || reassignTargetUnit.id}
                    onChange={(e) => {
                      const targetPl = allActivePlatoonsSystemWide.find(p => (p.platoonId || p.id) === e.target.value);
                      if (targetPl) {
                        setReassignTargetUnit({
                          id: targetPl.platoonId,
                          name: targetPl.platoonName,
                          platoonId: targetPl.platoonId,
                          platoonName: targetPl.platoonName,
                          companyId: targetPl.companyId,
                          companyName: targetPl.companyName,
                          battalionId: targetPl.battalionId,
                          battalionName: targetPl.battalionName
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '8px',
                      border: '1.5px solid #2563eb',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    {allActivePlatoonsSystemWide.map(p => (
                      <option
                        key={p.platoonId}
                        value={p.platoonId}
                        disabled={p.isFull}
                        style={{ color: p.isFull ? '#94a3b8' : '#0f172a', fontWeight: p.isFull ? 400 : 600 }}
                      >
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.74rem' }}>
                    <span style={{ color: '#64748b' }}>
                      Target: <strong>{reassignTargetUnit.battalionName} → {reassignTargetUnit.companyName} → {reassignTargetUnit.platoonName}</strong>
                    </span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>
                      {allActivePlatoonsSystemWide.filter(p => !p.isFull).length} of {allActivePlatoonsSystemWide.length} Platoons with open capacity
                    </span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                All {echelonDependencies.cadetCount} cadets will be updated in Supabase to target unit: <strong>{reassignTargetUnit.name || 'Selected Destination'}</strong> before original unit is deleted/archived.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEchelonDeleteModalOpen(false)}
                disabled={isArchivingInProgress}
                style={{ padding: '0.75rem', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteEchelon}
                disabled={isArchivingInProgress || !reassignTargetUnit.name}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: (isArchivingInProgress || !reassignTargetUnit.name) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  opacity: (isArchivingInProgress || !reassignTargetUnit.name) ? 0.7 : 1
                }}
              >
                {isArchivingInProgress ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    <span>Reassigning & Deleting...</span>
                  </>
                ) : (
                  <>
                    <Archive size={17} />
                    <span>Reassign ({echelonDependencies.cadetCount}) & Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


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
