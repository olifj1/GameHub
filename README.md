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


## v1.0.60
- Logic programme editing: selecting an existing command and pressing a command now replaces it in place; + slots still insert and no selection still appends.


## v1.0.60
- Added Flight: a side-scrolling aeroplane game with engine start/stop, pitch controls, full loops, hoop collection and safe runway landings.
- Added the new Flight card and line-art aeroplane icon to the GameHub home screen.


## v1.0.60
- Flight engine-off behaviour now uses momentum and gravity rather than simply running the powered model more slowly.
- Gliding trades speed for height, diving regains speed, and sustained engine-off climbing is no longer possible.


## v1.0.60
- Flight now runs in landscape and asks the player to rotate to landscape when opened in portrait.
- Flight canvas widened to 16:9 for much better forward visibility.
- Final runway lengthened and safe-landing limits made more forgiving.
- Glide diving now has aerodynamic speed limiting and a small runway ground-effect cushion.
- Added six optional collectible stars throughout the course and a Stars HUD counter.


## v1.0.60
- Removed the shared 280 ms iOS touch-end suppression that could discard every second rapid tap.
- Double-tap zoom prevention now uses CSS touch-action rather than blocking valid tap events.
- Added one shared immediate press helper and applied it to the rapid number controls in Times Tables, Sums and Maths.


## v1.0.60
- Flight returns to portrait orientation so it keeps the Home Screen/full-screen feel on iPhone.
- Restored the three-across Up / Engine / Down controls for natural two-thumb play.
- Kept the longer finish runway, easier landing envelope, improved glide physics and collectible stars from the landscape experiment.


## v1.0.60
- Flight win result is now a compact translucent card instead of a full-screen overlay.
- Successful touchdown remains visible for a short moment before the result appears.
- Crash messages remain full-screen and prominent.


## v1.0.60
- Flight now lets a successful landing roll naturally to a complete stop before showing the compact result card.
- Reworked the aircraft into a code-drawn side-on biplane, including the GameHub home icon.
- Powered flight now uses thrust plus gravity: climbing has a little more energy, but a vertical stall falls rather than hovering, and diving restores control/speed.
- Added directional rings with visible approach arrows and rotated ring planes.
- Added Easy / Medium / Hard Flight courses: 2, 4 and 6 rings respectively, with progressively more angled and vertical approaches.


## v1.0.60
- Flight overall travel speed reduced while pitch response was increased, producing calmer forward motion and substantially tighter loops.
- Powered vertical climbing retains useful momentum a little longer, while low-speed stalls now fall more decisively under gravity.
- Flight view is slightly zoomed out by increasing the internal 4:3 canvas world area; the biplane appears about 7% smaller and more sky/world is visible.
- Glide top speed reduced to match the calmer powered-flight pace.
- Landing limits and the satisfying post-touchdown runway roll are unchanged.


## v1.0.60
- Added Easy / Medium / Hard difficulty selection to Gravity.
- Easy is a short, sparse launch-to-finish course with no required checkpoint or collectables.
- Medium uses a longer map with one required checkpoint, three stars and more terrain.
- Hard uses the full five-screen route with three required checkpoint landings, six stars and a denser mix of high/low platforms and vertical obstacles.
- Gravity difficulty is remembered between sessions.


## v1.0.60
- Tell the Time now has Explore and Test modes.
- Test mode generates a target time in five-minute increments, asks the player to set the analogue clock, and provides Check / New time feedback.
- The selected digital time and exact numeric slider readouts are hidden during Test mode so the analogue clock must actually be used.
- Incorrect answers can be adjusted and checked again without replacing the question.


## v1.0.60
- Gravity difficulty now sets baseline gravity to 0.010 on Easy, 0.015 on Medium and 0.020 on Hard.
- The Gravity tuning slider remains available after the difficulty default is applied.
- Successful finish-pad landings remain fully visible for 0.75 seconds before the result appears.
- Gravity success now uses a compact translucent result card; crash and missing-checkpoint messages remain prominent.


## v1.0.60
- Tell the Time Test prompt and Check/New time action now share one row, with the prompt on the left and a compact action button on the right.
- Removed the separate bottom Test action row that could fall below the visible phone viewport.
- Test mode clock and vertical spacing are slightly reduced, with additional compact rules on shorter Safari viewports where browser chrome consumes more height.


## v1.0.60
- Every Tell the Time Test question now starts with the clock at 12:00 instead of a random starting time.
- 12:00 is excluded from generated targets so a new question never begins already solved.
