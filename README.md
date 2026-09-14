# GameHub v1.8.63

SideScroll / Walk Lab cutout-rig v2.

- Rebuilt **Walk Lab** around a reusable 2D cutout rig rather than sprite-sheet baking.
- Added proper **hip → knee → ankle → foot** leg chains. Heel contact is now separate from the ankle and the textured boot follows the ankle-to-toe bone.
- Split character art into explicit planes: upper torso, lower dress, upper/lower arms, upper/lower legs, feet, hood/head, front/back hair, two hair tails, cloak layers and pouch.
- Added deterministic **layer ordering** for far limbs, body, near limbs, dress, head/hair and cloak pieces.
- Added a two-bone hair guide and simple two-stage cloak motion.
- Removed the old export crop / sprite-comparison workflow from Walk Lab.
- Added **drag-to-pan**, **pinch zoom**, **Fit view**, stick toggle and plane-debug toggle.
- Walk Lab animation edits are stored locally and **SideScroll reads the same live rig animation** on load.
- SideScroll now renders the character as individual WebGL cutout planes driven by the shared Walk Lab rig; it no longer plays a baked 16-frame character atlas.
- Added `walklab-rig-v2-template.png` and `walklab-rig-v2-mask.png` as the authoritative programmatic art template for future character-art passes.
- Added `walklab-rig-v2.png` as the current first-pass art atlas mapped to those exact plane shapes.
