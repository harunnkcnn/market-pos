/* barkod.js – EAN-13 / EAN-8 doğrulama ve terazi (ağırlık) barkodu çözümleme. */
(function (root) {
  'use strict';

  /** EAN-8 / EAN-13 kontrol hanesini hesaplar (son hane hariç gövde verilir). */
  function kontrolHanesi(govde) {
    let toplam = 0;
    const ters = govde.split('').reverse();
    for (let i = 0; i < ters.length; i++) {
      const d = parseInt(ters[i], 10);
      toplam += i % 2 === 0 ? d * 3 : d;
    }
    return (10 - (toplam % 10)) % 10;
  }

  function gecerliEan(kod) {
    if (!/^\d{8}$|^\d{13}$/.test(kod)) return false;
    return kontrolHanesi(kod.slice(0, -1)) === parseInt(kod.slice(-1), 10);
  }

  /**
   * Terazi barkodu: 2X PPPPP WWWWW C  (13 hane)
   *  - Ön ek: varsayılan 27, 28, 29
   *  - PPPPP: terazideki ürün kodu
   *  - WWWWW: ağırlık (gram)
   * Dönüş: { teraziKodu: '00123', kg: 0.75 } ya da null
   */
  function teraziCoz(kod, onEkler = ['27', '28', '29']) {
    if (!/^\d{13}$/.test(kod)) return null;
    if (!onEkler.includes(kod.slice(0, 2))) return null;
    if (!gecerliEan(kod)) return null;
    const teraziKodu = kod.slice(2, 7);
    const gram = parseInt(kod.slice(7, 12), 10);
    if (gram <= 0) return null;
    return { teraziKodu, kg: gram / 1000 };
  }

  /** Test ve demo için terazi barkodu üretir. */
  function teraziUret(teraziKodu, gram, onEk = '27') {
    const govde = onEk + String(teraziKodu).padStart(5, '0') + String(gram).padStart(5, '0');
    return govde + kontrolHanesi(govde);
  }

  const Barkod = { kontrolHanesi, gecerliEan, teraziCoz, teraziUret };
  if (typeof module !== 'undefined' && module.exports) module.exports = Barkod;
  else root.Barkod = Barkod;
})(typeof self !== 'undefined' ? self : this);
