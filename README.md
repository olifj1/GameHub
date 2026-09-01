# GameHub v1.6.4

App-style viewport/scrolling correction.

- Individual games are now locked to the visible app viewport and cannot be page-scrolled or rubber-banded around the screen.
- The Home screen remains vertically scrollable for game cards; the Progress page remains a normal record page when its content needs scrolling.
- Game viewport locking no longer depends on CSS `:has()`, so it remains compatible with older Android browsers.
- Removed the large game-page bottom scroll buffer introduced during the Android compatibility pass; games now use the real dynamic viewport and safe-area inset instead.
- Interactive controls, sliders and game boards remain touch-enabled inside the locked viewport.
- Flight keeps the centred desktop layout from v1.6.3 while following the same locked-screen rules as the other games.

This ZIP is a complete release snapshot; the README intentionally contains only notes for v1.6.4.
