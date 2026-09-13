# GameHub v1.8.48

SideScroll character rollback fix + foreground fill pass.

- Restored the **newer smaller walk-cycle character** instead of the older oversized placeholder that came back in the last pass.
- Switched SideScroll to use the better walk atlas again and included it as both `sidescroll-character-walk.png` and the legacy `sidescroll-character-sheet.png` for compatibility.
- Kept the lower, more grounded camera, but tilted it up a little so the empty dark band at the bottom of the play area is reduced.
- Increased the amount of **small foreground foliage / rock dressing** so the nearest part of the scene stays more continuously populated.
- Reduced the size of the closest foreground props so they help with grounding and parallax without overwhelming the character.
- Kept the denser mid / far woodland from the illustrated asset pass.
