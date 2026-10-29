const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/barkod.js');

test('EAN-13 kontrol hanesi', () => {
  assert.equal(B.gecerliEan('4006381333931'), true);
  assert.equal(B.gecerliEan('4006381333932'), false);
  assert.equal(B.gecerliEan('96385074'), true); // EAN-8
  assert.equal(B.gecerliEan('12345'), false);
});

test('terazi barkodu üret / çöz', () => {
  const kod = B.teraziUret('00101', 750);
  assert.equal(kod.length, 13);
  assert.deepEqual(B.teraziCoz(kod), { teraziKodu: '00101', kg: 0.75 });
});

test('terazi olmayan barkod null döner', () => {
  assert.equal(B.teraziCoz('4006381333931'), null);
  assert.equal(B.teraziCoz('2700101007501'), null); // kontrol hanesi yanlış
});
