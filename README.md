# GameHub v1.8.30

This release replaces the expensive virtual-bounce-light experiment in My House with a cheaper room-coloured irradiance fill and a lightweight screen-space AO pass.

## Updated in this version
- Removed the ray-hit VPL / virtual bounce lights from v1.8.29.
- **Ambient** is now primarily a room-specific irradiance tint derived from that room’s walls, floor and furniture colours, with only a very small global sky fill remaining.
- Added an adjustable **AO** control to the Scene Lighting panel.
- AO uses a half-resolution depth pass with eight nearby screen-space samples to add contact/corner darkening.
- AO is skipped while actively dragging/panning, then restored on release.
- Furniture shadow maps are also frozen while dragging and refreshed once on release.
- The performance badge now reports CPU submission time rather than presenting it as a reliable FPS estimate.
- Existing My House furnishing saves are preserved.
- Service-worker cache bumped for a clean PWA update.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
