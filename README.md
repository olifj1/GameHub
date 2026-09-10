# GameHub v1.8.38

My House lighting-containment pass.

- SH probes still use the 3 × 3 × 2 / 18-probe room grid, but primary probe rays now sample only stable architectural geometry (walls, floors, slabs and stairs), never movable furniture.
- Furniture still participates in visibility/shadow checks, so moving it can change the direct shadow falling onto a sampled room surface without turning a nearby probe black.
- Local lamps now use invisible per-room shadow-containment shells. This prevents point/spot light energy bleeding into neighbouring rooms; the normal Shadows switch controls object shadows while containment remains active.
- Added the missing full 200 mm inter-floor slabs through the left and right room wings, sealing the exterior gap between storeys while preserving the central stair opening.
- Existing house layout, saved furnishings and lighting settings are preserved.
