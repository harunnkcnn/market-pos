/* sepet.js – Arayüzden bağımsız sepet ve ödeme kuralları (test edilebilir). */
(function (root) {
  'use strict';
  const Para = (typeof module !== 'undefined' && module.exports) ? require('./para.js') : root.Para;

  function yeniSepet() {
    return { kalemler: [], iade: false };
  }

  /** Ürünü sepete ekler. Adetli ürün zaten varsa miktarı artırır; kg ürün her seferinde ayrı satırdır. */
  function ekle(sepet, urun, miktar = 1) {
    if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı');
    if (urun.birim === 'adet' && !Number.isInteger(miktar)) throw new Error('Adetli üründe miktar tam sayı olmalı');
    const mevcut = urun.birim === 'adet' ? sepet.kalemler.find(k => k.urunId === urun.id) : null;
    if (mevcut) {
      mevcut.miktar += miktar;
      mevcut.tutar = Para.carp(mevcut.birimFiyat, mevcut.miktar);
    } else {
      sepet.kalemler.push({
        urunId: urun.id, ad: urun.ad, birim: urun.birim, kdv: urun.kdv,
        birimFiyat: urun.satisKurus, alisFiyat: urun.alisKurus,
        miktar, tutar: Para.carp(urun.satisKurus, miktar)
      });
    }
    return sepet;
  }

  function miktarDegistir(sepet, index, miktar) {
    const k = sepet.kalemler[index];
    if (!k) return sepet;
    if (miktar <= 0) { sepet.kalemler.splice(index, 1); return sepet; }
    if (k.birim === 'adet') miktar = Math.round(miktar);
    k.miktar = miktar;
    k.tutar = Para.carp(k.birimFiyat, miktar);
    return sepet;
  }

  function sil(sepet, index) {
    sepet.kalemler.splice(index, 1);
    return sepet;
  }

  function toplam(sepet) {
    return Para.topla(sepet.kalemler.map(k => k.tutar));
  }

  function brutKar(kalemler) {
    return Para.topla(kalemler.map(k => k.tutar - Para.carp(k.alisFiyat || 0, k.miktar)));
  }

  /**
   * Ödemeyi doğrular. odeme = { nakit, kart, veresiye } (kuruş)
   * Nakit fazla verilebilir (para üstü); kart + veresiye toplamı aşamaz.
   */
  function odemeHesapla(tutar, odeme) {
    const nakit = odeme.nakit || 0, kart = odeme.kart || 0, veresiye = odeme.veresiye || 0;
    if (nakit < 0 || kart < 0 || veresiye < 0) return { gecerli: false, hata: 'Tutarlar negatif olamaz' };
    if (kart + veresiye > tutar) return { gecerli: false, hata: 'Kart + veresiye toplamı satış tutarını aşamaz' };
    const odenen = nakit + kart + veresiye;
    if (odenen < tutar) return { gecerli: false, hata: 'Eksik ödeme: ' + Para.formatla(tutar - odenen) };
    const paraUstu = odenen - tutar;
    return { gecerli: true, paraUstu, kayit: { nakit: nakit - paraUstu, kart, veresiye } };
  }

  const Sepet = { yeniSepet, ekle, miktarDegistir, sil, toplam, brutKar, odemeHesapla };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sepet;
  else root.Sepet = Sepet;
})(typeof self !== 'undefined' ? self : this);
