# GameHub v1.8.81

SideScroll grounding, carry-follow and crate-stacking pass.

- Character rendering now uses the centre of the raised path as the single gameplay floor reference, with a calibrated sole offset so the painted boots sit on the surface instead of sinking through it.
- Wooden crate artwork now reaches the billboard baseline, and its collision/platform height is matched to the visible crate so boxes no longer appear to float.
- Carried crates are attached to the animated hand position, so they rise and fall naturally with the character's walking body motion.
- Crates can now be stacked by putting one down on top of another; platform collision uses each crate's actual world height, so the character can stand/jump on stacked levels.
- ACTION prefers the upper crate when several are stacked at the same position.
- Stack height is saved with scene edits so authored stacks survive reloads.
