# GameHub v1.8.70

Walk Lab / SideScroll gait refinement.

- Added real lower-arm articulation by varying wrist reach through the arm swing, so elbows hinge instead of the lower arms moving rigidly with the upper arms.
- Added heel-to-toe stance roll and controlled swing-foot rotation.
- During late stance the toe stays grounded while the heel rises; after toe-off the foot returns through a natural swing angle ready for heel contact.
- Kept planted feet authoritative so foot roll does not reintroduce the floating-foot problem.
- Walk Lab renders smoothly every display refresh; there is no animation FPS control. The 16 poses remain editing/control poses only.
- SideScroll uses the same updated live rig and gait directly, with no baked sprite animation.
- Bumped the shared animation storage key so older saved poses cannot hide this revised default cycle.
