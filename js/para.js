/* para.js – Tüm tutarlar kuruş (tam sayı) olarak tutulur. */
(function (root) {
  'use strict';

  /** "12,50" | "12.50" | 12.5 -> 1250 kuruş. Geçersizse NaN. */
  function tlToKurus(deger) {
    if (typeof deger === 'number') return Math.round(deger * 100);
    if (deger == null) return NaN;
    let s = String(deger).trim().replace(/\s|₺|TL/gi, '');
    if (s === '') return NaN;
    // "1.234,56" -> "1234.56" ; "1234,56" -> "1234.56" ; "1234.56" kalır
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return NaN;
    const negatif = s.startsWith('-');
    const [tam, kesir = ''] = s.replace('-', '').split('.');
    const k = parseInt(tam, 10) * 100 + parseInt((kesir + '00').slice(0, 2), 10);
    return negatif ? -k : k;
  }

  /** 123456 -> "1.234,56 ₺" */
  function formatla(kurus, simge = true) {
    const negatif = kurus < 0;
    const mutlak = Math.abs(Math.round(kurus));
    const tam = Math.floor(mutlak / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const kesir = String(mutlak % 100).padStart(2, '0');
    return (negatif ? '-' : '') + tam + ',' + kesir + (simge ? ' ₺' : '');
  }

  /** Birim fiyat × miktar. Miktar adet (tam sayı) ya da kg (en çok 3 ondalık). Yarım yukarı yuvarlar. */
  function carp(birimKurus, miktar) {
    const gram = Math.round(miktar * 1000);
    return Math.round((birimKurus * gram) / 1000);
  }

  function topla(liste) {
    return liste.reduce((a, b) => a + b, 0);
  }

  /** KDV dahil tutardan KDV payı: tutar * oran / (100 + oran) */
  function kdvPayi(dahilKurus, oran) {
    return Math.round((dahilKurus * oran) / (100 + oran));
  }

  const Para = { tlToKurus, formatla, carp, topla, kdvPayi };
  if (typeof module !== 'undefined' && module.exports) module.exports = Para;
  else root.Para = Para;
})(typeof self !== 'undefined' ? self : this);
