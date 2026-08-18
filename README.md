const CACHE = "gamehub-v1.0.21";
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


## v1.0.21
- Reading layout hard-polished: neutral background, consistent section spacing, Sums-style Difficulty selector, compact Voice + Read aloud row, shared vector speech icon, and smaller action controls.
- Added explicit v1.0.21 cache-busting to the home and Reading page asset URLs and game links to prevent iOS/GitHub Pages mixing stale HTML with newer CSS/JS.
- Corrected the configured Real World Maths display name to Maths.


## v1.0.24
Hub-wide visual consistency pass; vector home icons; neutral page backgrounds and Safari safe spacing; Coding rebuilt with animated forklift, difficulty-specific grid sizes, and crate pickup/drop challenges on Medium and Hard.

## v1.0.24
- Coding readability pass: stronger grid/obstacle contrast and clearer start, finish and drop targets.
- Replaced the subtle rover mark with a clear top-down forklift graphic and strong facing indicator.
- Restored the Coding Learning guide toggle and live program preview markers on the grid.
- Coding controls now use immediate pointer input so rapid command-to-Run, Undo and Clear taps are not swallowed by iOS double-tap protection.

## v1.0.24
- Refined Coding visuals to the clean line-art language used on Tell the Time.
- Dropped crates remain visible on the delivery target.
- Learning-guide direction badges render above the forklift, including turn-first programs.
- Clearer vector pick/drop, crate and delivery symbols.
- Program timeline is editable: tap a block to select it, move it earlier/later or delete it; tap a + insertion point then a command to insert at that position.


## v1.0.39
- Logic programme editing: selecting an existing command and pressing a command now replaces it in place; + slots still insert and no selection still appends.
