# GameHub v1.8.56

Walk Lab gait refinement pass.

- Kept the simpler **stick rig** with fixed limb lengths and visible feet.
- Reworked the default **arm swing** so the hands follow a stronger contralateral arc and use most of the available arm length.
- Shifted both legs slightly left so they sit more naturally under the character's centre of mass.
- Added a consistent slight **forward body lean** through the walk.
- Retuned the eight key leg poses while preserving the planted-foot rule: during stance, foot position + root travel remains constant.
- Added a fixed-length **hair guide bone** behind the head with automatic bounce / lag through the cycle.
- `Export PNG` produces a transparent **4×4 page containing all 16 frames**.
- Save JSON now writes Walk Lab format v4; older v3 files still load with a default hair-bone motion.
