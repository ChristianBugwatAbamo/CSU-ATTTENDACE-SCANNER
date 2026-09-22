/**
 * Centralized Offline Unit Structure for CSU ROTC Smartphone Scanner
 * Stored persistently in localStorage ('csu_rotc_unit_structure') so the mobile scanner
 * operates 100% offline without needing an active internet connection.
 *
 * Supports offline CRUD (Add, Edit, Remove Battalions, Companies, Platoons) with
 * live event dispatching and automatic/manual sync when connected to Laptop Admin HQ.
 */

export const UNIT_STRUCTURE_STORAGE_KEY = 'csu_rotc_unit_structure';
export const UNIT_UPDATE_EVENT = 'csu_smartphone_unit_updated';

export { DEFAULT_UNIT_STRUCTURE, DEFAULT_HIERARCHY, STANDARD_BATTALIONS, STANDARD_COMPANIES, STANDARD_PLATOONS } from '../constants/defaultHierarchy.js';
import { DEFAULT_UNIT_STRUCTURE } from '../constants/defaultHierarchy.js';

// Helper: Normalize string for comparison
const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Loads current unit structure from localStorage, falling back to DEFAULT_UNIT_STRUCTURE.
 */
export function getUnitStructure() {
  try {
    const saved = localStorage.getItem(UNIT_STRUCTURE_STORAGE_KEY) || localStorage.getItem('csu_rotc_admin_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const struct = Array.isArray(parsed) ? parsed : (parsed.unitStructure || parsed.unit_structure);
      if (Array.isArray(struct) && struct.length > 0) {
        // Auto-upgrade if cached structure is the old legacy 2-battalion mock template
        const isLegacyTwoBattalion = struct.length === 2 && !struct.some(b => norm(b.name).includes('headquarters') || norm(b.id).includes('hq'));
        if (!isLegacyTwoBattalion) {
          return struct;
        }
        console.info('[unitStructure] Auto-upgrading legacy 2-battalion structure to standard 4-battalion CSU ROTC layout');
      }
    }
  } catch (_) {}
  // Persist default structure on initial run or upgrade
  saveUnitStructure(DEFAULT_UNIT_STRUCTURE, false);
  return DEFAULT_UNIT_STRUCTURE;
}

/**
 * Saves unit structure to localStorage and dispatches a notification event.
 */
export function saveUnitStructure(structure, dispatchEvent = true) {
  if (!Array.isArray(structure) || structure.length === 0) return structure;
  try {
    localStorage.setItem(UNIT_STRUCTURE_STORAGE_KEY, JSON.stringify(structure));
    // Also keep in admin_settings key if present
    try {
      const adminSettings = JSON.parse(localStorage.getItem('csu_rotc_admin_settings') || '{}');
      adminSettings.unitStructure = structure;
      adminSettings.unit_structure = structure;
      localStorage.setItem('csu_rotc_admin_settings', JSON.stringify(adminSettings));
    } catch (_) {}

    if (dispatchEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNIT_UPDATE_EVENT, { detail: structure }));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (err) {
    console.warn('[unitStructure] Failed to write to localStorage:', err);
  }
  return structure;
}

/**
 * Returns available battalion names.
 */
export function getBattalions(structure = getUnitStructure()) {
  return (structure || []).map(b => b.name);
}

/**
 * Returns company names belonging strictly to the selected battalion.
 */
export function getCompaniesForBattalion(battalionName, structure = getUnitStructure()) {
  if (!battalionName) return [];
  const target = norm(battalionName);

  const bn = (structure || []).find(b => {
    const bName = norm(b.name);
    const bId = norm(b.id);
    if (bName === target || bId === target) return true;
    if (target.includes('headquarters') || target.includes('hq')) {
      return bName.includes('headquarters') || bId.includes('hq');
    }
    const targetDigit = target.match(/\d+/)?.[0];
    const bDigit = bName.match(/\d+/)?.[0];
    if (targetDigit && bDigit && targetDigit === bDigit) return true;
    return false;
  });

  return bn && Array.isArray(bn.companies) ? bn.companies.map(c => c.name) : [];
}

/**
 * Returns platoon names belonging strictly to the selected company.
 */
export function getPlatoonsForCompany(battalionName, companyName, structure = getUnitStructure()) {
  if (!companyName) return [];
  const targetCoy = norm(companyName).replace(/company|coy|\s+/gi, '');

  let candidateBattalions = structure || [];
  if (battalionName) {
    const targetBn = norm(battalionName);
    const targetDigit = targetBn.match(/\d+/)?.[0];
    const isHq = targetBn.includes('headquarters') || targetBn.includes('hq');

    candidateBattalions = candidateBattalions.filter(b => {
      const bNorm = norm(b.name);
      const bId = norm(b.id);
      if (bNorm === targetBn || bId === targetBn) return true;
      if (isHq && (bNorm.includes('headquarters') || bId.includes('hq'))) return true;
      const bDigit = bNorm.match(/\d+/)?.[0];
      return Boolean(targetDigit && bDigit && targetDigit === bDigit);
    });
  }

  const companies = candidateBattalions.flatMap(b => b.companies || []);

  const coy = companies.find(c => {
    const cNorm = norm(c.name).replace(/company|coy|\s+/gi, '');
    return cNorm === targetCoy || cNorm.includes(targetCoy) || targetCoy.includes(cNorm);
  });

  if (coy && Array.isArray(coy.platoons) && coy.platoons.length > 0) {
    return coy.platoons.map(p => (typeof p === 'string' ? p : p.name));
  }

  return ['1st Platoon', '2nd Platoon'];
}

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

// =========================================================================
// OFFLINE CRUD OPERATIONS (AUTO & MANUAL ADD / EDIT / REMOVE)
// =========================================================================

/**
 * Adds a new Battalion locally with automatic standard naming if name is omitted.
 */
export function addBattalion(name = '', shortCode = '') {
  const current = getUnitStructure();
  let cleanName = (name || '').trim();
  let cleanCode = (shortCode || '').trim();

  if (!cleanName) {
    const auto = getAutoBattalionName(current);
    cleanName = auto.name;
    cleanCode = auto.shortCode;
  } else {
    cleanCode = (cleanCode || cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)).toUpperCase();
  }

  const autoCo = getAutoCompanyName(current);

  const newBattalion = {
    id: 'bn-' + Date.now().toString(36),
    name: cleanName,
    shortCode: cleanCode,
    companies: [
      {
        id: 'co-' + Date.now().toString(36) + '-1',
        name: autoCo.name,
        shortCode: autoCo.shortCode,
        platoons: autoCo.platoons
      }
    ]
  };

  const updated = [...current, newBattalion];
  return saveUnitStructure(updated);
}

/**
 * Edits an existing Battalion locally.
 */
export function editBattalion(bnNameOrId, newName, newShortCode = '') {
  if (!bnNameOrId || !newName || !newName.trim()) return getUnitStructure();
  const current = getUnitStructure();
  const target = norm(bnNameOrId);

  const updated = current.map(b => {
    if (norm(b.id) === target || norm(b.name) === target) {
      return {
        ...b,
        name: newName.trim(),
        shortCode: newShortCode ? newShortCode.trim().toUpperCase() : b.shortCode
      };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Removes a Battalion locally (guardrail: minimum 1 remaining).
 */
export function removeBattalion(bnNameOrId) {
  const current = getUnitStructure();
  if (current.length <= 1) {
    throw new Error('Cannot remove the only remaining Battalion.');
  }
  const target = norm(bnNameOrId);
  const updated = current.filter(b => norm(b.id) !== target && norm(b.name) !== target);
  return saveUnitStructure(updated);
}

/**
 * Adds a new Company to a specified Battalion locally with 2 default platoons.
 * If companyName is omitted, automatically computes the next available military alphabet company.
 */
export function addCompany(bnNameOrId, companyName = '', shortCode = '') {
  if (!bnNameOrId) return getUnitStructure();
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);

  let cleanName = (companyName || '').trim();
  let cleanCode = (shortCode || '').trim();
  let platoons = null;

  if (!cleanName) {
    const auto = getAutoCompanyName(current);
    cleanName = auto.name;
    cleanCode = auto.shortCode;
    platoons = auto.platoons;
  } else {
    cleanCode = (cleanCode || cleanName.replace(/ company$/i, '')).toUpperCase();
    const timestamp = Date.now().toString(36);
    platoons = [
      { id: 'pl-' + timestamp + '-1', name: '1st Platoon', shortCode: '1PLTN' },
      { id: 'pl-' + timestamp + '-2', name: '2nd Platoon', shortCode: '2PLTN' }
    ];
  }

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = b.companies || [];
      const newCompany = {
        id: 'co-' + Date.now().toString(36),
        name: cleanName,
        shortCode: cleanCode,
        platoons
      };
      return { ...b, companies: [...companies, newCompany] };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Edits an existing Company locally.
 */
export function editCompany(bnNameOrId, coNameOrId, newName, newShortCode = '') {
  if (!bnNameOrId || !coNameOrId || !newName || !newName.trim()) return getUnitStructure();
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const targetCo = norm(coNameOrId);

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = (b.companies || []).map(c => {
        if (norm(c.id) === targetCo || norm(c.name) === targetCo) {
          return {
            ...c,
            name: newName.trim(),
            shortCode: newShortCode ? newShortCode.trim().toUpperCase() : c.shortCode
          };
        }
        return c;
      });
      return { ...b, companies };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Removes a Company locally (guardrail: minimum 1 company remaining in the battalion).
 */
export function removeCompany(bnNameOrId, coNameOrId) {
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const targetCo = norm(coNameOrId);

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = b.companies || [];
      if (companies.length <= 1) {
        throw new Error('Cannot remove the only remaining Company in this Battalion.');
      }
      return {
        ...b,
        companies: companies.filter(c => norm(c.id) !== targetCo && norm(c.name) !== targetCo)
      };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Adds a new Platoon to a specified Company locally.
 * If platoonName is omitted, automatically computes Nth Platoon relative to the selected company.
 */
export function addPlatoon(bnNameOrId, coNameOrId, platoonName = '', shortCode = '') {
  if (!bnNameOrId || !coNameOrId) return getUnitStructure();
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const targetCo = norm(coNameOrId);

  let cleanName = (platoonName || '').trim();
  let cleanCode = (shortCode || '').trim();

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = (b.companies || []).map(c => {
        if (norm(c.id) === targetCo || norm(c.name) === targetCo) {
          const platoons = c.platoons || [];
          if (!cleanName) {
            const auto = getAutoPlatoonName(c);
            cleanName = auto.name;
            cleanCode = auto.shortCode;
          } else {
            cleanCode = (cleanCode || cleanName.replace(/ platoon$/i, 'PL')).toUpperCase();
          }

          const newPlatoon = {
            id: 'pl-' + Date.now().toString(36),
            name: cleanName,
            shortCode: cleanCode
          };
          return { ...c, platoons: [...platoons, newPlatoon] };
        }
        return c;
      });
      return { ...b, companies };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Edits an existing Platoon locally.
 */
export function editPlatoon(bnNameOrId, coNameOrId, plNameOrId, newName, newShortCode = '') {
  if (!bnNameOrId || !coNameOrId || !plNameOrId || !newName || !newName.trim()) return getUnitStructure();
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const targetCo = norm(coNameOrId);
  const targetPl = norm(plNameOrId);

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = (b.companies || []).map(c => {
        if (norm(c.id) === targetCo || norm(c.name) === targetCo) {
          const platoons = (c.platoons || []).map(p => {
            const pName = typeof p === 'string' ? p : p.name;
            const pId = typeof p === 'string' ? p : p.id;
            if (norm(pId) === targetPl || norm(pName) === targetPl) {
              return {
                ...(typeof p === 'object' ? p : {}),
                id: pId || ('pl-' + Date.now().toString(36)),
                name: newName.trim(),
                shortCode: newShortCode ? newShortCode.trim().toUpperCase() : (p.shortCode || '')
              };
            }
            return p;
          });
          return { ...c, platoons };
        }
        return c;
      });
      return { ...b, companies };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Removes a Platoon locally (guardrail: minimum 1 platoon remaining in the company).
 */
export function removePlatoon(bnNameOrId, coNameOrId, plNameOrId) {
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const targetCo = norm(coNameOrId);
  const targetPl = norm(plNameOrId);

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = (b.companies || []).map(c => {
        if (norm(c.id) === targetCo || norm(c.name) === targetCo) {
          const platoons = c.platoons || [];
          if (platoons.length <= 1) {
            throw new Error('Cannot remove the only remaining Platoon in this Company.');
          }
          const filtered = platoons.filter(p => {
            const pName = typeof p === 'string' ? p : p.name;
            const pId = typeof p === 'string' ? p : p.id;
            return norm(pId) !== targetPl && norm(pName) !== targetPl;
          });
          return { ...c, platoons: filtered };
        }
        return c;
      });
      return { ...b, companies };
    }
    return b;
  });

  return saveUnitStructure(updated);
}

/**
 * Resets local storage back to standard CSU ROTC echelon structure.
 */
export function resetDefaultStructure() {
  return saveUnitStructure(DEFAULT_UNIT_STRUCTURE);
}

/**
 * Synchronizes unit structure from Laptop Admin HQ whenever connected.
 */
export async function syncUnitStructureFromAdmin(adminIp) {
  if (!adminIp) throw new Error('No Admin IP address configured.');
  const endpoint = `${adminIp.replace(/\/$/, '')}/api/settings`;
  const res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Admin server`);

  const data = await res.json();
  const incoming = data.unitStructure || data.unit_structure;
  if (Array.isArray(incoming) && incoming.length > 0) {
    saveUnitStructure(incoming);
    return incoming;
  }
  throw new Error('Admin server returned no unit structure.');
}
