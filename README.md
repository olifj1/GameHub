# GameHub v1.8.35

This release retries the My House SH-probe experiment with a much safer mobile WebGL path.

## Updated in this version
- Keeps the **3 × 3 × 2 = 18 probe** grid in every room.
- Each probe ray-samples actual room geometry and direct lighting to build first-order SH irradiance.
- The 18-probe grid is now **interpolated on the CPU per rendered object/mesh** after a probe refresh.
- Each MeshStandardMaterial receives only **four vec3 SH coefficients plus one strength value** instead of the previous 18-probe uniform arrays.
- Removed the SSAO render pass entirely.
- SETUP now exposes **Direct**, **Ambient**, **Indirect**, **Rays / Probe**, **SH ON/OFF**, and **Refresh room**.
- The SH experiment now starts **OFF** for a safe direct + ambient baseline; switch **SH ON** in SETUP to compile/test it, and switch it OFF again to restore the standard materials.
- Probe updates happen after lighting/furniture changes and other rooms warm progressively while idle.
- Existing house/furniture save data is preserved.
- Service-worker cache version bumped for a clean PWA update.

## Experimental note
This is deliberately a renderer test. The previous v1.8.33 SH build failed on iOS because the per-material shader carried the complete probe grid. This version keeps that grid on the CPU and sends only the locally interpolated coefficients to the shader.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
