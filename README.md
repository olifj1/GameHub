# GameHub v1.8.78

SideScroll editor/gameplay asset pass.

- Fixed SideScroll scenery loading so tree/ground textures use stable file paths with fallbacks; the scene-storage schema is refreshed so the full default dressing returns cleanly.
- Editor asset library now separates **Gameplay** from **Dressing** assets.
- Added a code-generated wooden crate gameplay asset with solid collision.
- Crates can be placed, moved, duplicated, scaled and deleted in Edit mode.
- Crates are platforms: the character can jump onto them, land on top, stand there, jump again, and fall naturally when walking off an edge.
- Existing SideScroll movement slider, depth cycling, opaque edit view and bright selection highlight are retained.
