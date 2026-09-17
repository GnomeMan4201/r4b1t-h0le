const CACHE = 'r4b1t-v17-path-consistency';
const PRECACHE = [
  './',
  './index.html',
  './anime.min.js',
  './anime-core.min.js',
  './motion-tokens.js',
  './dual-shell.js',
  './dual-shell.css',
  './trail-manifest.js',
  './trail-runtime.js',
  './blind-manifest.js',
  './blind-runtime.js',
  './trail-topology.js',
  './topology-runtime.js',
  './trail-wear.js',
  './trail-wear.css',
  './rabbit-aperture.svg',
  './banana-note.svg',
  './favicon.ico',
  './favicon.svg',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for the corpus and Worker API calls; cache first for shell assets.
  if (e.request.url.includes('urls.txt') || e.request.url.includes('workers.dev')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
