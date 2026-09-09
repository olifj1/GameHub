# GameHub v1.8.28

This release adds an experimental indirect bounce-lighting pass to My House, plus a new scene-lighting control for it.

## Updated in this version
- Added a new **INDIRECT** slider to the My House scene-lighting panel for each **Day** and **Evening** preset.
- Indirect light is now estimated per room from the active direct lighting and the room’s colours/furniture, so you can try a darker scene with direct light doing the main work and indirect bounce softly filling the room.
- The render badge now shows the current **GI** percentage to help when comparing lighting setups.
- The in-game instructions now mention the new lighting workflow.
- The service-worker cache version is bumped for a clean PWA update.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
