const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/sepet.js');

const ekmek = { id: 'u1', ad: 'Ekmek', birim: 'adet', kdv: 1, satisKurus: 1000, alisKurus: 700 };
const domates = { id: 'u2', ad: 'Domates', birim: 'kg', kdv: 1, satisKurus: 2990, alisKurus: 1800 };

test('adetli ürün aynı satırda toplanır, kg ürün ayrı satır olur', () => {
  const s = S.yeniSepet();
  S.ekle(s, ekmek); S.ekle(s, ekmek, 2);
  S.ekle(s, domates, 0.5); S.ekle(s, domates, 0.25);
  assert.equal(s.kalemler.length, 3);
  assert.equal(s.kalemler[0].miktar, 3);
  assert.equal(S.toplam(s), 3000 + 1495 + 748);
});

test('adetli üründe ondalık miktar reddedilir', () => {
  assert.throws(() => S.ekle(S.yeniSepet(), ekmek, 1.5));
});

test('miktar 0 olunca satır silinir', () => {
  const s = S.ekle(S.yeniSepet(), ekmek, 2);
  S.miktarDegistir(s, 0, 0);
  assert.equal(s.kalemler.length, 0);
});

test('ödeme hesabı: para üstü, eksik ödeme, kart fazlası', () => {
  assert.deepEqual(S.odemeHesapla(4250, { nakit: 5000 }), { gecerli: true, paraUstu: 750, kayit: { nakit: 4250, kart: 0, veresiye: 0 } });
  assert.equal(S.odemeHesapla(4250, { nakit: 4000 }).gecerli, false);
  assert.equal(S.odemeHesapla(4250, { kart: 5000 }).gecerli, false);
  assert.deepEqual(S.odemeHesapla(4250, { kart: 2000, nakit: 3000 }).kayit, { nakit: 2250, kart: 2000, veresiye: 0 });
});

test('brüt kâr', () => {
  const s = S.ekle(S.yeniSepet(), ekmek, 3);
  assert.equal(S.brutKar(s.kalemler), 900);
});
