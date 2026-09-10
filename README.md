# GameHub v1.8.36

This release refines My House placement and lighting controls around the working CPU-interpolated SH probe renderer.

## Updated in this version
- **Focused placement mode:** tap an item to select it; while selected, house panning is paused and a one-finger drag anywhere in the viewport moves that selected item. Tap elsewhere without dragging to deselect and return to panning.
- **Live shadows while moving:** direct/local shadow maps now follow furniture and lights during manipulation. The SH probe grid remains frozen during the drag and refreshes only when the item is released.
- Added explicit **ON/OFF switches** for Direct, Ambient and Indirect lighting while preserving each slider value.
- Added a per-selected-light **LIGHT ON/OFF** switch so lamps no longer have to be turned off by dragging brightness to zero.
- Raised **Indirect** adjustment from 150% to **300%** for stronger SH-only lighting tests with Ambient reduced or disabled.
- Added a saved **Sun Colour** control for each Day/Evening preset.
- Added both **Refresh room** and **Refresh all** probe actions.
- Fixed an SH stability issue where directional coefficients could remain in stale camera/view space after panning. Probe coefficients now stay in world space and are transformed to view space at draw time.
- **Reset lighting** now resets the current lighting preset without unexpectedly disabling the SH system.
- Existing house, furniture, lighting and SH settings are preserved.
- Service-worker cache bumped for a clean PWA update.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
