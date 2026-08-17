# GameHub v1.0.16

Phone-first modular web-game hub.

## Structure

All files intentionally live in the repository root so the complete project can be
selected and uploaded from the iPhone Files picker in one operation.

- `index.html` — game hub/home page
- `site-config.js` — editable site name and game display metadata
- `home.js` — builds the game cards
- `core.js` — shared game-page helpers
- `style.css` — shared styling
- `game-01.html` + `game-01.js` through `game-08.html` + `game-08.js` — independent games
- `manifest.json` / `sw.js` — whole-collection PWA
- `icon-192.png` / `icon-512.png` — PWA icons

The `game-XX` IDs are stable development identities. Public game names can be
changed in `site-config.js` without renaming files or refactoring game code.

## Upload from iPhone

Unzip `GameHub-v1.0.15.zip`, then upload/select all files from the extracted folder and
upload the files to the root of the GameHub GitHub repository.

## v1.0.9 fixes

- Restored the shared random-number helper used by Reading and Coding.
- Reading controls and speech setup can now complete normally; speech start is also safer on iOS.
- Coding generates/renders its puzzle again and uses a compact one-screen phone layout.
- Gravity now starts with the ship upright.

## v1.0.9 visual system

- Introduced a shared warm beige/stone palette across GameHub and all games.
- Added stable muted accent colours per internal game ID.
- Flattened shadows and introduced cleaner graphic outlines and stronger typography.
- Replaced emoji-like hub icons with simpler graphic glyphs.
- Restyled shared buttons, cards, selectors and panels to use the new system.
- Redrew Gravity as a light graphic environment with outlined geometry, a line-art rocket and violet accent.

## v1.0.9 Tell the Time refinement

- Removed the old full-screen changing sky colour and its exposed yellow background.
- Redesigned the analogue clock as cleaner ink-line artwork with no drop shadow.
- Added a full 24-hour sun orbit showing sunrise, midday, sunset and the sun below the horizon at night.
- Moved/compacted the hour and minute controls into the bottom of the one-screen layout.

## v1.0.9

- Hour slider now spans 00 → 12 → 00 using a 0–24 control.
- Tell the Time clock is larger, lighter and more diagram-like; numerals moved inward and digital time weight reduced.
- Added a shared information button and instructions popup to all eight game pages.
- Removed the visible instructional subheading from every game header.

## v1.0.9

- Corrected the Tell the Time responsive CSS ordering so the analogue clock actually renders larger on normal iPhone-height screens.
- Increased the digital time slightly as well, while keeping it visually secondary to the analogue clock.
- Added a little more separation before the day-cycle panel.

## v1.0.9

- Fixed the responsive breakpoint that was almost cancelling the analogue-clock size increase on normal iPhone screens.
- The clock now uses roughly 72% of the viewport width on the common phone-height layout, with a 285px cap.
- Corrected SVG numeral baseline placement for iOS Safari so clock-face numbers sit optically centred.


## v1.0.10

- Increased the Tell the Time analogue clock size again, especially on normal iPhone-height screens.
- Moved the day-cycle visualisation and slider controls slightly lower to improve spacing.
- Reduced the digital clock font weight so it competes less with the analogue face.
- Shifted the SVG clock numerals down slightly for better optical centring on iOS Safari.



## v1.0.13

- Times Tables: vertically rebalanced the selector, result card, tap history and Reset control so the main learning content sits closer to the middle of the space between the title and bottom TAP button.
- Times Tables: removed the previous maximum table limit of 12; the + control can now continue upward without an arbitrary cap (minimum remains 1).

## v1.0.12

- Times Tables: increased the gap below the page title so the controls sit lower on the screen.
- Enlarged and strengthened the multiplication result line for clearer emphasis.
- Rebalanced spacing around the tap history and Reset control.
- Made the Times Tables page fill the phone viewport so the TAP button is pushed down into easier thumb reach.

- Times Tables: moved the main TAP control to the bottom of the page for easier thumb reach.
- Enlarged and rebalanced the results card, total, equations and tap feedback.
- Added more breathing room between the page title and the main controls.


## v1.0.14

- Rebalanced the Sums page with more breathing room below the title.
- Removed the visible explanatory/help text from the main Sums layout.
- Removed the green background block below the page content.
- Fixed Sums interactions (Practice/Test, difficulty, New Sum, keypad) by removing a duplicate global `randomInt` declaration that prevented `game-03.js` from loading.
- Enlarged and centred the New Sum / Pass action button.


## v1.0.15
- Replaced the Home Screen / PWA icon artwork with the new minimalist GameHub logo.
- Updated the service-worker cache version so the new icon assets are included in the release.


## v1.0.16
- Browser/PWA theme and background colours now match the main GameHub neutral background.
- Added a portrait-only presentation guard: landscape shows a clean “Rotate your device” screen instead of a broken game layout.


## v1.0.17
- Sums: increased vertical spacing between the main sections for a more balanced layout.
- Sums: keypad presses now register on the initial pointer press, fixing missed digits during fast entry such as 10.
- Sums: enlarged the New Sum button and changed it to the page accent colour for stronger emphasis.

