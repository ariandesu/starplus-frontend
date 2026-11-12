"""Build body-male.glb / body-female.glb from Renderpeople's free rigged scans (CC BY 4.0).

Sources (Sketchfab, official @renderpeople account, "Download 3D Model" > GLB, 4k textures):
  male:   "Eric Rigged 001 - Rigged 3D Business Man"
          https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f
  female: "Claudia Rigged 002 - 3D Rigged Business Women"
          https://sketchfab.com/3d-models/claudia-rigged-002-3d-rigged-business-women-c659bd0accab47c6bbe390cf822a2b92

Run (one model per call):
  Blender --background --factory-startup --disable-autoexec \
    --python build-renderpeople-body.py -- <in.glb> <out.glb> [texture_px]

What it does, and nothing else:
  1. imports the GLB;
  2. bakes the bind pose into the mesh (applies the armature) and deletes the rig, so the
     model is a static mesh in its A-pose;
  3. names the mesh object and data "Body" (the Body page looks it up by that name);
  4. scales the colour and normal textures down (default 1024 px) and exports them as JPEG;
  5. exports a GLB with no animation, skin, Draco or other extensions.
The scan geometry and the texture content are otherwise unchanged.
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
IN_PATH, OUT_PATH = argv[0], argv[1]
TEX_PX = int(argv[2]) if len(argv) > 2 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_PATH)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print("MESHES", [(o.name, len(o.data.vertices)) for o in meshes])
# The importer can add a small helper mesh (bone display shape); the scan is the
# skinned mesh with the most vertices.
skinned = [o for o in meshes if any(m.type == "ARMATURE" for m in o.modifiers)]
if len(skinned) != 1:
    raise SystemExit(f"expected one skinned mesh, found {len(skinned)}")
body = skinned[0]

# Bake the current (bind) pose into the mesh, then drop the rig.
bpy.context.view_layer.objects.active = body
for mod in list(body.modifiers):
    if mod.type == "ARMATURE":
        bpy.ops.object.modifier_apply(modifier=mod.name)
world = body.matrix_world.copy()
body.parent = None
body.matrix_world = world
for obj in list(bpy.context.scene.objects):
    if obj is not body:
        bpy.data.objects.remove(obj, do_unlink=True)
body.vertex_groups.clear()
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

body.name = "Body"
body.data.name = "Body"

# Smaller textures: scale every image down to TEX_PX on its longest side.
for image in bpy.data.images:
    w, h = image.size
    if max(w, h) > TEX_PX:
        k = TEX_PX / max(w, h)
        image.scale(max(1, round(w * k)), max(1, round(h * k)))

tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
dims = body.dimensions
print(f"BODY tris={tris} dims=({dims.x:.3f}, {dims.y:.3f}, {dims.z:.3f}) images={[(i.name, tuple(i.size)) for i in bpy.data.images]}")

bpy.ops.export_scene.gltf(
    filepath=OUT_PATH,
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_draco_mesh_compression_enable=False,
    export_image_format="JPEG",
    export_jpeg_quality=85,
    export_yup=True,
)
print("WROTE", OUT_PATH)
