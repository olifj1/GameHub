# GameHub v1.8.33

This release replaces the My House SSAO experiment with a dynamic room-local SH irradiance probe grid.

## Updated in this version
- Removed the screen-space AO pass and its tuning controls.
- Every room now uses a **3 × 3 × 2 grid (18 probes)** so there are midpoint samples as well as corners.
- Each probe fires scene rays and records the colour/energy of directly illuminated surfaces into **first-order spherical-harmonic irradiance**.
- Probe lighting is spatially interpolated across the room and evaluated against surface normals in the standard-material shader.
- The default is **16 rays per probe**, adjustable from 8 to 32 in SETUP.
- **INDIRECT** controls the SH bounce strength independently from Direct and Ambient.
- Probe volumes are rebuilt when lighting/furniture/room finishes change, then reused while the camera moves. Other dirty rooms can warm in idle time.
- Added a **Refresh room** button and probe-build timing readout for testing on device.
- Existing furnishing saves remain compatible.
- Service-worker cache bumped for the new release.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
