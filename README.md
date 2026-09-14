# GameHub v1.8.68

Walk Lab rig-art loading fix.

- Fixes the regression where **Rig art** could be enabled but no character planes appeared.
- The current v4 character atlas is now embedded directly in the shared `walk-rig.js`, so Walk Lab and SideScroll no longer depend on a separate PNG request in order to display the character.
- The external `walklab-rig-v4.png` is still included as a working/source asset, but it is no longer a required service-worker cache dependency.
- Walk Lab now reports an explicit rig-art load failure instead of silently showing only the stick skeleton.
- SideScroll uses the same embedded atlas, keeping the two views on exactly the same character art.

No pose/proportion changes in this release; this is deliberately a loading/packaging fix so v1.8.67 can be judged properly.
