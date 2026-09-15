# GameHub v1.8.87

SideScroll footstep performance fix.

- Replaced per-footstep HTML audio restarts with one continuously running footstep loop.
- The loop contains the same single footstep sample twice with silence between steps.
- Walking now changes only footstep volume and playback rate; it never calls play(), pause() or seeks for individual steps.
- Footstep cadence follows actual movement speed and re-syncs with the walk cycle when movement starts.
- Keeps woodland ambience as a separate continuous loop.
- Replaced the old single-step MP3 with a small pre-built WAV loop, keeping the release at the same file count.
