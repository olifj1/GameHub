# GameHub v1.0.1

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

Unzip `GameHub-v1.0.1.zip`, open the `GameHub-v1.0.1` folder, Select All, and
upload the files to the root of the GameHub GitHub repository.
