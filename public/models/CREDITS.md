# 3D body models: source and licence

## 3D people on the Body page

`body-male.glb`: "Miez" by taiegayolo, and
`body-female.glb`: "Hight Quality Realistic Girl Character" by hammer.gamedev,
both from Sketchfab
([Miez](https://sketchfab.com/3d-models/miez-88626b65035742b39c87a6acf8423aaa),
[Girl](https://sketchfab.com/3d-models/hight-quality-realistic-girl-character-e604d0b19f2f44c08f58bacad2ed03d8)),
licensed under **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).
**Changes:** rig removed (bind pose baked), tangents, extra UV sets and unused
vertex data dropped, indices narrowed to 16-bit, textures reduced to at most
512 px (JPEG, PNG only where the alpha channel is actually used), packed to a
plain GLB by `bake-body.py` (male) and a three.js bind-pose bake plus
`postprocess-glb.py` (female).

| File | Bytes | SHA-256 | Triangles |
|---|---|---|---|
| `body-male.glb` (output) | 3,571,212 | `19481612acef3bbcaa93732413324e87cfa3193f22a6621e8526c1a3ceed88a0` | 60,310 |
| `body-female.glb` (output) | 5,099,288 | `23b7b1c5a7660f9ade9b76fbefb64f40b55c3b8d5454acac3ce54c2aacb419e0` | 80,906 |
| `miez.zip` (source download) | 8,462,222 | — | — |
| `hight_quality_realistic_girl_character.zip` (source download) | 24,877,255 | — | — |

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


`public/login-cupola.jpg`: astronaut at a station cupola, used as the login
page side panel with a caption above it.

| File | Bytes | SHA-256 |
|---|---|---|
| `login-cupola.jpg` | 274,241 | `135c49c5f734be9f43f373e6e425c16950ff3c7183a30395a7ef6e5b3cec99e8` |

Source and licence: supplied by the author; licence line pending. Precached
by the service worker (`next.config.ts`).

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
