# GameHub v1.8.61

SideScroll generated character + Walk Lab sprite overlay pass.

- Replaced the SideScroll placeholder character with the latest **16-frame minimal-iconic girl** generated from the Walk Lab reference.
- Converted the generated black-background page to a transparent **1024×1536 RGBA 4×4 atlas** for the game.
- SideScroll now reads all **16 frames** from the 4×4 atlas while keeping the walk tied to travelled distance.
- Added a **Sprite** overlay to Walk Lab so the generated character can play directly over the editable stick rig, frame-for-frame.
- Added **Load sprite** so another 4×4 / 16-frame sheet can be compared without rebuilding the app. Near-black image backgrounds are keyed out automatically for the overlay.
- The sprite overlay uses the existing movable/scalable export frame, so the exact crop alignment can be judged against the rig.
- Included the original generated black-background source page as `sidescroll-character-walk-source.png`.
