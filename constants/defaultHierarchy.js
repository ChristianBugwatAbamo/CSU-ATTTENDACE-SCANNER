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

export default DEFAULT_UNIT_STRUCTURE;
