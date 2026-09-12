# GameHub v1.8.41

SideScroll realism pass.

- Reworked **SideScroll** to follow the simpler real-world model you described.
- The forest is now scattered across real world-space X/Z positions, as if viewed from above and then seen through a side camera.
- Added a proper receding **ground plane** so the floor itself darkens near the camera and fades towards the fog in the distance.
- Removed the fake mist-card approach and the over-bright staged fog treatment.
- The empty space now reads as the fog colour, while trees, rocks and grass are dark silhouettes that lighten only through true depth fog.
- Kept the lower camera viewpoint and depth diagnostic view so the real 3D spacing is still easy to judge.
