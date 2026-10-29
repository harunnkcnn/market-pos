/* db.js – IndexedDB üzerinde küçük bir depo. Veriler açılışta belleğe alınır, her yazma diske de gider. */
(function (root) {
  'use strict';
  const AD = 'market-pos', SURUM = 1;
  const TABLOLAR = ['urunler', 'satislar', 'musteriler', 'cariHareketler', 'stokHareketler', 'ayarlar'];

  let idb = null;
  const bellek = {};
  TABLOLAR.forEach(t => (bellek[t] = new Map()));

  function ac() {
    return new Promise((coz, reddet) => {
      if (!('indexedDB' in self)) { coz(null); return; }
      const istek = indexedDB.open(AD, SURUM);
      istek.onupgradeneeded = () => {
        const d = istek.result;
        TABLOLAR.forEach(t => { if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: 'id' }); });
      };
      istek.onsuccess = () => coz(istek.result);
      istek.onerror = () => coz(null); // IndexedDB yoksa (gizli mod vb.) yalnızca bellekte çalış
    });
  }

  function hepsiniOku(tablo) {
    return new Promise(coz => {
      const tx = idb.transaction(tablo, 'readonly');
      const istek = tx.objectStore(tablo).getAll();
      istek.onsuccess = () => coz(istek.result || []);
      istek.onerror = () => coz([]);
    });
  }

  async function baslat() {
    idb = await ac();
    if (idb) {
      for (const t of TABLOLAR) (await hepsiniOku(t)).forEach(k => bellek[t].set(k.id, k));
    }
    return !!idb;
  }

  function diskeYaz(tablo, kayit, silinecek) {
    if (!idb) return Promise.resolve();
    return new Promise((coz, reddet) => {
      const tx = idb.transaction(tablo, 'readwrite');
      const s = tx.objectStore(tablo);
      silinecek ? s.delete(kayit) : s.put(kayit);
      tx.oncomplete = () => coz();
      tx.onerror = () => reddet(tx.error);
    });
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const DB = {
    baslat,
    id,
    hepsi: t => Array.from(bellek[t].values()),
    al: (t, k) => bellek[t].get(k),
    bul: (t, f) => Array.from(bellek[t].values()).find(f),
    filtre: (t, f) => Array.from(bellek[t].values()).filter(f),
    kaydet(t, kayit) {
      if (!kayit.id) kayit.id = id();
      bellek[t].set(kayit.id, kayit);
      diskeYaz(t, kayit).catch(e => console.error('Kayıt hatası', e));
      return kayit;
    },
    sil(t, k) {
      bellek[t].delete(k);
      diskeYaz(t, k, true).catch(e => console.error('Silme hatası', e));
    },
    bosMu: () => bellek.urunler.size === 0,
    async sifirla() {
      TABLOLAR.forEach(t => bellek[t].clear());
      if (idb) { idb.close(); idb = null; }
      await new Promise(c => { const r = indexedDB.deleteDatabase(AD); r.onsuccess = r.onerror = r.onblocked = () => c(); });
    }
  };

  root.DB = DB;
})(self);
