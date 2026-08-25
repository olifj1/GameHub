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


## v1.0.66
- Logic programme editing: selecting an existing command and pressing a command now replaces it in place; + slots still insert and no selection still appends.


## v1.0.66
- Added Flight: a side-scrolling aeroplane game with engine start/stop, pitch controls, full loops, hoop collection and safe runway landings.
- Added the new Flight card and line-art aeroplane icon to the GameHub home screen.


## v1.0.66
- Flight engine-off behaviour now uses momentum and gravity rather than simply running the powered model more slowly.
- Gliding trades speed for height, diving regains speed, and sustained engine-off climbing is no longer possible.


## v1.0.66
- Flight now runs in landscape and asks the player to rotate to landscape when opened in portrait.
- Flight canvas widened to 16:9 for much better forward visibility.
- Final runway lengthened and safe-landing limits made more forgiving.
- Glide diving now has aerodynamic speed limiting and a small runway ground-effect cushion.
- Added six optional collectible stars throughout the course and a Stars HUD counter.


## v1.0.66
- Removed the shared 280 ms iOS touch-end suppression that could discard every second rapid tap.
- Double-tap zoom prevention now uses CSS touch-action rather than blocking valid tap events.
- Added one shared immediate press helper and applied it to the rapid number controls in Times Tables, Sums and Maths.


## v1.0.66
- Flight returns to portrait orientation so it keeps the Home Screen/full-screen feel on iPhone.
- Restored the three-across Up / Engine / Down controls for natural two-thumb play.
- Kept the longer finish runway, easier landing envelope, improved glide physics and collectible stars from the landscape experiment.


## v1.0.66
- Flight win result is now a compact translucent card instead of a full-screen overlay.
- Successful touchdown remains visible for a short moment before the result appears.
- Crash messages remain full-screen and prominent.


## v1.0.66
- Flight now lets a successful landing roll naturally to a complete stop before showing the compact result card.
- Reworked the aircraft into a code-drawn side-on biplane, including the GameHub home icon.
- Powered flight now uses thrust plus gravity: climbing has a little more energy, but a vertical stall falls rather than hovering, and diving restores control/speed.
- Added directional rings with visible approach arrows and rotated ring planes.
- Added Easy / Medium / Hard Flight courses: 2, 4 and 6 rings respectively, with progressively more angled and vertical approaches.


## v1.0.66
- Flight overall travel speed reduced while pitch response was increased, producing calmer forward motion and substantially tighter loops.
- Powered vertical climbing retains useful momentum a little longer, while low-speed stalls now fall more decisively under gravity.
- Flight view is slightly zoomed out by increasing the internal 4:3 canvas world area; the biplane appears about 7% smaller and more sky/world is visible.
- Glide top speed reduced to match the calmer powered-flight pace.
- Landing limits and the satisfying post-touchdown runway roll are unchanged.


## v1.0.66
- Added Easy / Medium / Hard difficulty selection to Gravity.
- Easy is a short, sparse launch-to-finish course with no required checkpoint or collectables.
- Medium uses a longer map with one required checkpoint, three stars and more terrain.
- Hard uses the full five-screen route with three required checkpoint landings, six stars and a denser mix of high/low platforms and vertical obstacles.
- Gravity difficulty is remembered between sessions.


## v1.0.66
- Tell the Time now has Explore and Test modes.
- Test mode generates a target time in five-minute increments, asks the player to set the analogue clock, and provides Check / New time feedback.
- The selected digital time and exact numeric slider readouts are hidden during Test mode so the analogue clock must actually be used.
- Incorrect answers can be adjusted and checked again without replacing the question.


## v1.0.66
- Gravity difficulty now sets baseline gravity to 0.010 on Easy, 0.015 on Medium and 0.020 on Hard.
- The Gravity tuning slider remains available after the difficulty default is applied.
- Successful finish-pad landings remain fully visible for 0.75 seconds before the result appears.
- Gravity success now uses a compact translucent result card; crash and missing-checkpoint messages remain prominent.


## v1.0.66
- Tell the Time Test prompt and Check/New time action now share one row, with the prompt on the left and a compact action button on the right.
- Removed the separate bottom Test action row that could fall below the visible phone viewport.
- Test mode clock and vertical spacing are slightly reduced, with additional compact rules on shorter Safari viewports where browser chrome consumes more height.


## v1.0.66
- Every Tell the Time Test question now starts with the clock at 12:00 instead of a random starting time.
- 12:00 is excluded from generated targets so a new question never begins already solved.


## v1.0.66
- Tightened Tell the Time Explore mode to match the more compact Test layout.
- Slightly reduced the analogue clock size and vertical gaps around the digital time, day-cycle panel and sliders.
- Added extra compact rules for shorter Safari viewports so the lower controls stay visible when browser chrome is present.


## v1.0.66
- Tell the Time Test questions now specify the time of day, e.g. “8:35 in the morning”, “3:20 in the afternoon” or “7:45 in the evening”.
- Test targets now span the full 24-hour day rather than only 12 analogue positions.
- Answer checking now distinguishes matching hand positions at different times of day, so 08:35 and 20:35 are no longer treated as the same answer.


## v1.0.66
- Tell the Time Explore mode now uses the same analogue-clock scale as Test mode.
- This removes the remaining height difference that could push the lower Explore controls below shorter Safari viewports.


## v1.0.66
- Tell the Time day-cycle visualisation now includes loose Morning, Afternoon, Evening and Night zones.
- The current zone highlights automatically as the time changes, making the part of the day easier to read at a glance.


Version 1.0.68
- Tell the Time: Explore mode now shows matching 12-hour and 24-hour digital clocks side by side at the same size.


## v1.0.68
- Fixed GameHub offline/PWA registration on GitHub Pages: the service worker now registers from `./sw.js` inside the `/GameHub/` project path instead of incorrectly resolving to the site root.
- Offline cache lookup now ignores cache-busting query strings, so pre-cached files such as `style.css` and game scripts still load when HTML requests `?v=...` versions.
- Kept network-first updating while making a fresh Home Screen install reliably usable offline.

## v1.1.0
- Laser Lab cleanup: replaced the old split designer/play state with one shared level model and removed obsolete generator helpers/solution state.
- Level Designer can now place every fixed board component used by play: laser, checkpoints, targets, mirrors, splitters and blocks.
- Added player inventory settings for mirrors and splitters plus an optional 5-star par target.
- Added **Play this level** so a designed or loaded level can be tested directly with its configured player inventory.
- Play mode now lets the player place and rotate splitters as well as mirrors; both obey inventory limits and can be erased/repositioned.
- Generated Medium/Hard levels no longer pre-place the important splitters. The generator creates branch targets but leaves splitter placement/orientation to the player.
- Generated difficulty now uses longer minimum routes and fewer guiding checkpoints; Hard has no checkpoints, so targets and maze geometry carry more of the reasoning.
- Added 5-star par scoring based on final player-piece count. Generated levels know their construction par; designed levels can define their own.
- Laser Lab writes best-star/best-piece results into a generic `gameHubProgress` localStorage object as groundwork for a future GameHub-wide completion display.
- Existing Laser Lab v1 saved layouts remain loadable; old saved splitters are treated as fixed splitters.
- Updated app cache/version references to v1.1.0.

## v1.1.1

- Logic board geometry now uses the true square grid shape at every responsive breakpoint instead of retaining the older 6:7 sizing calculation.
- Logic forklift position and size are anchored to the actual rendered grid cell, preventing iPhone/iPad padding-and-gap drift and keeping the vehicle centred after resize/orientation changes.
- Logic program entry limit increased from 32 to 64 commands. Hard generated puzzles can legitimately require up to 46 commands, so the old 32-command editor cap could make valid levels impossible to enter.
- Updated cache/version references to v1.1.1.


## v1.1.2

- Laser Lab Designer can export a saved level as a portable `.laser.json` file. On supported iPhone/iPad browsers it opens the system share sheet so the file can be saved to Files or shared directly; other browsers fall back to a normal download.
- Added Laser Lab level import. Imported files are normalised to the current level format, added to Saved Levels, and loaded into the Designer ready to test or edit.
- Import uses duplicate-safe names so an existing saved design is not silently overwritten.
- Updated cache/version references to v1.1.2.


## v1.1.3
- Added a clear **New level** action to Laser Lab Level Designer.
- New level resets only the current working design and leaves all saved levels untouched.
- Added a confirmation before clearing a non-empty current design.
- Changing Designer grid size now uses the same confirmation instead of silently wiping the current board.
- Updated cache/version references to v1.1.3.

## v1.1.4

- Laser Lab Designer mirrors and splitters now represent the intended solution layout when testing a designed level.
- Pressing **Play this level** hides all Designer-placed mirrors and splitters while preserving them in the Designer.
- Player pieces can be placed back onto those same cells during the test.
- Returning to Level Designer shows the original solution optics again.
- Updated Laser Lab help text and cache/version references to v1.1.4.

## v1.2.0

- Added **Laser Lab Freeform** as a separate experimental game; the original grid-based Laser Lab remains intact.
- Freeform optics use one scalable SVG coordinate system rather than grid cells, so interaction and beam geometry scale consistently across iPhone and iPad.
- The laser rotates continuously using a drag handle. Player mirrors and splitters can be added, freely dragged and continuously rotated with live beam tracing while moving.
- Replaced tile blocks/checkpoints with larger irregular obstacle islands and placed targets toward the opposite side of the board.
- Mirrors use continuous reflection geometry rather than fixed 90-degree turns.
- The splitter acts as a simple colour prism: the incoming beam becomes a red straight-through branch and a blue reflected branch. Red/blue targets only activate for matching light and also carry R/B labels.
- Added Easy/Medium/Hard experimental layouts, limited piece inventories, Reset/New controls, and first-pass piece-count par scoring.
- Added the new game to the Home screen and offline PWA cache.

## v1.2.1

- Laser Lab Freeform received its first visual/interaction polish pass while the original grid Laser Lab remains unchanged.
- Reworked the Freeform page back into GameHub's soft neutral visual language, with clearer high-contrast controls and a more compact header.
- The Freeform play area is now a large square board with an off-black inner field. Existing hand-built layouts are centred without stretching, leaving extra free routing space above and below.
- Removed the small on-board rotation handles. Tap the laser, mirror or splitter to select it, then use the large sticky rotation slider below the board; beams update live while rotating.
- Mirrors and splitters remain freely draggable on the board.
- Redesigned laser, mirrors, splitter, targets and toolbar controls as cleaner line-art graphics.
- Obstacle islands now use neutral diagonal hatching inspired by Tell the Time's graphic treatment instead of filled game-like blocks.
- Updated cache/version references to v1.2.1.
