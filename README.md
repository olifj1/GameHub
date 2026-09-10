# GameHub v1.8.32

This release reorganises My House controls and exposes the SSAO-lite tuning parameters for on-device testing.

## Updated in this version
- Added **PLACE / SETUP** tabs below the 3D house.
- PLACE contains furniture selection, inventory, wall colours, wallpaper and floor controls.
- SETUP contains all lighting controls; the viewport itself is now cleaner.
- Day/Evening, Direct, Ambient and AO strength are now in SETUP.
- Selected lamp controls — brightness, ceiling-light cone angle and shadows — also live in SETUP.
- Exposed AO tuning controls for **Radius**, **Depth range**, **Contrast**, **Maximum darkness** and **Quality/render scale**, with exact values shown beside each slider.
- AO tuning values save with the My House state so useful settings can be reported back exactly.
- Reset Lighting resets the active Day/Evening preset and the AO tuning parameters to the v1.8.31 baseline.
- The performance badge now includes AO radius and quality values for easier comparison.
- Service-worker cache bumped for a clean PWA update.

## AO baseline values
- Strength: Day 32%, Evening 42%
- Radius: 2.15
- Depth: 0.58
- Contrast: 0.92
- Max dark: 30%
- Quality: 40%

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
