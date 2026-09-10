# GameHub v1.8.37

This release stabilises the My House SH probe renderer while navigating between rooms.

## Updated in this version
- Camera panning and crossing room boundaries no longer trigger any SH probe work.
- Removed the staggered background room-by-room probe warm-up that could expose partially updated lighting states.
- Multi-room SH refreshes are now atomic: all dirty room grids are calculated first, then the completed lighting state is shown in one render.
- Furniture keeps the existing SH solution while moving; only the affected room is rebuilt when the move finishes.
- Lamp changes refresh only that lamp's room when the control is released.
- Global direct-light, sun-colour and probe-quality changes refresh all affected rooms as one stable update.
- Manual **Refresh room** and **Refresh all** controls remain available in SETUP.
- Existing house data and lighting settings are preserved.

## Files
Upload the contents of this ZIP to the root of the `GameHub` repository, replacing the existing files.
