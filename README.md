# GameHub v1.8.31

This release corrects the first room-irradiance + AO experiment in My House.

## Updated in this version
- Reworked **room ambient/irradiance** so it is now a clearly visible, very cheap per-material diffuse fill tinted from each room’s walls, floor and larger furnishings.
- The room fill is multiplied by each receiving surface colour, so it behaves more like diffuse irradiance than a flat grey ambient term.
- Tightened the **SSAO-lite** radius and reduced its maximum opacity to favour contact/corner shading rather than dark silhouette outlines.
- Reduced the AO buffer from 50% to **40% render resolution** for a small performance saving.
- Kept **Direct / Ambient / AO** independently adjustable for Day and Evening.
- Performance badge now labels its timing as **CPU** rather than implying a true GPU/FPS measurement.
- Service-worker cache version bumped for a clean PWA refresh.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
