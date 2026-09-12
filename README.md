# GameHub v1.8.45

SideScroll character scale + walk-cycle pass.

- Reduced the SideScroll character plane to roughly **one quarter of the previous size**.
- Rebuilt the walk animation page as a clear external file: **sidescroll-character-walk.png**.
- The page contains the eight walk poses in the correct 1 → 8 sequence, cropped from the supplied reference into equal animation cells.
- The shader still shows one eighth of the page at a time, so this is now a genuine flip-book texture test rather than eight separately drawn runtime characters.
- The animation remains tied to distance travelled, with shorter leg-swing phases and longer planted-foot/body-travel phases to better match the reference walk breakdown.
- Idle now holds the first pose instead of flicking between walk frames.
- Forest density, depth fog and the slower camera movement are otherwise unchanged from v1.8.44.
