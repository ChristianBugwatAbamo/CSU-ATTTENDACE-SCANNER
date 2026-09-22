import React, { useState } from 'react';
import { Shield, Building, Users, Plus, Trash2, Edit2, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import {
  getUnitStructure,
  saveUnitStructure,
  addBattalion,
  addCompany,
  addPlatoon,
  removeBattalion,
  removeCompany,
  removePlatoon
} from '../utils/unitStructure';

// Standard Military Phonetic Alphabet array for automatic Company naming
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
    shortCode: `${n}BN`
  };
}

/**
 * Auto Companies: Maintain a military alphabet array.
 * Determine next available letter across all existing companies so letters never repeat.
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

  const nextLetter = MILITARY_ALPHABET.find(letter => !usedLetters.has(letter));
  const chosenLetter = nextLetter || `Company ${usedLetters.size + 1}`;
  const timestamp = Date.now().toString(36);

  return {
    name: `${chosenLetter} Company`,
    shortCode: chosenLetter.toUpperCase(),
    platoons: [
      { id: `pl-${timestamp}-1`, name: '1st Platoon', shortCode: '1PLTN' },
      { id: `pl-${timestamp}-2`, name: '2nd Platoon', shortCode: '2PLTN' }
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
    shortCode: `${n}PLTN`
  };
}

export default function UnitManagement() {
  const [structure, setStructure] = useState(() => getUnitStructure());
  const [selectedBn, setSelectedBn] = useState(() => structure[0]?.name || '');
  const [selectedCo, setSelectedCo] = useState(() => structure[0]?.companies?.[0]?.name || '');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAutoAddBattalion = () => {
    const autoBn = getAutoBattalionName(structure);
    const updated = addBattalion(autoBn.name, autoBn.shortCode);
    setStructure(updated);
    setSelectedBn(autoBn.name);
    showToast(`Added ${autoBn.name}`);
  };

  const handleAutoAddCompany = () => {
    if (!selectedBn) return;
    const autoCo = getAutoCompanyName(structure);
    const updated = addCompany(selectedBn, autoCo.name, autoCo.shortCode);
    setStructure(updated);
    setSelectedCo(autoCo.name);
    showToast(`Added ${autoCo.name} (2 Platoons default)`);
  };

  const handleAutoAddPlatoon = () => {
    if (!selectedBn || !selectedCo) return;
    const currentBn = structure.find(b => b.name === selectedBn || b.id === selectedBn);
    const currentCo = currentBn?.companies?.find(c => c.name === selectedCo || c.id === selectedCo);
    const autoPl = getAutoPlatoonName(currentCo);
    const updated = addPlatoon(selectedBn, selectedCo, autoPl.name, autoPl.shortCode);
    setStructure(updated);
    showToast(`Added ${autoPl.name}`);
  };

  return (
    <div style={{ padding: '1rem', color: '#fff' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--rotc-gold-bright, #fbbf24)' }}>
        Manage Unit Hierarchy
      </h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <button type="button" onClick={handleAutoAddBattalion} style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700 }}>
          + Add Battalion
        </button>
        <button type="button" onClick={handleAutoAddCompany} disabled={!selectedBn} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700 }}>
          + Add Company
        </button>
        <button type="button" onClick={handleAutoAddPlatoon} disabled={!selectedCo} style={{ padding: '6px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700 }}>
          + Add Platoon
        </button>
      </div>
      {toast && <div style={{ background: '#10b981', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>{toast}</div>}
    </div>
  );
}
