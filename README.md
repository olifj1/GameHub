# GameHub v1.8.44

SideScroll visible sprite-sheet fix.

- Fixed the missing SideScroll character by switching from the hidden runtime-generated atlas to a real external PNG asset.
- Added **sidescroll-character-sheet.png** as an 8-frame walk-cycle animation page in the repository root.
- The character plane now uses that texture page directly, one eighth of the sheet at a time.
- Moved the character closer to the visual centre and increased its size slightly so the walk test is obvious.
- Slowed walking/camera movement substantially, including drag movement.
- Kept the repeating world-space forest scatter so density stays consistent as you travel left/right.
- Kept the walk cycle tied to travelled world distance rather than an unrelated fixed timer.
