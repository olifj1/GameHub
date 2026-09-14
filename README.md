# GameHub v1.8.76

SideScroll editor MVP.

- Uses v1.8.75 as the base; other GameHub games and Walk Lab are unchanged.
- Extends the warm dirt texture across the whole ground plane so gaps in foliage no longer reveal a flat dark floor.
- Adds a **Play / Edit** toggle directly in SideScroll.
- Edit mode can select scenery, drag it across the ground plane, pan on empty space, add any existing tree/ground asset, duplicate, delete, scale, and toggle simple solid collision.
- Scene edits auto-save locally on the device and are immediately testable by switching back to Play. The asset library includes a Reset control to clear local scene edits.
- Collision volumes are visible in Edit mode; foreground dressing is ghosted there so hidden gameplay objects are easier to find.
- The existing fallen-log obstacle is now part of the editable collision system rather than a one-off hard-coded collision test.
