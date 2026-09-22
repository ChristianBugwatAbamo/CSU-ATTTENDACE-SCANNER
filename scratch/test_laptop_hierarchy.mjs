import {
  DEFAULT_UNIT_STRUCTURE,
  DEFAULT_HIERARCHY,
  STANDARD_BATTALIONS,
  STANDARD_COMPANIES,
  STANDARD_PLATOONS
} from '../LAPTOP/src/constants/defaultHierarchy.js';

console.log('Testing LAPTOP defaultHierarchy.js...');
if (DEFAULT_UNIT_STRUCTURE.length !== 4) throw new Error('Battalion count mismatch');
if (STANDARD_BATTALIONS.length !== 4) throw new Error('STANDARD_BATTALIONS count mismatch');
if (STANDARD_COMPANIES.length !== 8) throw new Error('STANDARD_COMPANIES count mismatch');
if (STANDARD_PLATOONS.length !== 2) throw new Error('STANDARD_PLATOONS count mismatch');
console.log('LAPTOP hierarchy exports verified successfully!');
