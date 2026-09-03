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

export const DEFAULT_UNIT_STRUCTURE = [
  {
    id: 'bn-1',
    name: '1st Battalion',
    shortCode: '1BN',
    companies: [
      {
        id: 'co-1-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        platoons: [
          { id: 'pl-1-a-1', name: '1st Platoon', shortCode: '1PLTN' },
          { id: 'pl-1-a-2', name: '2nd Platoon', shortCode: '2PLTN' },
          { id: 'pl-1-a-3', name: '3rd Platoon', shortCode: '3PLTN' },
          { id: 'pl-1-a-4', name: '4th Platoon', shortCode: '4PLTN' }
        ]
      },
      {
        id: 'co-1-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        platoons: [
          { id: 'pl-1-b-1', name: '1st Platoon', shortCode: '1PLTN' },
          { id: 'pl-1-b-2', name: '2nd Platoon', shortCode: '2PLTN' },
          { id: 'pl-1-b-3', name: '3rd Platoon', shortCode: '3PLTN' },
          { id: 'pl-1-b-4', name: '4th Platoon', shortCode: '4PLTN' }
        ]
      }
    ]
  },
  {
    id: 'bn-2',
    name: '2nd Battalion',
    shortCode: '2BN',
    companies: [
      {
        id: 'co-2-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        platoons: [
          { id: 'pl-2-c-1', name: '1st Platoon', shortCode: '1PLTN' },
          { id: 'pl-2-c-2', name: '2nd Platoon', shortCode: '2PLTN' },
          { id: 'pl-2-c-3', name: '3rd Platoon', shortCode: '3PLTN' },
          { id: 'pl-2-c-4', name: '4th Platoon', shortCode: '4PLTN' }
        ]
      },
      {
        id: 'co-2-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        platoons: [
          { id: 'pl-2-d-1', name: '1st Platoon', shortCode: '1PLTN' },
          { id: 'pl-2-d-2', name: '2nd Platoon', shortCode: '2PLTN' },
          { id: 'pl-2-d-3', name: '3rd Platoon', shortCode: '3PLTN' },
          { id: 'pl-2-d-4', name: '4th Platoon', shortCode: '4PLTN' }
        ]
      }
    ]
  }
];

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
        return struct;
      }
    }
  } catch (_) {}
  // Persist default structure on initial run
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
    return bName === target || bId === target ||
      (target.includes('1') && bName.includes('1')) ||
      (target.includes('2') && bName.includes('2'));
  });

  return bn && Array.isArray(bn.companies) ? bn.companies.map(c => c.name) : [];
}

/**
 * Returns platoon names belonging strictly to the selected company.
 */
export function getPlatoonsForCompany(battalionName, companyName, structure = getUnitStructure()) {
  if (!companyName) return [];
  const targetCoy = norm(companyName).replace(/company|coy|\s+/gi, '');

  const companies = (structure || []).flatMap(b => {
    if (!battalionName) return b.companies || [];
    const bNorm = norm(b.name);
    const targetBn = norm(battalionName);
    if (bNorm === targetBn || (targetBn.includes('1') && bNorm.includes('1')) || (targetBn.includes('2') && bNorm.includes('2'))) {
      return b.companies || [];
    }
    return [];
  });

  const coy = companies.find(c => {
    const cNorm = norm(c.name).replace(/company|coy|\s+/gi, '');
    return cNorm === targetCoy || cNorm.includes(targetCoy) || targetCoy.includes(cNorm);
  });

  if (coy && Array.isArray(coy.platoons) && coy.platoons.length > 0) {
    return coy.platoons.map(p => (typeof p === 'string' ? p : p.name));
  }

  return ['1st Platoon', '2nd Platoon', '3rd Platoon', '4th Platoon'];
}

// =========================================================================
// OFFLINE CRUD OPERATIONS (MANUAL ADD / EDIT / REMOVE)
// =========================================================================

/**
 * Adds a new Battalion locally.
 */
export function addBattalion(name, shortCode = '') {
  if (!name || !name.trim()) return getUnitStructure();
  const current = getUnitStructure();
  const cleanName = name.trim();
  const cleanCode = (shortCode || cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)).toUpperCase();

  const newBattalion = {
    id: 'bn-' + Date.now().toString(36),
    name: cleanName,
    shortCode: cleanCode,
    companies: [
      {
        id: 'co-' + Date.now().toString(36) + '-1',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        platoons: [
          { id: 'pl-' + Date.now().toString(36) + '-1', name: '1st Platoon', shortCode: '1PLTN' },
          { id: 'pl-' + Date.now().toString(36) + '-2', name: '2nd Platoon', shortCode: '2PLTN' }
        ]
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
 * Adds a new Company to a specified Battalion locally.
 */
export function addCompany(bnNameOrId, companyName, shortCode = '') {
  if (!bnNameOrId || !companyName || !companyName.trim()) return getUnitStructure();
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const cleanName = companyName.trim();
  const cleanCode = (shortCode || cleanName.replace(/ company$/i, '')).toUpperCase();

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = b.companies || [];
      const newCompany = {
        id: 'co-' + Date.now().toString(36),
        name: cleanName,
        shortCode: cleanCode,
        platoons: [
          { id: 'pl-' + Date.now().toString(36) + '-1', name: '1st Platoon', shortCode: '1PLTN' },
          { id: 'pl-' + Date.now().toString(36) + '-2', name: '2nd Platoon', shortCode: '2PLTN' }
        ]
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
 */
export function addPlatoon(bnNameOrId, coNameOrId, platoonName, shortCode = '') {
  if (!bnNameOrId || !coNameOrId || !platoonName || !platoonName.trim()) return getUnitStructure();
  const current = getUnitStructure();
  const targetBn = norm(bnNameOrId);
  const targetCo = norm(coNameOrId);
  const cleanName = platoonName.trim();
  const cleanCode = (shortCode || cleanName.replace(/ platoon$/i, 'PL')).toUpperCase();

  const updated = current.map(b => {
    if (norm(b.id) === targetBn || norm(b.name) === targetBn) {
      const companies = (b.companies || []).map(c => {
        if (norm(c.id) === targetCo || norm(c.name) === targetCo) {
          const platoons = c.platoons || [];
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
