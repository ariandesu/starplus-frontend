# 3D body models: source and licence

| File | Source mesh | `Body` triangles | `Hair` triangles | Size | Height |
|---|---|---|---|---|---|
| `body-male.glb` | `GEO-body_male_realistic` + its two eye meshes | 30,000 | 7,102 | 721,680 bytes | 1.690 m |
| `body-female.glb` | `GEO-body_female_realistic` + its two eye meshes | 30,000 | 14,417 | 885,896 bytes | 1.639 m |

## `space-shuttle-d*.glb` (background decoration)

"Space Shuttle (D)", "Space Shuttle (D) eng", "door-prt" and "door-stb", NASA 3D Resources
(github.com/nasa/NASA-3D-Resources), NASA, free and without copyright; used unmodified.

| File | Bytes | SHA-256 |
|---|---|---|
| `space-shuttle-d.glb` | 2,471,932 | `d0015681ff092d36062fdfed78e2bd1ca0f86e90862840d25bae11c686ce3549` |
| `space-shuttle-d-engine.glb` | 480,216 | `e31cfb57e3365f036d40cee79ac9e2f8b5f4c48849f6aa9e19aee4075846a0bc` |
| `space-shuttle-d-door-prt.glb` | 36,044 | `cd8e84f3b108137f573ef260b5be8c35816fbb89e273b4648b20e35aee1ed419` |
| `space-shuttle-d-door-stb.glb` | 36,024 | `f48cf6e5f11ec13f28b143526cdd27751a5fe7117b45472b5d49b185c9ac45dc` |

The model shows the NASA insignia and the US flag as part of NASA's own model; their
appearance does not imply NASA endorsement of STAR PLUS.

Draco decoder (`public/draco/draco_decoder.wasm`, `draco_wasm_wrapper.js`), Google,
Apache-2.0, copied unmodified from three.js 0.187.0 (`examples/jsm/libs/draco/gltf/`).

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
