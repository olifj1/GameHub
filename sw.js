const CACHE = 'gamehub-v1.8.72';
const CORE = [
  './',
  './index.html',
  './progress.html',
  './style.css',
  './site-config.js',
  './core.js',
  './home.js',
  './walk-rig.js',
  './game-16.js',
  './game-17.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './walklab-rig-v4.png',
  './sidescroll-tree-01.png', './sidescroll-tree-02.png', './sidescroll-tree-03.png', './sidescroll-tree-04.png', './sidescroll-tree-05.png', './sidescroll-tree-06.png',
  './sidescroll-ground-01.png', './sidescroll-ground-02.png', './sidescroll-ground-03.png', './sidescroll-ground-04.png', './sidescroll-ground-05.png', './sidescroll-ground-06.png', './sidescroll-ground-07.png', './sidescroll-ground-08.png', './sidescroll-ground-09.png', './sidescroll-ground-10.png', './sidescroll-ground-11.png', './sidescroll-ground-12.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
