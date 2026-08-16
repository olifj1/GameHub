# GameHub v1.0.4

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

Unzip `GameHub-v1.0.4.zip`, open the `GameHub-v1.0.4` folder, Select All, and
upload the files to the root of the GameHub GitHub repository.

## v1.0.4 fixes

- Restored the shared random-number helper used by Reading and Coding.
- Reading controls and speech setup can now complete normally; speech start is also safer on iOS.
- Coding generates/renders its puzzle again and uses a compact one-screen phone layout.
- Gravity now starts with the ship upright.

## v1.0.4 visual system

- Introduced a shared warm beige/stone palette across GameHub and all games.
- Added stable muted accent colours per internal game ID.
- Flattened shadows and introduced cleaner graphic outlines and stronger typography.
- Replaced emoji-like hub icons with simpler graphic glyphs.
- Restyled shared buttons, cards, selectors and panels to use the new system.
- Redrew Gravity as a light graphic environment with outlined geometry, a line-art rocket and violet accent.
