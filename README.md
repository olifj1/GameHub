# GameHub v1.8.83

SideScroll footprint cleanup.

- Reduced footstep variation from 10 samples to 4; pitch/volume variation still prevents obvious repetition.
- Re-encoded the woodland ambience at 112 kbps stereo to reduce its file size while retaining the stereo atmosphere.
- Removed 18 obsolete individual tree/ground PNGs that were superseded by the SideScroll dressing atlas in v1.8.79 and were no longer referenced by the game.
- Pruned the service-worker cache list accordingly.
- No gameplay, editor, animation or collision behaviour changed.
