# GameHub v1.8.26

This release improves **My House lighting** with directional ceiling lights and scene-level lighting controls.

## Updated in this version
- Ceiling-mounted fittings now use broad **downward SpotLights** instead of PointLights, preventing the kitchen pendant from throwing light into the room above.
- Table and floor lamps remain PointLights so they still spread light naturally around their room.
- Spotlight shadows use a single shadow view rather than the six views required by a PointLight, reducing the shadow cost of ceiling fittings.
- Added a compact **Scene Lighting** panel beside the Day/Evening control.
- Added independent **Direct** and **Ambient** sliders for both Day and Evening presets.
- Evening now defaults to **0% direct light**, so artificial room lighting defines the evening scene instead of the sun/directional light remaining active.
- Evening ambient defaults to a low **28%** so the house remains readable before individual lamps are switched up.
- Day and Evening lighting adjustments are saved separately and persist with the house.
- Added a **Reset preset** control to restore the current Day or Evening lighting values.
- Bumped the service-worker cache to v1.8.26 so the revised files replace older cached versions cleanly.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
