import {
  DEFAULT_UNIT_STRUCTURE,
  getBattalions,
  getCompaniesForBattalion,
  getPlatoonsForCompany
} from '../SMARTPHONE/src/utils/unitStructure.js';

console.log('Testing SMARTPHONE unitStructure.js exports and functions...');

// Test battalions
const battalions = getBattalions(DEFAULT_UNIT_STRUCTURE);
console.log('Battalions:', battalions);
if (battalions.length !== 4) throw new Error('Expected 4 battalions');

// Test companies for each battalion
const bn1Coys = getCompaniesForBattalion('1st Battalion', DEFAULT_UNIT_STRUCTURE);
console.log('1st Bn Coys:', bn1Coys);
if (bn1Coys.join(',') !== 'Alpha Company,Bravo Company') throw new Error('Mismatch in 1st Bn coys');

const bn2Coys = getCompaniesForBattalion('2nd Battalion', DEFAULT_UNIT_STRUCTURE);
console.log('2nd Bn Coys:', bn2Coys);
if (bn2Coys.join(',') !== 'Charlie Company,Delta Company') throw new Error('Mismatch in 2nd Bn coys');

const bn3Coys = getCompaniesForBattalion('3rd Battalion', DEFAULT_UNIT_STRUCTURE);
console.log('3rd Bn Coys:', bn3Coys);
if (bn3Coys.join(',') !== 'Echo Company,Foxtrot Company') throw new Error('Mismatch in 3rd Bn coys');

const hqCoys = getCompaniesForBattalion('Headquarters', DEFAULT_UNIT_STRUCTURE);
console.log('HQ Coys:', hqCoys);
if (hqCoys.join(',') !== 'Cadet Officer Company,Seventh-day Adventist Company') throw new Error('Mismatch in HQ coys');

// Test platoons
const alphaPlts = getPlatoonsForCompany('1st Battalion', 'Alpha Company', DEFAULT_UNIT_STRUCTURE);
console.log('Alpha Platoons:', alphaPlts);
if (alphaPlts.join(',') !== '1st Platoon,2nd Platoon') throw new Error('Mismatch in Alpha platoons');

const sdaPlts = getPlatoonsForCompany('Headquarters', 'Seventh-day Adventist Company', DEFAULT_UNIT_STRUCTURE);
console.log('SDA Platoons:', sdaPlts);
if (sdaPlts.join(',') !== '1st Platoon,2nd Platoon') throw new Error('Mismatch in SDA platoons');

console.log('\nALL SMARTPHONE UNIT STRUCTURE FUNCTIONS VERIFIED SUCCESSFULLY!');
