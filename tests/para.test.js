const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/para.js');

test('tlToKurus farklı yazımları kuruşa çevirir', () => {
  assert.equal(P.tlToKurus('12,50'), 1250);
  assert.equal(P.tlToKurus('12.5'), 1250);
  assert.equal(P.tlToKurus('1.234,56'), 123456);
  assert.equal(P.tlToKurus('0,05'), 5);
  assert.equal(P.tlToKurus('7'), 700);
  assert.equal(P.tlToKurus(29.9), 2990);
  assert.ok(Number.isNaN(P.tlToKurus('abc')));
  assert.ok(Number.isNaN(P.tlToKurus('1,234')));
});

test('formatla Türkçe biçim kullanır', () => {
  assert.equal(P.formatla(123456), '1.234,56 ₺');
  assert.equal(P.formatla(5), '0,05 ₺');
  assert.equal(P.formatla(-250, false), '-2,50');
});

test('carp kg miktarında doğru yuvarlar', () => {
  assert.equal(P.carp(2990, 0.75), 2243);   // 22,425 -> 22,43
  assert.equal(P.carp(1000, 3), 3000);
  assert.equal(P.carp(29900, 0.333), 9957);
});

test('kdvPayi dahil fiyattan KDV ayırır', () => {
  assert.equal(P.kdvPayi(12000, 20), 2000);
  assert.equal(P.kdvPayi(1010, 1), 10);
});
