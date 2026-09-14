# GameHub v1.8.74

SideScroll path-edge + locomotion refinement.

- Softened both raised path edges with dense short grass and occasional rocks/root clumps.
- Added subtle real height undulation along the path mesh; the character follows the same path height.
- Rebuilt the run poses with longer reach and genuine airborne flight phases.
- Increased run speed and stride distance, and changed walk→run blending so animation phase stays continuous instead of briefly accelerating through walk frames.
- Raised the jump arc and changed the jump pose sequence to trail the legs after takeoff, tuck later near the apex, then extend for landing.
- Added a shin-high fallen-log obstacle on the path with simple collision so the jump now has a concrete clearance target.
- Bumped the shared locomotion storage key so older experimental run/jump clips do not override these new defaults; an existing saved walk is still carried forward.
