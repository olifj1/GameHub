# GameHub v1.8.8

Tower Attack art-pipeline Stage 1.

- Adds `tower-vehicles.png`: the first replaceable runtime sprite atlas.
- Scout, Gun Buggy and Tank now use atlas sprites for both teams instead of being constructed directly on the battlefield canvas.
- Attacker icons in Command, deployment buttons and drag previews also use the vehicle atlas.
- Adds `tower-vehicles-guide.png`, a clean reference sheet intended for later art/style passes.
- Adds `tower-assets.js` so sprite positions and gameplay scale live outside the combat code.
- Keeps the previous procedural vehicle drawing only as a safety fallback if the atlas fails to load.
- No Tower Attack gameplay, economy, route or AI balance changes in this release.

This is deliberately the first small step of the asset conversion; defence, scenery and terrain remain procedural for now.
