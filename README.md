# GameHub v1.8.71

SideScroll live-rig integration fix.

- Fixed the WebGL atlas V-coordinate mapping for the live Walk Lab cutout rig. SideScroll was sampling vertically mirrored/opposite atlas rows, making otherwise-correct rig pieces appear mixed up and detached.
- SideScroll continues to render the live articulated rig directly; no baked walk sprite sheet is used.
- Reduced the SideScroll character globally by 30% (3.30 → 2.31) while leaving Walk Lab proportions unchanged.
- Kept the v1.8.70 lower-arm articulation, grounded gait and heel-to-toe foot roll unchanged.
