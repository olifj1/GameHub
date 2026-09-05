# GameHub v1.8.10

Tower Attack art-pipeline conversion pass.

## This release
- keeps the v1.8.9 AI vehicle sprites and gameplay unchanged
- fixes vehicle thumbnails so atlas art preserves its aspect ratio in Command, roster and deploy buttons
- converts Light Turret, Cannon and Rapid Gun to a replaceable two-team defence atlas
- converts trees, rocks, ruins, relays and huts to a replaceable scenery atlas
- converts the base terrain, four dirt routes and base structures to a replaceable background texture
- keeps the original procedural drawing code as a fallback if any image asset fails to load
- includes clean guide/reference PNGs for the defence, scenery and terrain groups so each can later receive a controlled generative-AI style pass

## Runtime art assets
- `tower-vehicles.png`
- `tower-defences.png`
- `tower-scenery.png`
- `tower-terrain.png`

## Reference / AI guide assets
- `tower-vehicles-guide.png`
- `tower-defences-guide.png`
- `tower-scenery-guide.png`
- `tower-terrain-guide.png`

No gameplay, economy or AI balance changes are intended in this release.
