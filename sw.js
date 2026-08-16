const CACHE = "gamehub-v1.0.1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./site-config.js",
  "./home.js",
  "./core.js",
  "./style.css",
  "./icon-192.png",
  "./icon-512.png",
  "./game-01.html",
  "./game-01.js",
  "./game-02.html",
  "./game-02.js",
  "./game-03.html",
  "./game-03.js",
  "./game-04.html",
  "./game-04.js",
  "./game-05.html",
  "./game-05.js",
  "./game-06.html",
  "./game-06.js",
  "./game-07.html",
  "./game-07.js",
  "./game-08.html",
  "./game-08.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
