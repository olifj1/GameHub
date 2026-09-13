# GameHub v1.8.55

Walk Lab stick-rig + planted-foot pass.

- Took **Walk Lab** back to a clean stick figure rather than the mannequin body shapes.
- Kept visible feet and fixed upper/lower arm and leg lengths.
- Both arms now attach to one **central shoulder point**.
- Simplified editing to the useful controls only: pelvis, chest, hands and feet. Knees and elbows solve automatically.
- Changed leg IK so knees consistently bend forwards instead of folding backwards.
- Rebuilt the default 8 key poses around a proper stance-foot model: the planted foot moves backwards at exactly the same rate as root travel, so it stays pinned to one point on the moving ground.
- Kept 8 key poses + 8 generated in-betweens, onion skin, scrub, save/load JSON and transparent PNG export.
- Added **Reset cycle** so experiments can always return to the clean default walk.
