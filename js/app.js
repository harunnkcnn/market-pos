/* app.js – market-pos arayüzü */
(function () {
  'use strict';
  const { formatla, tlToKurus, carp, kdvPayi } = Para;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tl = k => formatla(k);
  const tlInput = k => formatla(k, false).replace(/\./g, '');
  const miktarYaz = (m, birim) => birim === 'kg' ? m.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg' : m + ' ad';
  const gunAnahtari = d => { const t = new Date(d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

  let sepet = Sepet.yeniSepet();
  let bekleyenler = [];
  let aktifSayfa = 'kasa';
  let seciliMusteri = null;

  const ayar = () => DB.al('ayarlar', 'genel') || {};

  /* ---------- Bildirim ---------- */
  let bildirimZaman;
  function bildir(mesaj, tur = '') {
    const el = $('#bildirim');
    el.textContent = mesaj;
    el.className = 'bildirim goster ' + tur;
    clearTimeout(bildirimZaman);
    bildirimZaman = setTimeout(() => (el.className = 'bildirim'), 2600);
  }

  /* ---------- Modal ---------- */
  function modal(html, { onAc, onGonder } = {}) {
    return new Promise(coz => {
      const dlg = $('#modal'), form = $('#modalForm');
      form.innerHTML = html;
      dlg.returnValue = '';
      const kapat = deger => { dlg.close(); coz(deger); };
      form.onsubmit = e => {
        const btn = e.submitter;
        if (btn && btn.value === 'iptal') { e.preventDefault(); kapat(null); return; }
        if (onGonder) {
          e.preventDefault();
          const sonuc = onGonder(new FormData(form), form);
          if (sonuc !== false) kapat(sonuc === undefined ? true : sonuc);
        } else { e.preventDefault(); kapat(true); }
      };
      dlg.oncancel = () => coz(null);
      dlg.onclose = () => coz(null); // dışarıdan kapatılırsa (söz zaten çözüldüyse etkisiz)
      dlg.showModal();
      if (onAc) onAc(form);
      const ilk = form.querySelector('[autofocus]') || form.querySelector('input,select');
      if (ilk) { ilk.focus(); if (ilk.select) ilk.select(); }
    });
  }
  const modalAlt = (onay = 'Tamam', tur = 'yesil') =>
    `<div class="modal-alt"><button class="btn" value="iptal" formnovalidate>Vazgeç</button><button class="btn ${tur}" value="ok">${onay}</button></div>`;

  /* ---------- Sekmeler ---------- */
  function sayfaGoster(ad) {
    aktifSayfa = ad;
    $$('.sekme').forEach(b => b.classList.toggle('aktif', b.dataset.sayfa === ad));
    $$('.sayfa').forEach(s => s.classList.toggle('aktif', s.id === 'sayfa-' + ad));
    ({ kasa: kasaCiz, urunler: urunleriCiz, veresiye: musterileriCiz, raporlar: raporCiz, ayarlar: ayarlariCiz })[ad]();
    if (ad === 'kasa') odakla();
  }
  function odakla() { if (aktifSayfa === 'kasa' && !$('#modal').open) $('#barkodGiris').focus(); }

  /* ================= KASA ================= */
  function kasaCiz() {
    const govde = $('#sepetGovde');
    govde.innerHTML = sepet.kalemler.map((k, i) => `
      <tr>
        <td>${esc(k.ad)}</td>
        <td class="sag"><button class="mini" data-miktar="${i}" title="Miktarı değiştir">${miktarYaz(k.miktar, k.birim)}</button></td>
        <td class="sag">${tl(k.birimFiyat)}</td>
        <td class="sag kalin">${tl(k.tutar)}</td>
        <td class="sag"><button class="mini kirmizi" data-sil="${i}" title="Satırı sil">✕</button></td>
      </tr>`).join('');
    $('#sepetBos').hidden = sepet.kalemler.length > 0;
    const t = Sepet.toplam(sepet);
    $('#toplam').textContent = (sepet.iade ? '−' : '') + tl(t);
    $('#kalemSayisi').textContent = sepet.kalemler.length + ' kalem';
    $('#iadeBandi').hidden = !sepet.iade;
    document.body.classList.toggle('iade-modu', sepet.iade);
    $$('[data-odeme="veresiye"],[data-odeme="parcali"]').forEach(b => (b.disabled = sepet.iade));

    $('#bekleyenler').innerHTML = bekleyenler.length
      ? '<span>Bekleyen:</span>' + bekleyenler.map((s, i) => `<button class="btn kucuk" data-bekleyen="${i}">#${i + 1} · ${tl(Sepet.toplam(s))}</button>`).join('')
      : '';

    const hizli = DB.filtre('urunler', u => u.hizli).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    $('#hizliTuslar').innerHTML = hizli.map(u => `
      <button class="hizli-tus" data-hizli="${u.id}">
        <span>${esc(u.ad)}</span><small>${tl(u.satisKurus)}${u.birim === 'kg' ? '/kg' : ''}</small>
      </button>`).join('') || '<p class="not">Ürünler sayfasından "hızlı tuş" işaretleyin.</p>';
  }

  async function urunEkle(urun, miktar) {
    if (urun.birim === 'kg' && (miktar == null)) {
      const kg = await modal(`
        <h3>${esc(urun.ad)}</h3>
        <label>Ağırlık (kg)<input name="kg" type="number" step="0.001" min="0.001" required autofocus value="1"></label>
        <p class="not">${tl(urun.satisKurus)} / kg</p>${modalAlt('Ekle')}`,
        { onGonder: f => parseFloat(f.get('kg')) });
      if (!kg) return odakla();
      miktar = kg;
    }
    if (miktar == null) miktar = 1;
    if (urun.birim === 'adet') miktar = Math.max(1, Math.round(miktar));
    try { Sepet.ekle(sepet, urun, miktar); } catch (e) { bildir(e.message, 'hata'); return; }
    kasaCiz();
    odakla();
  }

  function aramaYap(metin) {
    const q = metin.toLocaleLowerCase('tr');
    return DB.filtre('urunler', u => u.ad.toLocaleLowerCase('tr').includes(q)).slice(0, 8);
  }

  async function barkodIsle(giris) {
    const v = giris.trim();
    if (!v) return;
    const miktarAlan = parseFloat($('#miktarGiris').value) || 1;
    $('#miktarGiris').value = 1;
    $('#aramaSonuc').hidden = true;

    if (/^\d+$/.test(v)) {
      const terazi = Barkod.teraziCoz(v);
      if (terazi) {
        const u = DB.bul('urunler', x => x.teraziKodu === terazi.teraziKodu);
        if (u) return urunEkle(u, terazi.kg);
        return bildir('Terazi kodu ' + terazi.teraziKodu + ' hiçbir ürüne tanımlı değil', 'hata');
      }
      const u = DB.bul('urunler', x => x.barkod === v);
      if (u) return urunEkle(u, u.birim === 'kg' && miktarAlan === 1 ? null : miktarAlan);
      if ((v.length === 8 || v.length === 13) && !Barkod.gecerliEan(v)) bildir('Barkod kontrol hanesi hatalı, tekrar okutun', 'hata');
      const ekle = await modal(`<h3>Ürün bulunamadı</h3><p>${esc(v)} barkodlu ürün kayıtlı değil. Şimdi eklemek ister misiniz?</p>${modalAlt('Ürün ekle')}`);
      if (ekle) await urunFormu({ barkod: v }, true);
      return odakla();
    }
    const sonuc = aramaYap(v);
    if (sonuc.length === 1) return urunEkle(sonuc[0], sonuc[0].birim === 'kg' && miktarAlan === 1 ? null : miktarAlan);
    if (!sonuc.length) return bildir('Eşleşen ürün yok', 'hata');
    aramaListesi(sonuc);
  }

  function aramaListesi(liste) {
    const el = $('#aramaSonuc');
    el.innerHTML = liste.map(u => `<button data-ara="${u.id}"><span>${esc(u.ad)}</span><small>${tl(u.satisKurus)}${u.birim === 'kg' ? '/kg' : ''} · stok ${u.stok}</small></button>`).join('');
    el.hidden = false;
  }

  function sepetiTemizle() {
    sepet = Sepet.yeniSepet();
    kasaCiz();
    odakla();
  }

  async function odemeBaslat(tur) {
    if (!sepet.kalemler.length) return bildir('Sepet boş');
    const tutar = Sepet.toplam(sepet);

    if (sepet.iade) {
      if (tur !== 'nakit' && tur !== 'kart') return;
      const ok = await modal(`<h3>İade onayı</h3><p>${tl(tutar)} müşteriye <b>${tur === 'nakit' ? 'nakit' : 'karta'}</b> iade edilecek, ürünler stoka geri girecek.</p>${modalAlt('İadeyi tamamla', 'turuncu')}`);
      if (ok) satisiKaydet({ nakit: tur === 'nakit' ? tutar : 0, kart: tur === 'kart' ? tutar : 0, veresiye: 0 }, null, 0);
      return odakla();
    }

    if (tur === 'kart') {
      const ok = await modal(`<h3>Kart ile ödeme</h3><p class="dev">${tl(tutar)}</p><p class="not">POS cihazından çekimi yaptıktan sonra onaylayın.</p>${modalAlt('Ödeme alındı', 'mavi')}`);
      if (ok) satisiKaydet({ nakit: 0, kart: tutar, veresiye: 0 }, null, 0);
      return odakla();
    }

    if (tur === 'nakit') {
      const sonuc = await modal(`
        <h3>Nakit ödeme</h3>
        <p class="dev">${tl(tutar)}</p>
        <label>Alınan tutar<input name="alinan" inputmode="decimal" autofocus value="${tlInput(tutar)}" required></label>
        <div class="hizli-para">${[...new Set([tutar, ...[5000, 10000, 20000, 50000, 100000].filter(x => x > tutar)])].slice(0, 5).map(x => `<button type="button" class="btn kucuk" data-para="${x}">${tl(x)}</button>`).join('')}</div>
        <p class="para-ustu">Para üstü: <b id="paraUstu">0,00 ₺</b></p>
        ${modalAlt('Satışı tamamla')}`, {
        onAc: f => {
          const g = f.querySelector('[name=alinan]');
          const hesap = () => { const a = tlToKurus(g.value); f.querySelector('#paraUstu').textContent = isNaN(a) ? '—' : tl(Math.max(0, a - tutar)); };
          g.addEventListener('input', hesap);
          f.querySelectorAll('[data-para]').forEach(b => b.onclick = () => { g.value = tlInput(+b.dataset.para); hesap(); });
          hesap();
        },
        onGonder: fd => {
          const alinan = tlToKurus(fd.get('alinan'));
          const s = Sepet.odemeHesapla(tutar, { nakit: alinan });
          if (!s.gecerli) { bildir(s.hata, 'hata'); return false; }
          return s;
        }
      });
      if (sonuc) satisiKaydet(sonuc.kayit, null, sonuc.paraUstu);
      return odakla();
    }

    if (tur === 'parcali') {
      const sonuc = await modal(`
        <h3>Parçalı ödeme</h3><p class="dev">${tl(tutar)}</p>
        <label>Kart<input name="kart" inputmode="decimal" autofocus value="0" required></label>
        <label>Nakit<input name="nakit" inputmode="decimal" value="${tlInput(tutar)}" required></label>
        <p class="para-ustu">Para üstü: <b id="paraUstu">0,00 ₺</b></p>
        ${modalAlt('Satışı tamamla')}`, {
        onAc: f => {
          const k = f.querySelector('[name=kart]'), n = f.querySelector('[name=nakit]');
          const hesap = () => { const kk = tlToKurus(k.value) || 0, nn = tlToKurus(n.value) || 0; f.querySelector('#paraUstu').textContent = tl(Math.max(0, kk + nn - tutar)); };
          k.addEventListener('input', () => { const kk = tlToKurus(k.value) || 0; n.value = tlInput(Math.max(0, tutar - kk)); hesap(); });
          n.addEventListener('input', hesap);
        },
        onGonder: fd => {
          const s = Sepet.odemeHesapla(tutar, { kart: tlToKurus(fd.get('kart')) || 0, nakit: tlToKurus(fd.get('nakit')) || 0 });
          if (!s.gecerli) { bildir(s.hata, 'hata'); return false; }
          return s;
        }
      });
      if (sonuc) satisiKaydet(sonuc.kayit, null, sonuc.paraUstu);
      return odakla();
    }

    if (tur === 'veresiye') {
      const musteriler = DB.hepsi('musteriler').sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
      if (!musteriler.length) { bildir('Önce Veresiye sayfasından müşteri ekleyin', 'hata'); return; }
      const sonuc = await modal(`
        <h3>Veresiye</h3><p class="dev">${tl(tutar)}</p>
        <label>Müşteri<select name="musteri" autofocus required>${musteriler.map(m => `<option value="${m.id}">${esc(m.ad)} · borç ${tl(m.borcKurus)}</option>`).join('')}</select></label>
        <label>Peşin alınan (nakit)<input name="pesin" inputmode="decimal" value="0"></label>
        ${modalAlt('Deftere yaz', 'turuncu')}`, {
        onGonder: fd => {
          const m = DB.al('musteriler', fd.get('musteri'));
          const pesin = tlToKurus(fd.get('pesin')) || 0;
          const borc = tutar - pesin;
          if (borc < 0) { bildir('Peşin tutar toplamı aşamaz', 'hata'); return false; }
          if (m.limitKurus > 0 && m.borcKurus + borc > m.limitKurus && !confirm(`${m.ad} limitini aşıyor (${tl(m.borcKurus + borc)} / ${tl(m.limitKurus)}). Yine de yazılsın mı?`)) return false;
          return { musteri: m, kayit: { nakit: pesin, kart: 0, veresiye: borc } };
        }
      });
      if (sonuc) satisiKaydet(sonuc.kayit, sonuc.musteri, 0);
      return odakla();
    }
  }

  function satisiKaydet(odeme, musteri, paraUstu) {
    const a = ayar();
    const fisNo = (a.sonFisNo || 0) + 1;
    DB.kaydet('ayarlar', { ...a, sonFisNo: fisNo });
    const iade = sepet.iade;
    const toplam = Sepet.toplam(sepet);
    const satis = DB.kaydet('satislar', {
      fisNo, tarih: new Date().toISOString(), iade, kalemler: sepet.kalemler.map(k => ({ ...k })),
      toplam, odeme, paraUstu, musteriId: musteri ? musteri.id : null, kasiyer: a.kasiyer || 'Kasiyer'
    });

    const uyarilar = [];
    satis.kalemler.forEach(k => {
      const u = DB.al('urunler', k.urunId);
      if (!u) return;
      const degisim = iade ? k.miktar : -k.miktar;
      u.stok = Math.round((u.stok + degisim) * 1000) / 1000;
      DB.kaydet('urunler', u);
      DB.kaydet('stokHareketler', { urunId: u.id, tarih: satis.tarih, miktar: degisim, neden: iade ? 'İade #' + fisNo : 'Satış #' + fisNo });
      if (!iade && u.stok <= u.kritik) uyarilar.push(u.ad);
    });

    if (musteri && odeme.veresiye > 0) {
      musteri.borcKurus += odeme.veresiye;
      DB.kaydet('musteriler', musteri);
      DB.kaydet('cariHareketler', { musteriId: musteri.id, tarih: satis.tarih, tip: 'borc', tutar: odeme.veresiye, aciklama: 'Satış #' + fisNo, satisId: satis.id });
    }

    sepetiTemizle();
    const mesaj = (iade ? 'İade tamamlandı' : 'Satış tamamlandı') + ' · Fiş #' + fisNo + (paraUstu ? ' · Para üstü ' + tl(paraUstu) : '');
    bildir(mesaj, 'basari');
    if (uyarilar.length) setTimeout(() => bildir('Kritik stok: ' + uyarilar.join(', '), 'uyari'), 2700);
    sonSatis = satis;
  }
  let sonSatis = null;

  /* ---------- Fiş ---------- */
  function fisHtml(s) {
    const a = ayar();
    const m = s.musteriId ? DB.al('musteriler', s.musteriId) : null;
    const kdvler = {};
    s.kalemler.forEach(k => { kdvler[k.kdv] = (kdvler[k.kdv] || 0) + kdvPayi(k.tutar, k.kdv); });
    return `
      <div class="fis">
        <h2>${esc(a.isletmeAdi || 'market-pos')}</h2>
        <p>${s.iade ? 'İADE FİŞİ' : 'BİLGİ FİŞİ'} #${s.fisNo}<br>${new Date(s.tarih).toLocaleString('tr-TR')}<br>${esc(s.kasiyer)}</p>
        <hr>
        ${s.kalemler.map(k => `<div class="fs"><span>${esc(k.ad)}<br><small>${miktarYaz(k.miktar, k.birim)} × ${tl(k.birimFiyat)}</small></span><b>${tl(k.tutar)}</b></div>`).join('')}
        <hr>
        <div class="fs buyuk"><span>TOPLAM</span><b>${tl(s.toplam)}</b></div>
        ${Object.entries(kdvler).map(([o, v]) => `<div class="fs"><span>KDV %${o}</span><span>${tl(v)}</span></div>`).join('')}
        <hr>
        ${s.odeme.nakit ? `<div class="fs"><span>Nakit</span><span>${tl(s.odeme.nakit + (s.paraUstu || 0))}</span></div>` : ''}
        ${s.paraUstu ? `<div class="fs"><span>Para üstü</span><span>${tl(s.paraUstu)}</span></div>` : ''}
        ${s.odeme.kart ? `<div class="fs"><span>Kart</span><span>${tl(s.odeme.kart)}</span></div>` : ''}
        ${s.odeme.veresiye ? `<div class="fs"><span>Veresiye (${esc(m ? m.ad : '')})</span><span>${tl(s.odeme.veresiye)}</span></div>` : ''}
        <hr><p>${esc(a.fisAltNot || '')}</p>
      </div>`;
  }

  function yazdir(icerik, genislik = '80mm') {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(f);
    f.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Yazdır</title><style>
      @page{size:${genislik} auto;margin:4mm}body{font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000;margin:0;width:${genislik === '80mm' ? '72mm' : 'auto'}}
      h2{font-size:15px;text-align:center;margin:0 0 4px}p{text-align:center;margin:4px 0}hr{border:0;border-top:1px dashed #000;margin:6px 0}
      .fs{display:flex;justify-content:space-between;gap:8px;margin:2px 0}.fs.buyuk{font-size:15px;font-weight:700}small{color:#333}
      table{width:100%;border-collapse:collapse}td,th{padding:3px 4px;border-bottom:1px solid #ccc;text-align:left}.sag{text-align:right}
    </style></head><body>${icerik}</body></html>`);
    f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1000); }, 150);
  }

  /* ================= ÜRÜNLER ================= */
  function urunleriCiz() {
    const q = $('#urunAra').value.toLocaleLowerCase('tr');
    const kritik = $('#sadeceKritik').checked;
    const liste = DB.filtre('urunler', u =>
      (!q || u.ad.toLocaleLowerCase('tr').includes(q) || (u.barkod || '').includes(q)) && (!kritik || u.stok <= u.kritik)
    ).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    $('#urunGovde').innerHTML = liste.map(u => `
      <tr class="${u.stok <= u.kritik ? 'kritik' : ''}">
        <td class="mono">${esc(u.barkod || (u.teraziKodu ? 'Terazi ' + u.teraziKodu : '—'))}</td>
        <td>${esc(u.ad)} ${u.hizli ? '<span class="rozet">hızlı</span>' : ''}</td>
        <td>${esc(u.kategori)}</td>
        <td class="sag">${tl(u.alisKurus)}</td>
        <td class="sag kalin">${tl(u.satisKurus)}${u.birim === 'kg' ? '/kg' : ''}</td>
        <td class="sag">%${u.kdv}</td>
        <td class="sag">${u.birim === 'kg' ? u.stok.toLocaleString('tr-TR') + ' kg' : u.stok}</td>
        <td class="sag">${u.kritik}</td>
        <td class="sag nowrap"><button class="mini" data-stok="${u.id}">Stok ±</button> <button class="mini" data-duzenle="${u.id}">Düzenle</button></td>
      </tr>`).join('') || '<tr><td colspan="9" class="bos">Ürün yok.</td></tr>';
  }

  async function urunFormu(u = {}, kasadanSonraEkle = false) {
    const yeni = !u.id;
    const kategoriler = [...new Set(DB.hepsi('urunler').map(x => x.kategori))].sort();
    const sonuc = await modal(`
      <h3>${yeni ? 'Yeni ürün' : 'Ürünü düzenle'}</h3>
      <div class="form-izgara">
        <label class="genis">Ürün adı<input name="ad" required autofocus value="${esc(u.ad)}"></label>
        <label>Barkod<input name="barkod" inputmode="numeric" value="${esc(u.barkod)}"></label>
        <label>Kategori<input name="kategori" list="katListe" value="${esc(u.kategori || 'Genel')}"><datalist id="katListe">${kategoriler.map(k => `<option value="${esc(k)}">`).join('')}</datalist></label>
        <label>Birim<select name="birim"><option value="adet" ${u.birim !== 'kg' ? 'selected' : ''}>Adet</option><option value="kg" ${u.birim === 'kg' ? 'selected' : ''}>Kilogram (tartılı)</option></select></label>
        <label>Terazi kodu (5 hane)<input name="teraziKodu" inputmode="numeric" maxlength="5" value="${esc(u.teraziKodu)}"></label>
        <label>Alış fiyatı (₺)<input name="alis" inputmode="decimal" required value="${u.alisKurus != null ? tlInput(u.alisKurus) : ''}"></label>
        <label>Satış fiyatı (₺)<input name="satis" inputmode="decimal" required value="${u.satisKurus != null ? tlInput(u.satisKurus) : ''}"></label>
        <label>KDV %<select name="kdv">${[1, 10, 20].map(k => `<option ${+u.kdv === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Stok<input name="stok" type="number" step="0.001" value="${u.stok ?? 0}"></label>
        <label>Kritik stok<input name="kritik" type="number" step="0.001" value="${u.kritik ?? 5}"></label>
        <label class="kontrol genis"><input type="checkbox" name="hizli" ${u.hizli ? 'checked' : ''}> Kasada hızlı tuş olarak göster</label>
      </div>
      <div class="modal-alt">${!yeni ? '<button class="btn kirmizi" value="sil" type="button" id="urunSilBtn">Sil</button><span class="bosluk"></span>' : ''}
        <button class="btn" value="iptal" formnovalidate>Vazgeç</button><button class="btn yesil" value="ok">Kaydet</button></div>`, {
      onAc: f => {
        const s = f.querySelector('#urunSilBtn');
        if (s) s.onclick = () => { if (confirm(u.ad + ' silinsin mi?')) { DB.sil('urunler', u.id); $('#modal').close(); bildir('Ürün silindi'); urunleriCiz(); } };
      },
      onGonder: fd => {
        const barkod = (fd.get('barkod') || '').trim();
        const terazi = (fd.get('teraziKodu') || '').trim();
        const alis = tlToKurus(fd.get('alis')), satis = tlToKurus(fd.get('satis'));
        if (isNaN(alis) || isNaN(satis)) { bildir('Fiyatları 12,50 biçiminde girin', 'hata'); return false; }
        if (barkod && DB.bul('urunler', x => x.barkod === barkod && x.id !== u.id)) { bildir('Bu barkod başka bir üründe kayıtlı', 'hata'); return false; }
        if (terazi && !/^\d{5}$/.test(terazi)) { bildir('Terazi kodu 5 haneli olmalı', 'hata'); return false; }
        if (terazi && DB.bul('urunler', x => x.teraziKodu === terazi && x.id !== u.id)) { bildir('Bu terazi kodu kullanımda', 'hata'); return false; }
        if (satis < alis && !confirm('Satış fiyatı alıştan düşük. Devam edilsin mi?')) return false;
        return DB.kaydet('urunler', {
          ...u, ad: fd.get('ad').trim(), barkod, kategori: (fd.get('kategori') || 'Genel').trim(), birim: fd.get('birim'), teraziKodu: terazi,
          alisKurus: alis, satisKurus: satis, kdv: +fd.get('kdv'), stok: parseFloat(fd.get('stok')) || 0,
          kritik: parseFloat(fd.get('kritik')) || 0, hizli: fd.get('hizli') === 'on'
        });
      }
    });
    if (sonuc) {
      bildir('Ürün kaydedildi', 'basari');
      if (kasadanSonraEkle) urunEkle(sonuc, sonuc.birim === 'kg' ? null : 1);
    }
    if (aktifSayfa === 'urunler') urunleriCiz(); else kasaCiz();
  }

  async function stokDuzelt(u) {
    const sonuc = await modal(`
      <h3>Stok hareketi · ${esc(u.ad)}</h3>
      <p>Mevcut: <b>${u.stok}</b> ${u.birim}</p>
      <label>Hareket<select name="tip"><option value="giris">Mal girişi (+)</option><option value="cikis">Fire / kayıp (−)</option><option value="sayim">Sayım sonucu (yeni miktar)</option></select></label>
      <label>Miktar<input name="miktar" type="number" step="0.001" required autofocus></label>
      <label>Açıklama<input name="neden" placeholder="Örn. tedarikçi irsaliyesi"></label>
      ${modalAlt('Kaydet')}`, {
      onGonder: fd => {
        const m = parseFloat(fd.get('miktar'));
        if (isNaN(m)) return false;
        const tip = fd.get('tip');
        const degisim = tip === 'giris' ? m : tip === 'cikis' ? -m : m - u.stok;
        u.stok = Math.round((u.stok + degisim) * 1000) / 1000;
        DB.kaydet('urunler', u);
        DB.kaydet('stokHareketler', { urunId: u.id, tarih: new Date().toISOString(), miktar: degisim, neden: (fd.get('neden') || '') || ({ giris: 'Mal girişi', cikis: 'Fire', sayim: 'Sayım' })[tip] });
        return true;
      }
    });
    if (sonuc) { bildir('Stok güncellendi', 'basari'); urunleriCiz(); }
  }

  async function topluFiyat() {
    const kategoriler = [...new Set(DB.hepsi('urunler').map(x => x.kategori))].sort();
    const sonuc = await modal(`
      <h3>Toplu fiyat güncelleme</h3>
      <label>Kategori<select name="kat"><option value="">Tümü</option>${kategoriler.map(k => `<option>${esc(k)}</option>`).join('')}</select></label>
      <label>Yöntem<select name="tip"><option value="yuzde">Yüzde (%)</option><option value="tutar">Sabit tutar (₺)</option></select></label>
      <label>Değer (indirim için eksi)<input name="deger" inputmode="decimal" required autofocus placeholder="Örn. 10"></label>
      <label class="kontrol"><input type="checkbox" name="yuvarla" checked> 0,50 ₺'ye yuvarla</label>
      ${modalAlt('Uygula', 'turuncu')}`, {
      onGonder: fd => {
        const deger = parseFloat(String(fd.get('deger')).replace(',', '.'));
        if (isNaN(deger)) return false;
        const liste = DB.filtre('urunler', u => !fd.get('kat') || u.kategori === fd.get('kat'));
        liste.forEach(u => {
          let yeni = fd.get('tip') === 'yuzde' ? Math.round(u.satisKurus * (1 + deger / 100)) : u.satisKurus + Math.round(deger * 100);
          if (fd.get('yuvarla') === 'on') yeni = Math.round(yeni / 50) * 50;
          u.satisKurus = Math.max(0, yeni);
          DB.kaydet('urunler', u);
        });
        return liste.length;
      }
    });
    if (sonuc) { bildir(sonuc + ' ürünün fiyatı güncellendi', 'basari'); urunleriCiz(); }
  }

  function siparisListesi() {
    const liste = DB.filtre('urunler', u => u.stok <= u.kritik).sort((a, b) => a.kategori.localeCompare(b.kategori, 'tr'));
    const satirlar = liste.map(u => `<tr><td>${esc(u.kategori)}</td><td>${esc(u.ad)}</td><td class="sag">${u.stok}</td><td class="sag">${Math.max(0, Math.ceil(u.kritik * 2 - u.stok))}</td></tr>`).join('');
    const tablo = `<table class="tablo"><thead><tr><th>Kategori</th><th>Ürün</th><th class="sag">Stok</th><th class="sag">Önerilen</th></tr></thead><tbody>${satirlar || '<tr><td colspan="4">Kritik stokta ürün yok.</td></tr>'}</tbody></table>`;
    modal(`<h3>Sipariş listesi (${liste.length})</h3><p class="not">Önerilen miktar = kritik × 2 − stok</p><div class="kaydir">${tablo}</div>
      <div class="modal-alt"><button class="btn" value="iptal">Kapat</button><button class="btn yesil" type="button" id="sipYazdir">Yazdır</button></div>`,
      { onAc: f => f.querySelector('#sipYazdir').onclick = () => yazdir(`<h2>Sipariş listesi</h2><p>${new Date().toLocaleDateString('tr-TR')}</p>${tablo}`, 'A4') });
  }

  /* CSV: ; ayraçlı (Türkçe Excel uyumlu) */
  const CSV_BASLIK = ['barkod', 'ad', 'kategori', 'alis', 'satis', 'kdv', 'stok', 'kritik', 'birim', 'teraziKodu', 'hizli'];
  function csvDisa() {
    const hucre = v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    const satirlar = DB.hepsi('urunler').map(u => [u.barkod, u.ad, u.kategori, tlInput(u.alisKurus), tlInput(u.satisKurus), u.kdv, u.stok, u.kritik, u.birim, u.teraziKodu, u.hizli ? 1 : 0].map(hucre).join(';'));
    indir('urunler.csv', '﻿' + [CSV_BASLIK.join(';'), ...satirlar].join('\r\n'), 'text/csv');
  }
  function csvAyristir(metin) {
    const satirlar = []; let satir = [], hucre = '', tirnak = false;
    for (let i = 0; i < metin.length; i++) {
      const c = metin[i];
      if (tirnak) { if (c === '"' && metin[i + 1] === '"') { hucre += '"'; i++; } else if (c === '"') tirnak = false; else hucre += c; }
      else if (c === '"') tirnak = true;
      else if (c === ';' || c === ',' && !metin.includes(';')) { satir.push(hucre); hucre = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && metin[i + 1] === '\n') i++; satir.push(hucre); satirlar.push(satir); satir = []; hucre = ''; }
      else hucre += c;
    }
    if (hucre || satir.length) { satir.push(hucre); satirlar.push(satir); }
    return satirlar.filter(s => s.some(h => h.trim()));
  }
  function csvIce(dosya) {
    const r = new FileReader();
    r.onload = () => {
      const satirlar = csvAyristir(String(r.result).replace(/^﻿/, ''));
      const baslik = satirlar.shift().map(h => h.trim());
      let eklenen = 0, guncellenen = 0, hatali = 0;
      satirlar.forEach(s => {
        const o = {}; baslik.forEach((h, i) => (o[h] = (s[i] || '').trim()));
        if (!o.ad) { hatali++; return; }
        const alis = tlToKurus(o.alis || '0'), satis = tlToKurus(o.satis || '0');
        if (isNaN(alis) || isNaN(satis)) { hatali++; return; }
        const mevcut = (o.barkod && DB.bul('urunler', u => u.barkod === o.barkod)) || DB.bul('urunler', u => u.ad === o.ad);
        DB.kaydet('urunler', {
          ...(mevcut || {}), barkod: o.barkod || '', ad: o.ad, kategori: o.kategori || 'Genel', alisKurus: alis, satisKurus: satis,
          kdv: parseInt(o.kdv, 10) || 20, stok: parseFloat(String(o.stok).replace(',', '.')) || 0, kritik: parseFloat(String(o.kritik).replace(',', '.')) || 0,
          birim: o.birim === 'kg' ? 'kg' : 'adet', teraziKodu: o.teraziKodu || '', hizli: o.hizli === '1' || (mevcut ? mevcut.hizli : false)
        });
        mevcut ? guncellenen++ : eklenen++;
      });
      bildir(`${eklenen} eklendi, ${guncellenen} güncellendi${hatali ? ', ' + hatali + ' satır atlandı' : ''}`, 'basari');
      urunleriCiz();
    };
    r.readAsText(dosya, 'utf-8');
  }

  function indir(ad, icerik, tur) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([icerik], { type: tur + ';charset=utf-8' }));
    a.download = ad;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ================= VERESİYE ================= */
  function musterileriCiz() {
    const q = $('#musteriAra').value.toLocaleLowerCase('tr');
    const liste = DB.filtre('musteriler', m => !q || m.ad.toLocaleLowerCase('tr').includes(q) || (m.tel || '').includes(q))
      .sort((a, b) => b.borcKurus - a.borcKurus);
    $('#musteriGovde').innerHTML = liste.map(m => `
      <tr class="tikla ${seciliMusteri === m.id ? 'secili' : ''} ${m.limitKurus && m.borcKurus > m.limitKurus ? 'kritik' : ''}" data-musteri="${m.id}">
        <td>${esc(m.ad)}</td><td>${esc(m.tel)}</td><td class="sag kalin">${tl(m.borcKurus)}</td><td class="sag">${m.limitKurus ? tl(m.limitKurus) : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="bos">Müşteri yok.</td></tr>';
    musteriDetayCiz();
  }

  function musteriDetayCiz() {
    const el = $('#musteriDetay');
    const m = seciliMusteri && DB.al('musteriler', seciliMusteri);
    if (!m) { el.innerHTML = '<p class="bos">Detay için bir müşteri seçin.</p>'; return; }
    const hareketler = DB.filtre('cariHareketler', h => h.musteriId === m.id).sort((a, b) => b.tarih.localeCompare(a.tarih));
    el.innerHTML = `
      <div class="detay-bas"><div><h3>${esc(m.ad)}</h3><p class="not">${esc(m.tel || '')}</p></div>
        <div class="sag"><span class="not">Güncel borç</span><div class="dev">${tl(m.borcKurus)}</div></div></div>
      <div class="satir"><button class="btn yesil" id="tahsilatBtn">Ödeme al</button><button class="btn" id="ekstreBtn">Ekstre yazdır</button><button class="btn" id="musteriDuzenleBtn">Düzenle</button></div>
      <table class="tablo"><thead><tr><th>Tarih</th><th>Açıklama</th><th class="sag">Borç</th><th class="sag">Ödeme</th></tr></thead>
      <tbody>${hareketler.map(h => `<tr><td>${new Date(h.tarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${esc(h.aciklama)}</td>
        <td class="sag">${h.tip === 'borc' ? tl(h.tutar) : ''}</td><td class="sag">${h.tip === 'odeme' ? tl(h.tutar) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="bos">Hareket yok.</td></tr>'}</tbody></table>`;
    $('#tahsilatBtn').onclick = () => tahsilat(m);
    $('#musteriDuzenleBtn').onclick = () => musteriFormu(m);
    $('#ekstreBtn').onclick = () => yazdir(`<h2>${esc(ayar().isletmeAdi)}</h2><p>Hesap ekstresi · ${esc(m.ad)}<br>${new Date().toLocaleDateString('tr-TR')}</p>
      <table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="sag">Borç</th><th class="sag">Ödeme</th></tr></thead><tbody>
      ${hareketler.slice().reverse().map(h => `<tr><td>${new Date(h.tarih).toLocaleDateString('tr-TR')}</td><td>${esc(h.aciklama)}</td><td class="sag">${h.tip === 'borc' ? tl(h.tutar) : ''}</td><td class="sag">${h.tip === 'odeme' ? tl(h.tutar) : ''}</td></tr>`).join('')}
      </tbody></table><p><b>Güncel borç: ${tl(m.borcKurus)}</b></p>`, 'A4');
  }

  async function tahsilat(m) {
    const sonuc = await modal(`
      <h3>Ödeme al · ${esc(m.ad)}</h3><p>Borç: <b>${tl(m.borcKurus)}</b></p>
      <label>Tutar<input name="tutar" inputmode="decimal" required autofocus value="${tlInput(m.borcKurus)}"></label>
      <label>Ödeme türü<select name="tur"><option value="nakit">Nakit</option><option value="kart">Kart</option></select></label>
      ${modalAlt('Tahsil et')}`, {
      onGonder: fd => {
        const t = tlToKurus(fd.get('tutar'));
        if (!(t > 0)) { bildir('Geçerli bir tutar girin', 'hata'); return false; }
        if (t > m.borcKurus && !confirm('Tutar borçtan fazla, müşteri alacaklı duruma geçecek. Devam?')) return false;
        m.borcKurus -= t;
        DB.kaydet('musteriler', m);
        DB.kaydet('cariHareketler', { musteriId: m.id, tarih: new Date().toISOString(), tip: 'odeme', tutar: t, odemeTuru: fd.get('tur'), aciklama: 'Tahsilat (' + fd.get('tur') + ')' });
        return true;
      }
    });
    if (sonuc) { bildir('Tahsilat kaydedildi', 'basari'); musterileriCiz(); }
  }

  async function musteriFormu(m = {}) {
    const sonuc = await modal(`
      <h3>${m.id ? 'Müşteriyi düzenle' : 'Yeni müşteri'}</h3>
      <label>Ad soyad<input name="ad" required autofocus value="${esc(m.ad)}"></label>
      <label>Telefon<input name="tel" inputmode="tel" value="${esc(m.tel)}"></label>
      <label>Borç limiti (₺, 0 = limitsiz)<input name="limit" inputmode="decimal" value="${m.limitKurus ? tlInput(m.limitKurus) : '0'}"></label>
      ${modalAlt('Kaydet')}`, {
      onGonder: fd => DB.kaydet('musteriler', { borcKurus: 0, ...m, ad: fd.get('ad').trim(), tel: fd.get('tel').trim(), limitKurus: tlToKurus(fd.get('limit')) || 0 })
    });
    if (sonuc) { seciliMusteri = sonuc.id; musterileriCiz(); }
  }

  /* ================= RAPORLAR ================= */
  function raporVerisi() {
    const bas = $('#raporBas').value, bit = $('#raporBit').value;
    const aralik = s => { const g = gunAnahtari(s.tarih); return g >= bas && g <= bit; };
    const satislar = DB.filtre('satislar', aralik).sort((a, b) => b.tarih.localeCompare(a.tarih));
    const tahsilatlar = DB.filtre('cariHareketler', h => h.tip === 'odeme' && aralik(h));
    const r = { satisAdet: 0, iadeAdet: 0, brut: 0, iade: 0, nakit: 0, kart: 0, veresiye: 0, kar: 0, tahsilat: 0, urun: {}, kategori: {}, kasiyer: {}, satislar };
    satislar.forEach(s => {
      const isaret = s.iade ? -1 : 1;
      if (s.iade) { r.iadeAdet++; r.iade += s.toplam; } else { r.satisAdet++; r.brut += s.toplam; }
      r.nakit += isaret * s.odeme.nakit; r.kart += isaret * s.odeme.kart; r.veresiye += isaret * s.odeme.veresiye;
      r.kar += isaret * Sepet.brutKar(s.kalemler);
      const ks = (r.kasiyer[s.kasiyer] = r.kasiyer[s.kasiyer] || { adet: 0, ciro: 0 }); ks.adet += s.iade ? 0 : 1; ks.ciro += isaret * s.toplam;
      s.kalemler.forEach(k => {
        const u = (r.urun[k.ad] = r.urun[k.ad] || { miktar: 0, birim: k.birim, ciro: 0, kar: 0 });
        u.miktar += isaret * k.miktar; u.ciro += isaret * k.tutar; u.kar += isaret * (k.tutar - carp(k.alisFiyat || 0, k.miktar));
        const kat = (DB.al('urunler', k.urunId) || {}).kategori || 'Diğer';
        r.kategori[kat] = (r.kategori[kat] || 0) + isaret * k.tutar;
      });
    });
    r.net = r.brut - r.iade;
    r.tahsilat = tahsilatlar.reduce((a, h) => a + h.tutar, 0);
    r.tahsilatNakit = tahsilatlar.filter(h => h.odemeTuru !== 'kart').reduce((a, h) => a + h.tutar, 0);
    return r;
  }

  function raporCiz() {
    const r = raporVerisi();
    const kart = (b, d, alt = '') => `<div class="rapor-kart"><span>${b}</span><strong>${d}</strong>${alt ? `<small>${alt}</small>` : ''}</div>`;
    $('#raporKartlar').innerHTML = [
      kart('Net ciro', tl(r.net), r.satisAdet + ' satış'),
      kart('Nakit', tl(r.nakit)), kart('Kart', tl(r.kart)), kart('Veresiye (yeni borç)', tl(r.veresiye)),
      kart('Veresiye tahsilatı', tl(r.tahsilat)), kart('İade', tl(r.iade), r.iadeAdet + ' fiş'),
      kart('Brüt kâr', tl(r.kar), r.net ? '%' + (r.kar / r.net * 100).toFixed(1) : ''),
      kart('Kasada olması gereken nakit', tl(r.nakit + r.tahsilatNakit))
    ].join('');
    $('#raporUrun').innerHTML = Object.entries(r.urun).sort((a, b) => b[1].ciro - a[1].ciro).map(([ad, u]) =>
      `<tr><td>${esc(ad)}</td><td class="sag">${miktarYaz(Math.round(u.miktar * 1000) / 1000, u.birim)}</td><td class="sag">${tl(u.ciro)}</td><td class="sag">${tl(u.kar)}</td></tr>`).join('') || '<tr><td colspan="4" class="bos">Bu aralıkta satış yok.</td></tr>';
    $('#raporKategori').innerHTML = Object.entries(r.kategori).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="sag">${tl(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="bos">—</td></tr>';
    $('#raporKasiyer').innerHTML = Object.entries(r.kasiyer).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="sag">${v.adet}</td><td class="sag">${tl(v.ciro)}</td></tr>`).join('') || '<tr><td colspan="3" class="bos">—</td></tr>';
    $('#raporSatislar').innerHTML = r.satislar.slice(0, 50).map(s => {
      const od = ['nakit', 'kart', 'veresiye'].filter(t => s.odeme[t]).join(' + ');
      return `<tr class="${s.iade ? 'iade-satir' : ''}"><td>${new Date(s.tarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>#${s.fisNo}${s.iade ? ' (iade)' : ''}</td>
        <td class="sag">${s.iade ? '−' : ''}${tl(s.toplam)}</td><td>${od}</td><td class="sag"><button class="mini" data-fis="${s.id}">Fiş</button></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="bos">—</td></tr>';
  }

  function gunSonuYazdir() {
    const r = raporVerisi();
    const a = ayar();
    const fs = (k, v) => `<div class="fs"><span>${k}</span><b>${v}</b></div>`;
    yazdir(`<h2>${esc(a.isletmeAdi)}</h2><p>GÜN SONU RAPORU<br>${$('#raporBas').value} – ${$('#raporBit').value}<br>Yazdırma: ${new Date().toLocaleString('tr-TR')}</p><hr>
      ${fs('Satış adedi', r.satisAdet)}${fs('Brüt satış', tl(r.brut))}${fs('İade (' + r.iadeAdet + ')', tl(r.iade))}${fs('NET', tl(r.net))}<hr>
      ${fs('Nakit', tl(r.nakit))}${fs('Kart', tl(r.kart))}${fs('Veresiye', tl(r.veresiye))}${fs('Veresiye tahsilatı', tl(r.tahsilat))}<hr>
      ${fs('Kasadaki nakit', tl(r.nakit + r.tahsilatNakit))}${fs('Brüt kâr', tl(r.kar))}<hr><p>Bilgi amaçlıdır, mali Z raporu değildir.</p>`);
  }

  /* ================= AYARLAR ================= */
  function ayarlariCiz() {
    const a = ayar(), f = $('#ayarForm');
    f.isletmeAdi.value = a.isletmeAdi || ''; f.kasiyer.value = a.kasiyer || ''; f.fisAltNot.value = a.fisAltNot || '';
  }
  function basligiGuncelle() { $('#isletmeAdi').textContent = ayar().isletmeAdi || 'market-pos'; }

  /* ================= OLAYLAR ================= */
  function olaylar() {
    $$('.sekme').forEach(b => (b.onclick = () => sayfaGoster(b.dataset.sayfa)));

    $('#barkodForm').onsubmit = e => { e.preventDefault(); const v = $('#barkodGiris').value; $('#barkodGiris').value = ''; barkodIsle(v); };
    $('#barkodGiris').addEventListener('input', e => {
      const v = e.target.value.trim();
      if (v.length >= 2 && !/^\d+$/.test(v)) aramaListesi(aramaYap(v)); else $('#aramaSonuc').hidden = true;
    });

    document.addEventListener('click', e => {
      const t = e.target.closest('button, tr');
      if (!t) return;
      const d = t.dataset;
      if (d.hizli) { const u = DB.al('urunler', d.hizli); const m = parseFloat($('#miktarGiris').value) || 1; $('#miktarGiris').value = 1; urunEkle(u, u.birim === 'kg' && m === 1 ? null : m); }
      else if (d.ara) { $('#barkodGiris').value = ''; $('#aramaSonuc').hidden = true; const u = DB.al('urunler', d.ara); urunEkle(u, u.birim === 'kg' ? null : 1); }
      else if (d.sil != null) { Sepet.sil(sepet, +d.sil); kasaCiz(); odakla(); }
      else if (d.miktar != null) miktarSor(+d.miktar);
      else if (d.odeme) odemeBaslat(d.odeme);
      else if (d.bekleyen != null) bekleyeniAl(+d.bekleyen);
      else if (d.duzenle) urunFormu(DB.al('urunler', d.duzenle));
      else if (d.stok) stokDuzelt(DB.al('urunler', d.stok));
      else if (d.musteri) { seciliMusteri = d.musteri; musterileriCiz(); }
      else if (d.fis) yazdir(fisHtml(DB.al('satislar', d.fis)));
    });

    $('#bekletBtn').onclick = beklet;
    $('#iadeBtn').onclick = iadeDegistir;
    $('#iptalBtn').onclick = iptal;

    $('#urunAra').oninput = urunleriCiz;
    $('#sadeceKritik').onchange = urunleriCiz;
    $('#yeniUrunBtn').onclick = () => urunFormu();
    $('#topluFiyatBtn').onclick = topluFiyat;
    $('#siparisListesiBtn').onclick = siparisListesi;
    $('#csvDisaBtn').onclick = csvDisa;
    $('#csvGiris').onchange = e => { if (e.target.files[0]) csvIce(e.target.files[0]); e.target.value = ''; };

    $('#musteriAra').oninput = musterileriCiz;
    $('#yeniMusteriBtn').onclick = () => musteriFormu();

    const bugun = gunAnahtari(new Date());
    $('#raporBas').value = bugun; $('#raporBit').value = bugun;
    $('#raporBas').onchange = $('#raporBit').onchange = raporCiz;
    $('#gunSonuYazdir').onclick = gunSonuYazdir;

    $('#ayarForm').onsubmit = e => {
      e.preventDefault();
      const f = e.target;
      DB.kaydet('ayarlar', { ...ayar(), isletmeAdi: f.isletmeAdi.value.trim(), kasiyer: f.kasiyer.value.trim(), fisAltNot: f.fisAltNot.value.trim() });
      basligiGuncelle(); bildir('Ayarlar kaydedildi', 'basari');
    };
    $('#yedekAlBtn').onclick = () => {
      const veri = {}; ['urunler', 'satislar', 'musteriler', 'cariHareketler', 'stokHareketler', 'ayarlar'].forEach(t => (veri[t] = DB.hepsi(t)));
      indir('market-pos-yedek-' + gunAnahtari(new Date()) + '.json', JSON.stringify({ surum: 1, tarih: new Date().toISOString(), veri }, null, 1), 'application/json');
    };
    $('#yedekGiris').onchange = e => {
      const d = e.target.files[0]; if (!d) return;
      const r = new FileReader();
      r.onload = async () => {
        try {
          const y = JSON.parse(r.result);
          if (!y.veri || !y.veri.urunler) throw new Error();
          if (!confirm('Mevcut veriler silinip yedek yüklenecek. Emin misiniz?')) return;
          await DB.sifirla(); await DB.baslat();
          Object.entries(y.veri).forEach(([t, liste]) => liste.forEach(k => DB.kaydet(t, k)));
          basligiGuncelle(); bildir('Yedek yüklendi', 'basari'); sayfaGoster('kasa');
        } catch { bildir('Yedek dosyası okunamadı', 'hata'); }
      };
      r.readAsText(d); e.target.value = '';
    };
    $('#sifirlaBtn').onclick = async () => {
      if (!confirm('Tüm satış, ürün ve müşteri verileri silinecek. Emin misiniz?')) return;
      await DB.sifirla(); await DB.baslat(); Demo.yukle(DB, Para); basligiGuncelle(); bildir('Veriler sıfırlandı, demo veri yüklendi'); sayfaGoster('kasa');
    };

    document.addEventListener('keydown', e => {
      if ($('#modal').open) return;
      const tus = { F1: () => odemeBaslat('nakit'), F2: () => odemeBaslat('kart'), F3: () => odemeBaslat('parcali'), F4: () => odemeBaslat('veresiye'), F8: beklet, F9: iadeDegistir, Escape: iptal }[e.key];
      if (tus && aktifSayfa === 'kasa') { e.preventDefault(); tus(); }
    });
    document.addEventListener('keydown', e => {
      // Kasada barkod okuyucu, odak başka yerdeyken de yakalansın
      if (aktifSayfa !== 'kasa' || $('#modal').open) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA')) return;
      if (/^[\w\d]$/.test(e.key)) $('#barkodGiris').focus();
    });

    const baglanti = () => { $('#baglanti').className = 'nokta ' + (navigator.onLine ? 'acik' : 'kapali'); $('#baglanti').title = navigator.onLine ? 'Çevrimiçi' : 'Çevrimdışı – satışlar cihazda saklanıyor'; };
    addEventListener('online', baglanti); addEventListener('offline', baglanti); baglanti();
    const saat = () => ($('#saat').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    saat(); setInterval(saat, 15000);
  }

  async function miktarSor(i) {
    const k = sepet.kalemler[i];
    const m = await modal(`<h3>${esc(k.ad)}</h3><label>Miktar (${k.birim})<input name="m" type="number" step="${k.birim === 'kg' ? '0.001' : '1'}" min="0" value="${k.miktar}" required autofocus></label><p class="not">0 girerseniz satır silinir.</p>${modalAlt('Güncelle')}`,
      { onGonder: fd => ({ m: parseFloat(fd.get('m')) }) });
    if (m) { Sepet.miktarDegistir(sepet, i, m.m); kasaCiz(); }
    odakla();
  }

  function beklet() {
    if (!sepet.kalemler.length) return bildir('Bekletilecek sepet yok');
    if (sepet.iade) return bildir('İade sepeti bekletilemez', 'hata');
    bekleyenler.push(sepet);
    sepet = Sepet.yeniSepet();
    bildir('Sepet beklemeye alındı');
    kasaCiz(); odakla();
  }
  function bekleyeniAl(i) {
    if (sepet.kalemler.length) { if (sepet.iade) return bildir('Önce iadeyi tamamlayın', 'hata'); bekleyenler.push(sepet); }
    sepet = bekleyenler.splice(i, 1)[0];
    kasaCiz(); odakla();
  }
  function iadeDegistir() {
    if (sepet.kalemler.length && !confirm('Mevcut sepet temizlenecek. Devam?')) return;
    const iade = !sepet.iade;
    sepet = Sepet.yeniSepet(); sepet.iade = iade;
    kasaCiz(); odakla();
  }
  function iptal() {
    if (!sepet.kalemler.length) { if (sepet.iade) { sepet.iade = false; kasaCiz(); } return; }
    if (confirm('Sepet iptal edilsin mi?')) sepetiTemizle();
  }

  /* ================= BAŞLAT ================= */
  async function baslat() {
    await DB.baslat();
    if (DB.bosMu()) Demo.yukle(DB, Para);
    basligiGuncelle();
    olaylar();
    sayfaGoster('kasa');
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__marketPos = { DB, sepet: () => sepet, fisHtml, sonSatis: () => sonSatis }; // geliştirici konsolu için
  }
  baslat();
})();
