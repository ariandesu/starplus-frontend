# 3D body models: source and licence

## 3D people on the Body page

`body-male.glb`: "Eric Rigged 001 - Rigged 3D Business Man" by Renderpeople, and
`body-female.glb`: "Claudia Rigged 002 - 3D Rigged Business Women" by Renderpeople,
both from Sketchfab
([Eric](https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f),
[Claudia](https://sketchfab.com/3d-models/claudia-rigged-002-3d-rigged-business-women-c659bd0accab47c6bbe390cf822a2b92)),
licensed under **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).
**Changes:** rig removed (pose baked), textures reduced to 1,024 px JPEG, converted to
a plain GLB by `tools/build-renderpeople-body.py`.

| File | Bytes | SHA-256 | Triangles |
|---|---|---|---|
| `body-male.glb` (output) | 748,516 | `5f1b8dcebe3272f555e200018bde0ba9f44dabb5daeb2789b7efae802e56a279` | 20,542 |
| `body-female.glb` (output) | 770,600 | `9ee4c692aa12f2c895359b8f48bd49c210707189a398108ad19929f6f4f68da2` | 21,492 |
| `eric_rigged_001_-_rigged_3d_business_man.glb` (source download) | 18,727,648 | `7228f0ce0a7426d6e5ccb8a45b453a02f046fba33153213daa3927aeefb1ffb4` | — |
| `claudia_rigged_002_-_3d_rigged_business_women.glb` (source download) | 24,486,456 | `151178ca34ec8db72c01ee21d35b5c81d07d3a58fb8f586affc46061ce1a9bb4` | — |

The scan geometry was not edited.


## Dashboard photos (author-supplied)

`public/hero-iss.jpg`: International Space Station above Earth, used as the
overall-status card background with all text and buttons above it.
`public/sidebar-earth.jpg`: light Earth-horizon gradient, used at the sidebar
base on wide screens.

| File | Bytes | SHA-256 |
|---|---|---|
| `hero-iss.jpg` | 214,555 | `21ded4f454445ce246749c389a5c4daec7e2402bf3dea016324482e632a8f166` |
| `sidebar-earth.jpg` | 15,806 | `2cc0a7bb6ee85e2732e50403422c0f63e1e5660a2c7e4a32602f89961c9e1ddb` |

Source and licence: supplied by the author; licence line pending. Both files
are precached by the service worker (`next.config.ts`).

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
