# GameHub v1.8.89

SideScroll audio rollback.

- Restores SideScroll gameplay/rendering code to the last pre-audio version (v1.8.81).
- Removes the entire SideScroll audio implementation: no audio context, sound button, ambience, footsteps, jump/landing or crate sounds.
- Keeps the later footprint cleanup by removing 18 obsolete individual SideScroll tree/ground PNGs that are no longer used by the atlas-based renderer.
- Bumps the service-worker cache so the rollback replaces recent audio builds cleanly.
