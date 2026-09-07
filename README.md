# GameHub v1.8.17

My House WebGL foundation pass.

- Moves My House from the custom canvas painter to a real Three.js/WebGL scene with depth buffering and smooth mesh shading.
- Rebuilds the 2-up / 2-down house at metre-like real-world scale, including 2.04 m door openings, a continuous shell, floor slab and proportioned staircase.
- Adds real directional sunlight with soft dynamic shadows plus true local point lighting from placed lamps in evening mode.
- Adds ray-cast object picking with larger invisible touch targets for small dressing items.
- Adds one-finger empty-space panning and two-finger pinch zoom while keeping the dollhouse orientation fixed.
- Makes tabletop objects children of their support furniture, so moving or rotating a table carries its objects with it.
- Keeps the existing furniture recipes mostly unchanged to make the renderer comparison useful.
