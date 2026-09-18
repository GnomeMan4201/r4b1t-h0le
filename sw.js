const CACHE = 'r4b1t-v18-network-first';
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
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Corpus reads and Worker traffic must always use their explicit network policy.
  if (
    url.origin !== self.location.origin ||
    url.pathname.endsWith('/urls.txt') ||
    url.hostname.endsWith('workers.dev')
  ) {
    return;
  }

  // Prefer current deployed bytes. The precache remains an offline fallback.
  e.respondWith((async () => {
    try {
      const response = await fetch(e.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(e.request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(e.request);
      return cached || new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
