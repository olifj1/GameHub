# GameHub v1.8.58

Walk Lab export-frame pass.

- Added a visible **2:3 export frame** directly in the Walk Lab editor.
- Drag the top handle to move the crop; drag any corner to scale it while the aspect ratio stays locked.
- Export size is deliberately fixed at **256×384 per frame**.
- `Export PNG` now writes all 16 frames to a transparent **1024×1536 4×4 atlas**, using the exact same crop for every frame.
- The export frame position and scale are stored in Walk Lab JSON saves and restored on load.
- No extra export controls were added; the editor frame itself is the only framing control.
