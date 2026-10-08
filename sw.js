// Memory Pair service worker
// Caches the app shell and all card images so the game works offline
// and can be installed as a local PWA.

const CACHE = 'mempair-v1';
const ASSETS = [
  'index.html',
  'manifest.webmanifest',
  'style.css',
  'game.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'assets/back.png'
];

// Card faces are generated dynamically (assets/01.jpg .. assets/NN.jpg).
// The largest board is 6x12 = 72 cards = 36 pairs, so pre-cache 01..36.
for (let i = 1; i <= 36; i++) {
  ASSETS.push('assets/' + String(i).padStart(2, '0') + '.jpg');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation requests, cache-first for everything else.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached)
    )
  );
});
