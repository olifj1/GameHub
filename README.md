# GameHub v1.8.62

Walk Lab cutout-rig experiment.

- Added a transparent **character-parts atlas** derived from the generated rigging sheet.
- Added a new **Rig art** mode in Walk Lab. The same cutout artwork is attached to the authored stick bones using deterministic 2D transforms, rather than redrawing a whole character independently for each animation frame.
- Near/far arms and legs, boots, torso/dress, cloak, hood/head and back hair are layered over the existing skeleton.
- The stick rig remains visible on top so registration problems are easy to diagnose.
- The older full-sprite-sheet comparison remains available with **Sprite / Load sprite**, but is off by default.
- **Export PNG** now exports the assembled cutout character when Rig art is enabled, creating the same fixed 16-frame 1024×1536 atlas format for SideScroll.
- Included `walklab-rig-parts-source.png` (the generated concept sheet) and `walklab-rig-parts.png` (the transparent cutout atlas actually used by Walk Lab).

This is intentionally a first rig-mapping pass: the important test is whether deterministic cutout pieces solve the frame-to-frame consistency problem before refining pivots, cloak segmentation and proportions.
