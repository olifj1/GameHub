# GameHub v1.8.80

SideScroll gameplay-layer, world-ground and carry-interaction pass.

- Gameplay assets now default to the character depth layer, with a GAME LAYER toggle in Edit mode.
- The dirt floor is now a real world-anchored ground plane spanning the scene depth, so its UVs no longer slide with the camera.
- Added a second Play control row with an ACTION button.
- Wooden crates can be picked up, carried with an arms-forward carry pose, put down again, jumped onto, and used as solid platforms.
- Pick-up and put-down use short live rig transitions rather than baked sprites.
