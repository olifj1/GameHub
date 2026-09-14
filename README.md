# GameHub v1.8.65

Walk Lab cutout orientation audit.

- Fixed the core Walk Lab canvas transform that was reversing the atlas Y axis and making the character planes point roughly opposite to their bones.
- Audited the authoritative v3 atlas anchors: head, torso, dress, cloak, hair, arms, legs and feet now all use the same **A → B** convention.
- Fixed the plane-debug transform to use that same convention.
- **Planes** debug now draws an A → B arrow on every cutout so orientation errors are visible immediately.
- Restored the correct elbow IK branch for the shared world-space rig. The previous screen-space-to-world-space conversion had swapped the branch, making elbows bend backwards.
- Knee, ankle and separate foot setup remain unchanged.
- SideScroll continues to use the same live Walk Lab rig; the elbow fix therefore carries directly into the game.

Note: SideScroll/WebGL uses a Y-up local mesh, so its atlas source-axis conversion intentionally remains Y-inverted. That is the correct convention for the WebGL renderer and is separate from the Walk Lab canvas bug fixed here.
