/* Çevrimdışı çalışma: uygulama dosyaları önbelleğe alınır, veriler zaten IndexedDB'de. */
const ONBELLEK = 'market-pos-v1';
const DOSYALAR = ['./', './index.html', './css/style.css', './js/para.js', './js/barkod.js', './js/sepet.js', './js/db.js', './js/demo.js', './js/app.js', './manifest.webmanifest', './assets/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== ONBELLEK).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
// Önce ağ, olmazsa önbellek: güncellemeler hemen gelir, internet yoksa kasa yine açılır.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => { const k = r.clone(); caches.open(ONBELLEK).then(c => c.put(e.request, k)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
