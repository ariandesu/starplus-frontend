# 3D body models: source and licence

| File | Source mesh | `Body` triangles | `Hair` triangles | Size | Height |
|---|---|---|---|---|---|
| `body-male.glb` | `GEO-body_male_realistic` + its two eye meshes | 30,000 | 7,102 | 721,680 bytes | 1.690 m |
| `body-female.glb` | `GEO-body_female_realistic` + its two eye meshes | 30,000 | 14,417 | 885,896 bytes | 1.639 m |

## `space-shuttle.glb` (background decoration)

Space Shuttle *Discovery*: 5 meshes, 12 textures, 18,468,656 bytes, SHA-256
`6cfe7b8540bccb24075752de97f457658137b3241f3864272ccc009651d9153b`.

*   **Taken from** `public/models/space_shuttle_discovery.glb` in
    <https://github.com/ariandesu/star-plus> (MIT repository), commit on `main`,
    downloaded 2026-11-11. The file is byte-identical to the copy there; it is not
    re-exported, decimated or retextured.
*   **Upstream author and licence: not documented.** That repository credits its
    anatomy models in `HRA_ATTRIBUTION.md` but says nothing about this one. The
    author approved shipping it as-is for the hackathon; **before any public
    release, record the original author and licence here.**
*   Rendered at 440 × 250 with three.js, from the same material set the file
    ships with. It is decoration only: `aria-hidden`, `pointer-events: none`,
    behind the content, and not mounted for reduced-motion readers or automated
    browsers.

## Source

*   **Human Base Meshes, asset bundle v1.4.1**, by Blender Studio and community
    contributors.
*   Listed at https://www.blender.org/download/demo-files/ (section "Asset Bundles").
*   File: `human-base-meshes-bundle-v1.4.1.zip`, 50,643,039 bytes, downloaded 2026-11-10
    from Blender's mirror network.
    SHA-256: `811f43accbb31a88266d932f8f5563b2d13586fca0ba2693aad1f5fe582b3515`

## Licence

**CC0 (public domain).** The download page lists the bundle as "CC0", and the README
inside the `.blend` file says: "All provided assets are public domain under the CC0
license."

Note for anyone checking: the `.blend` file also holds a text block named "License" that
reads "The Rain Rig is released under the Creative Commons Attribution 4.0 license". It
names a different Blender Studio asset and looks like a leftover. The credit above also
meets CC BY 4.0, should that text ever be held to apply.

## What was changed

Made with Blender 5.2.3 by `tools/build-body-model.py`:

1.  The body's multiresolution modifier was set to level 2 and applied; the two eye
    meshes were joined to it.
2.  The mesh was centred on the ground plane with the feet at height 0.
3.  It was reduced to 30,000 triangles (collapse decimation) and smooth-shaded.
4.  UV maps, face sets and other unused attributes were removed.
5.  One plain material was assigned (base colour `#D9D4CC`, roughness 0.6, not metallic).
6.  **Hair was added. It is not part of the bundle; the script builds it from nothing but
    the head's own surface:** a thin cap over the scalp, cut along a hairline measured from
    the eyes and ears, plus a few hundred tapered ribbons laid along a flow direction (a
    short crop for the male, a chin-length bob for the female). It is a second mesh,
    `Hair`, with its own material (`#2E2824`, roughness 0.5, double-sided). The random
    choices are seeded, so a rebuild gives the same hair.
7.  Each file was exported as binary glTF 2.0: Y up, facing +Z, in metres, positions and
    normals only, 16-bit indices, no textures, no extensions, no compression.

The meshes have no genital or nipple detail. No AI image or 3D generator was used. The
script itself was written by Claude (an AI assistant) at the author's request.

## Rebuild

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec \
  human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend \
  --python tools/build-body-model.py -- public/models 30000
```
