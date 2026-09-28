// Cache-first untuk semua aset. Naikkan VERSI setiap kali ada file yang berubah supaya HP mengambil versi baru.
const VERSI = 'capit-duit-v1';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Pixelify+Sans:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
const ASET = ['./', './index.html', './styles.css', './app.js', './logic.js', './db.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSI);
    await c.addAll(ASET);
    // Font Google ikut di-cache sejak kunjungan pertama. Gagal (mis. offline) tidak menggagalkan instal:
    // aplikasi tetap jalan dengan font sistem.
    try {
      const res = await fetch(FONT_CSS);
      if (res.ok) {
        const css = await res.clone().text();
        await c.put(FONT_CSS, res);
        await Promise.all([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => c.add(m[1])));
      }
    } catch { /* lihat komentar di atas */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSI) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const bolehCache = url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!bolehCache) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSI)).put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }
  })());
});

// Ketuk notifikasi pengingat → buka/fokuskan aplikasi.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const semua = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (semua.length) return semua[0].focus();
    return self.clients.openWindow('./');
  })());
});
