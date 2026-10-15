/**
 * Standard Unit Hierarchy Definition for CSU ROTC
 *
 * Summary of Standard Unit Layout:
 * - 4 Battalions: 1st Battalion, 2nd Battalion, 3rd Battalion, Headquarters
 * - 8 Companies: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Cadet Officer, Seventh-day Adventist
 * - 16 Platoons: 1st Platoon & 2nd Platoon in every company (37 Cadets Quota each)
 */

export const DEFAULT_UNIT_STRUCTURE = [
  // 1. 1st Battalion
  {
    id: 'bn-1',
    name: '1st Battalion',
    shortCode: '1BN',
    targetQuota: 148,
    companies: [
      {
        id: 'co-1-alpha',
        name: 'Alpha Company',
        shortCode: 'ALPHA',
        targetQuota: 74,
        platoons: [
          { id: 'pl-1-a-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-a-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-1-bravo',
        name: 'Bravo Company',
        shortCode: 'BRAVO',
        targetQuota: 74,
        platoons: [
          { id: 'pl-1-b-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-1-b-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      }
    ]
  },

  // 2. 2nd Battalion
  {
    id: 'bn-2',
    name: '2nd Battalion',
    shortCode: '2BN',
    targetQuota: 148,
    companies: [
      {
        id: 'co-2-charlie',
        name: 'Charlie Company',
        shortCode: 'CHARLIE',
        targetQuota: 74,
        platoons: [
          { id: 'pl-2-c-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-c-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-2-delta',
        name: 'Delta Company',
        shortCode: 'DELTA',
        targetQuota: 74,
        platoons: [
          { id: 'pl-2-d-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-2-d-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      }
    ]
  },

  // 3. 3rd Battalion
  {
    id: 'bn-3',
    name: '3rd Battalion',
    shortCode: '3BN',
    targetQuota: 148,
    companies: [
      {
        id: 'co-3-echo',
        name: 'Echo Company',
        shortCode: 'ECHO',
        targetQuota: 74,
        platoons: [
          { id: 'pl-3-e-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-3-e-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-3-foxtrot',
        name: 'Foxtrot Company',
        shortCode: 'FOXTROT',
        targetQuota: 74,
        platoons: [
          { id: 'pl-3-f-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-3-f-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      }
    ]
  },

  // 4. Headquarters
  {
    id: 'bn-hq',
    name: 'Headquarters',
    shortCode: 'HQ',
    targetQuota: 148,
    companies: [
      {
        id: 'co-hq-co',
        name: 'Cadet Officer Company',
        shortCode: 'CO',
        targetQuota: 74,
        platoons: [
          { id: 'pl-hq-co-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-hq-co-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      },
      {
        id: 'co-hq-sda',
        name: 'Seventh-day Adventist Company',
        shortCode: 'SDA',
        targetQuota: 74,
        platoons: [
          { id: 'pl-hq-sda-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
          { id: 'pl-hq-sda-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 }
        ]
      }
    ]
  }
];

export const DEFAULT_HIERARCHY = DEFAULT_UNIT_STRUCTURE;

export const STANDARD_BATTALIONS = [
  '1st Battalion',
  '2nd Battalion',
  '3rd Battalion',
  'Headquarters'
];

export const STANDARD_COMPANIES = [
  'Alpha Company',
  'Bravo Company',
  'Charlie Company',
  'Delta Company',
  'Echo Company',
  'Foxtrot Company',
  'Cadet Officer Company',
  'Seventh-day Adventist Company'
];

export const STANDARD_PLATOONS = [
  '1st Platoon',
  '2nd Platoon'
];

/**
 * Resolves a platoon standard code from battalion, company, and platoon strings.
 */
export function resolvePlatoonCode(battalion, company, platoon) {
  const b = String(battalion || '').toLowerCase();
  const c = String(company || '').toLowerCase();
  const p = String(platoon || '').toLowerCase();
  const is2nd = p.includes('2');

  if (c.includes('seventh') || c.includes('sda')) {
    return is2nd ? 'HQ-SDA-2PLTN' : 'HQ-SDA-1PLTN';
  }
  if (c.includes('officer') || c.includes('cadet officer')) {
    return is2nd ? 'HQ-CO-2PLTN' : 'HQ-CO-1PLTN';
  }
  if (c.includes('alpha')) {
    return is2nd ? '1BN-ALPHA-2PLTN' : '1BN-ALPHA-1PLTN';
  }
  if (c.includes('bravo')) {
    return is2nd ? '1BN-BRAVO-2PLTN' : '1BN-BRAVO-1PLTN';
  }
  if (c.includes('charlie')) {
    return is2nd ? '2BN-CHARLIE-2PLTN' : '2BN-CHARLIE-1PLTN';
  }
  if (c.includes('delta')) {
    return is2nd ? '2BN-DELTA-2PLTN' : '2BN-DELTA-1PLTN';
  }
  if (c.includes('echo')) {
    return is2nd ? '3BN-ECHO-2PLTN' : '3BN-ECHO-1PLTN';
  }
  if (c.includes('foxtrot')) {
    return is2nd ? '3BN-FOXTROT-2PLTN' : '3BN-FOXTROT-1PLTN';
  }

  // Battalion-based fallback
  if (b.includes('hq') || b.includes('headquarters')) {
    return is2nd ? 'HQ-SDA-2PLTN' : 'HQ-SDA-1PLTN';
  }
  if (b.includes('2')) {
    return is2nd ? '2BN-CHARLIE-2PLTN' : '2BN-CHARLIE-1PLTN';
  }
  if (b.includes('3')) {
    return is2nd ? '3BN-ECHO-2PLTN' : '3BN-ECHO-1PLTN';
  }

  return is2nd ? '1BN-ALPHA-2PLTN' : '1BN-ALPHA-1PLTN';
}

/**
 * Resolves standard course code from string.
 */
export function resolveCourseCode(course) {
  return String(course || '').trim().toUpperCase() || 'BSIT';
}

/**
 * Helper to check if a string is a valid UUID
 */
export function isValidUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

// In-memory cache for database UUIDs
let cachedPlatoonsMap = null;
let cachedCoursesMap = null;

export async function getPlatoonUuid(client, battalion, company, platoon) {
  const code = resolvePlatoonCode(battalion, company, platoon);
  if (!cachedPlatoonsMap && client) {
    try {
      const { data } = await client.from('platoons').select('id, code');
      if (Array.isArray(data)) {
        cachedPlatoonsMap = new Map();
        data.forEach(p => cachedPlatoonsMap.set(p.code, p.id));
      }
    } catch (_) {}
  }
  return cachedPlatoonsMap?.get(code) || null;
}

export async function getCourseUuid(client, course) {
  const code = resolveCourseCode(course);
  if (!cachedCoursesMap && client) {
    try {
      const { data } = await client.from('academic_courses').select('id, code');
      if (Array.isArray(data)) {
        cachedCoursesMap = new Map();
        data.forEach(c => cachedCoursesMap.set(c.code, c.id));
      }
    } catch (_) {}
  }
  return cachedCoursesMap?.get(code) || null;
}


export default DEFAULT_UNIT_STRUCTURE;

