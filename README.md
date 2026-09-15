# GameHub v1.8.84

SideScroll audio reliability fix.

- Fixed footsteps still selecting from 10 slots after the sample set was reduced to 4.
- Prefetches local audio before the first interaction, then unlocks/decodes it from the first real gesture for more reliable iPhone/PWA playback.
- Added an iOS/WebKit audio-context priming step and retries ambience after later interactions.
- Slightly raised the quiet woodland ambience level for phone speakers.
- Keeps the same four footstep files and compact v1.8.83 asset footprint.
