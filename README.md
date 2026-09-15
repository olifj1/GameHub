# GameHub v1.8.88

SideScroll footstep stability + cadence rebuild.

- Removes all runtime footstep playback-rate changes, seeks, restarts and pauses while moving.
- Uses three tiny fixed-rate cadence loops (slow / walk / run), all unlocked once and kept running silently.
- Movement only changes which loop is audible, so stopping/starting should no longer stall rendering.
- Each cadence loop contains four soft grass/dirt-style contacts per animation cycle, matching the four visual foot contacts.
- Replaces the hard, door-like Kenney RPG step with a softer custom footfall texture.
- Woodland ambience remains independent and starts from the first user interaction.
