// Demonstrate localeCompare indeterminism

const a = 'command:build';
const b = 'command:itest';

// Test in different locales
const enUS = a.localeCompare(b, 'en-US');
const deDE = a.localeCompare(b, 'de-DE');
const trTR = a.localeCompare(b, 'tr-TR');

console.log('en-US:', enUS);
console.log('de-DE:', deDE);
console.log('tr-TR:', trTR);

// Binary comparison (what KnowledgeHasher uses)
const binary = a < b ? -1 : a > b ? 1 : 0;
console.log('Binary:', binary);

// Check if any differ
if (enUS !== deDE || enUS !== trTR) {
  console.log('\n⚠️  DIFFERENT LOCALES PRODUCE DIFFERENT ORDERING');
  console.log('This breaks replay determinism!');
}

// Test with Turkish locale (i/I handling)
const str1 = 'file_IMAGE';
const str2 = 'file_image';

console.log('\nTurkish locale i/I handling:');
console.log('en-US:', str1.localeCompare(str2, 'en-US'));
console.log('tr-TR:', str1.localeCompare(str2, 'tr-TR'));
console.log('Binary:', str1 < str2 ? -1 : str1 > str2 ? 1 : 0);

if (str1.localeCompare(str2, 'en-US') !== str1.localeCompare(str2, 'tr-TR')) {
  console.log('⚠️  Turkish locale treats I differently!');
}
