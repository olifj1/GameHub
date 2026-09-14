const CACHE = "gamehub-v1.8.70";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./site-config.js",
  "./home.js",
  "./progress.html",
  "./progress.js",
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
  "./game-08.js",
  "./game-09.html",
  "./game-09.js",
  "./game-10.html",
  "./game-10.js",
  "./game-11.html",
  "./game-11.js",
  "./game-12.html",
  "./game-12.js",
  "./game-13.html",
  "./game-13.js",
  "./game-14.html",
  "./game-14.js",
  "./game-15.html",
  "./game-15.js",
  "./game-16.html",
  "./game-16.js",
  "./game-17.html",
  "./game-17.js",
  "./walklab-character-source.png",
  "./walklab-rig-v3-mask.png",
  "./walklab-rig-v3-template.png",
  "./walklab-rig-v3.png",
  "./walk-rig.js",
  "./walk-lab-reference.png",
  "./walklab-rig-parts.png",
  "./walklab-rig-parts-source.png",
  "./sidescroll-character-sheet.png",
  "./sidescroll-character-walk.png",
  "./sidescroll-character-walk-source.png",
  "./sidescroll-character-sheet-source.png",
  "./sidescroll-woodland-tree.png",
  "./sidescroll-woodland-ground.png",
  "./sidescroll-tree-01.png",
  "./sidescroll-tree-02.png",
  "./sidescroll-tree-03.png",
  "./sidescroll-tree-04.png",
  "./sidescroll-tree-05.png",
  "./sidescroll-tree-06.png",
  "./sidescroll-ground-01.png",
  "./sidescroll-ground-02.png",
  "./sidescroll-ground-03.png",
  "./sidescroll-ground-04.png",
  "./sidescroll-ground-05.png",
  "./sidescroll-ground-06.png",
  "./sidescroll-ground-07.png",
  "./sidescroll-ground-08.png",
  "./sidescroll-ground-09.png",
  "./sidescroll-ground-10.png",
  "./sidescroll-ground-11.png",
  "./sidescroll-ground-12.png",
  "./tower-assets.js",
  "./tower-vehicles.png",
  "./tower-defences.png",
  "./tower-scenery.png",
  "./tower-terrain.png"
];

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.min.js";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      await cache.addAll(APP_SHELL);
      // Three.js is cached separately so a temporary CDN failure cannot block
      // the rest of the GameHub service-worker update.
      try { await cache.add(THREE_URL); } catch (_) {}
    })
  );
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
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        // HTML uses cache-busting query strings such as style.css?v=1.8.13,
        // while APP_SHELL pre-caches the same files without the query string.
        // ignoreSearch lets those pre-cached assets satisfy offline requests.
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          const home = await caches.match("./index.html", { ignoreSearch: true });
          if (home) return home;
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" }
        });
      })
  );
});
