/* Neon Strike — minimal offline service worker */
const CACHE = 'neon-strike-v2';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  './manifest.json',
  './src/config.js',
  './src/systems/achievements.js',
  './src/systems/daily.js',
  './src/systems/ads.js',
  './src/systems/iap.js',
  './src/client/pb.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // network-first for HTML, cache-first for assets; CDN phaser cached when seen
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
