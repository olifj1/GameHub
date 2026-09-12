# GameHub v1.8.43

SideScroll density consistency + sprite-sheet pass.

- Refined **SideScroll** so the forest density stays visually consistent as you move left and right, rather than tapering away at the ends.
- Switched the scene scatter to a repeating world-space tile, so the treeline and path-side dressing keep a more even feel across the full traversal range.
- Slowed the SideScroll movement speed so the scene and character are easier to read.
- Added a visible **character plane** using a proper 8-frame flip-book style sprite atlas.
- Hooked the sprite animation timing to travel distance, so the walk cycle now advances with movement rather than ticking at a fixed unrelated rate.
- Kept the denser treeline behind the path, the sparser near side, the low grass occlusion, and the real depth-fog setup.
