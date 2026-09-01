# GameHub v1.6.2

Cross-device compatibility pass.

- Desktop/laptop landscape views no longer show the rotate-device guard.
- Normal pages now use document scrolling instead of the legacy fixed-body/nested-scroll setup, improving compatibility with older Android browsers.
- Interactive game boards and canvases still capture their own drag/swipe gestures.
- Viewport sizing now uses `vh` with `svh`/`dvh` enhancement and safer bottom-area spacing.
- Installed Android PWAs now request `fullscreen` display first, with `standalone` fallback.
- Added mobile web-app capability metadata while retaining safe-area support.

This ZIP is a complete release snapshot; the README intentionally contains only notes for v1.6.2.
