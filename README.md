# GameHub v1.8.64

Walk Lab cutout-rig calibration pass.

- Replaced the remapped/generated cutout atlas with a **programmatic calibration skin** drawn directly into the authoritative part masks.
- Every limb/body/cloak piece now fills its own mask and reaches the exact source pivots used by the rig, removing the large invisible offsets that made v1.8.63 look exploded.
- Kept separate **hip → knee → ankle → foot** chains and the direct live-rig renderer in SideScroll.
- Tightened the cloak guide positions now that the art geometry is trustworthy.
- Reworked the fixed draw order for rear cloak/hair, far limbs, torso, near limbs, dress, near arm, head and front pieces.
- Walk Lab still supports pan, pinch zoom, Fit view, stick overlay and plane debugging.
- Added `walklab-rig-v3-template.png` and `walklab-rig-v3-mask.png` as the new authoritative art templates for a later image-generated paint pass.

The v3 art is deliberately simple: this release is for validating attachment, pivots and layering before replacing the calibration colours with final character artwork.
