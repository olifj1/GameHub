# GameHub v1.8.66

Walk Lab simple-character rebuild.

- Returned to the **first simple-parts character design** as the authoritative art source; later regenerated variants are not used.
- Removed the cream source background programmatically to create a transparent atlas.
- Split the original long near/far leg artwork into independent **thigh + shin + foot** pieces while preserving the original proportions.
- Simplified the live cutout rig to head, upper/lower body, upper/lower arms, upper/lower legs and separate feet; cloak / extra hair pieces are removed for now.
- Reworked the default 16-frame walk so contact / passing / up poses become much taller and the support leg can approach full extension instead of remaining permanently crouched.
- Frame 1 is tuned toward the assembled reference pose from the source sheet.
- Walk Lab and SideScroll now both load the atlas directly from the shared rig definition to prevent the two renderers drifting onto different art files.
- SideScroll continues to render the live rig directly rather than a baked flipbook.
