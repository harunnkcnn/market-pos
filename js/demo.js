/* demo.js – Hayalî demo verisi. Barkodlar mağaza içi kullanıma ayrılmış 200 ön ekiyle üretilir (gerçek ürünlerle çakışmaz). */
(function (root) {
  'use strict';
  const { kontrolHanesi } = root.Barkod;
  const b = n => { const g = '200' + String(n).padStart(9, '0'); return g + kontrolHanesi(g); };

  // [ad, kategori, alış TL, satış TL, kdv, stok, kritik, birim, hızlı tuş, terazi kodu]
  const URUNLER = [
    ['Ekmek (250 g)', 'Fırın', 7, 10, 1, 60, 20, 'adet', true],
    ['Simit', 'Fırın', 8, 12.5, 1, 40, 10, 'adet', true],
    ['Poşet', 'Diğer', 0.2, 0.5, 20, 500, 100, 'adet', true],
    ['Domates', 'Manav', 18, 29.9, 1, 35, 10, 'kg', true, '00101'],
    ['Muz', 'Manav', 45, 69.9, 1, 20, 5, 'kg', true, '00102'],
    ['Beyaz Peynir', 'Şarküteri', 210, 299, 1, 12, 3, 'kg', true, '00201'],
    ['Süt 1 L', 'Süt Ürünleri', 28, 39.5, 1, 24, 12, 'adet', false],
    ['Yoğurt 1 kg', 'Süt Ürünleri', 52, 74.9, 1, 15, 6, 'adet', false],
    ['Yumurta 10\'lu', 'Kahvaltılık', 55, 79.9, 1, 18, 6, 'adet', false],
    ['Çay 1 kg', 'İçecek', 180, 249.9, 20, 9, 4, 'adet', false],
    ['Su 1,5 L', 'İçecek', 6, 10, 20, 48, 24, 'adet', false],
    ['Ayran 300 ml', 'İçecek', 9, 15, 1, 30, 12, 'adet', false],
    ['Makarna 500 g', 'Bakliyat', 14, 22.5, 1, 40, 10, 'adet', false],
    ['Pirinç 1 kg', 'Bakliyat', 48, 69.9, 1, 3, 8, 'adet', false],
    ['Ayçiçek Yağı 1 L', 'Temel Gıda', 62, 89.9, 1, 14, 6, 'adet', false],
    ['Şeker 1 kg', 'Temel Gıda', 30, 44.9, 1, 22, 8, 'adet', false],
    ['Bulaşık Deterjanı', 'Temizlik', 38, 59.9, 20, 4, 5, 'adet', false],
    ['Kâğıt Havlu 2\'li', 'Temizlik', 35, 54.9, 20, 16, 6, 'adet', false]
  ];

  const MUSTERILER = [
    ['Örnek Müşteri 1', '0500 000 00 01', 2000],
    ['Örnek Müşteri 2', '0500 000 00 02', 1000]
  ];

  function yukle(DB, Para) {
    URUNLER.forEach((u, i) => {
      DB.kaydet('urunler', {
        id: 'u' + (i + 1), barkod: u[7] === 'kg' ? '' : b(i + 1), ad: u[0], kategori: u[1],
        alisKurus: Para.tlToKurus(u[2]), satisKurus: Para.tlToKurus(u[3]), kdv: u[4],
        stok: u[5], kritik: u[6], birim: u[7], hizli: u[8], teraziKodu: u[9] || ''
      });
    });
    MUSTERILER.forEach((m, i) => {
      DB.kaydet('musteriler', { id: 'm' + (i + 1), ad: m[0], tel: m[1], limitKurus: Para.tlToKurus(m[2]), borcKurus: 0 });
    });
    DB.kaydet('ayarlar', { id: 'genel', isletmeAdi: 'Örnek Mahalle Marketi', fisAltNot: 'Bilgi fişidir, mali değeri yoktur.', kasiyer: 'Kasiyer 1' });
  }

  root.Demo = { yukle };
})(self);
