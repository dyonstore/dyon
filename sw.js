/* DYON service worker — offline-first shell cache.
   No analytics, no tracking. VERSION is a content hash of CORE, written by
   scripts/build-sw.php — never edit it by hand. A new worker waits until the
   page asks it to take over (the user taps "Reload"), so nothing updates
   silently under someone's half-typed form. */

const VERSION = 'dyon-1705c20bbcb9';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './vendor/fonts/fonts.css',
  './vendor/fonts/inter-latin-wght-normal.woff2',
  './vendor/fonts/inter-latin-ext-wght-normal.woff2',
  './vendor/fonts/noto-sans-arabic-arabic-wght-normal.woff2',
  './vendor/fonts/noto-kufi-arabic-arabic-wght-normal.woff2',
  './vendor/fa/icons.css',
  './vendor/fa/fa-solid-subset.woff2',
  './vendor/fa/fa-brands-subset.woff2',
  './locales/en.json',
  './locales/ar.json',
  './locales/fr.json',
  './js/app.js',
  './js/aside.js',
  './js/lang-aside.js',
  './js/i18n.js',
  './js/units.js',
  './js/db.js',
  './js/store.js',
  './js/content.js',
  './js/ui.js',
  './js/flows.js',
  './js/views.js',
  './js/views2.js',
  './js/validate.js',
  './js/guide.js',
  './js/guide-content.js',
  './js/auth.js',
  './js/auth-config.js',
  './js/qr.js',
  './js/vendor/qrcode-generator.js',
  './js/seed.js',
  './images/icon.svg',
  './images/icon-maskable.svg',
  './images/icon-512.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('dyon-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // DYON makes no third-party calls
  // Server endpoints and server-rendered pages are never served from cache.
  if (/^\/(api|admin|blog|news|events|storage|unsubscribe|ar|fr)(\/|$)/.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
