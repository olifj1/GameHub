# GameHub v1.8.29

This release replaces the first My House GI experiment with a ray-hit virtual-light bounce system.

## Updated in this version
- Removed the fixed three-bounce-light-per-room setup from v1.8.28.
- Ceiling spotlights now cast a small configurable set of CPU ray samples through their cone.
- The directional key light also contributes a lightweight per-room bounce sample when it is enabled, so direct-only daytime lighting can produce some indirect response.
- Point lamps use an importance-biased set of directions, starting downward and spreading outward as more samples are enabled.
- A successful ray hit creates a broad, non-shadow-casting virtual spotlight at the hit surface, aimed along that surface normal and tinted by the source light and material colour.
- Bounce strength accounts for source intensity, source-to-hit distance and incidence angle.
- Added **RAYS / LIGHT** control from 0 to 4. The default is 1 for a mobile-friendly starting point.
- Virtual bounce lights are globally capped at 12 and ranked by estimated contribution to stop high lamp counts from exploding the GPU cost.
- Bounce lights are recalculated after furniture/light movement rather than continuously during a drag.
- Performance badge now reports the active VPL count.
- Existing My House saves remain compatible.
- Service-worker cache bumped for a clean PWA update.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
