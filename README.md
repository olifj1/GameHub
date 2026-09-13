# GameHub v1.8.50

SideScroll top-down path-layout correction.

- Rebuilt the SideScroll scatter from the **top-down forest idea** rather than treating the front / character / back layers as almost the same depth.
- The character now walks along the **centre of a deliberately wide clear path**.
- The dense far-side woodland starts several real world units behind the character.
- The near-side woodland now starts several real world units **in front of** the character and extends much closer to the camera, giving stronger perspective and foreground parallax.
- Near-side dressing is mostly small grass, bushes and rocks, with occasional larger pieces / trees, but the individual props are no longer reduced to tiny specks.
- Increased asset density on both sides of the path so the ground plane should be much less exposed.
- The camera is now **actually tilted upward** (target Y above camera Y) instead of still looking slightly down, so the character and path should sit lower in frame.
- Kept the improved small walk-cycle character and the illustrated woodland art.
