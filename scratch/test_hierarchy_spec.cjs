const hierarchy = require('../constants/defaultHierarchy.js');

console.log('Testing defaultHierarchy at root...');
const struct = hierarchy.DEFAULT_UNIT_STRUCTURE || hierarchy.default || hierarchy;
console.log('Total Battalions:', struct.length);
console.log('Battalion names:', struct.map(b => b.name));

let companyCount = 0;
let platoonCount = 0;

struct.forEach(bn => {
  console.log(`\nBattalion: ${bn.name} (${bn.shortCode}) - Quota: ${bn.targetQuota}`);
  bn.companies.forEach(co => {
    companyCount++;
    console.log(`  - Company: ${co.name} (${co.shortCode}) - Quota: ${co.targetQuota}`);
    co.platoons.forEach(pl => {
      platoonCount++;
      console.log(`      * Platoon: ${pl.name} (${pl.shortCode}) - Quota: ${pl.targetQuota}`);
    });
  });
});

console.log('\n--- Summary Verification ---');
console.log('Battalions:', struct.length, struct.length === 4 ? 'PASS' : 'FAIL');
console.log('Companies:', companyCount, companyCount === 8 ? 'PASS' : 'FAIL');
console.log('Platoons:', platoonCount, platoonCount === 16 ? 'PASS' : 'FAIL');

if (struct.length !== 4 || companyCount !== 8 || platoonCount !== 16) {
  process.exit(1);
} else {
  console.log('ALL STANDARD HIERARCHY CHECKS PASSED!');
}
