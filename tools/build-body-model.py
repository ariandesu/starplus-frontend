"""Build body-male.glb / body-female.glb (body + mesh hair) from the Blender Studio
Human Base Meshes bundle (CC0).

Run:
  Blender --background --factory-startup --disable-autoexec human_base_meshes_bundle.blend \
    --python build-body-model.py -- <out_dir> [body_tris]

The hair is plain geometry (no textures, no alpha): a thin cap over the scalp plus a few
hundred tapered, ridged ribbons ("locks") laid along a flow field. Everything is seeded,
so the output is reproducible.
"""
import math
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_DIR = argv[0]
BODY_TRIS = int(argv[1]) if len(argv) > 1 else 30000

SOURCES = {"male": "GEO-body_male_realistic", "female": "GEO-body_female_realistic"}

scene = bpy.context.scene
view_layer = bpy.context.view_layer
DOWN = Vector((0.0, 0.0, -1.0))


# --------------------------------------------------------------------------- helpers
def smoothstep(x, lo, hi):
    if hi == lo:
        return 1.0 if x >= hi else 0.0
    t = max(0.0, min(1.0, (x - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def tangent(vec, normal):
    """Project vec onto the plane with this normal; normalised (zero vector if degenerate)."""
    out = vec - normal * vec.dot(normal)
    return out.normalized() if out.length > 1e-6 else Vector((0, 0, 0))


def world_mesh(obj, level):
    """New mesh datablock: modifiers applied at this multires level, world space."""
    for mod in obj.modifiers:
        if mod.type == "MULTIRES":
            mod.levels = min(level, mod.total_levels)
    if obj.name not in view_layer.objects:
        scene.collection.objects.link(obj)
    obj.hide_viewport = False
    obj.hide_set(False)
    obj.update_tag()
    view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph), depsgraph=depsgraph)
    mesh.transform(obj.matrix_world)
    return mesh


def material(name, srgb_hex, roughness, double_sided=False):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    rgb = [lin(int(srgb_hex[i:i + 2], 16)) for i in (1, 3, 5)]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.use_backface_culling = not double_sided
    return mat


BODY_MAT = material("Body", "#D9D4CC", 0.6)
HAIR_MAT = material("Hair", "#2E2824", 0.5, double_sided=True)


# --------------------------------------------------------------------------- head model
class Head:
    """Landmarks and the hairline, measured on the mesh (Blender axes: Z up, face to -Y)."""

    def __init__(self, verts, eye_z):
        self.eye_z = eye_z
        self.top = float(verts[:, 2].max())
        band = verts[(np.abs(verts[:, 2] - (eye_z + 0.03)) < 0.006) & (np.abs(verts[:, 0]) < 0.14)]
        self.front_y, self.back_y = float(band[:, 1].min()), float(band[:, 1].max())
        self.yc = (self.front_y + self.back_y) / 2
        self.half_width = float(np.abs(band[:, 0]).max())
        ear = verts[(verts[:, 2] > eye_z - 0.055) & (verts[:, 2] < eye_z + 0.015)
                    & (np.abs(verts[:, 0]) > self.half_width + 0.003) & (np.abs(verts[:, 0]) < 0.12)]
        self.ear_y = (float(ear[:, 1].min()), float(ear[:, 1].max()))
        self.ear_z = (float(ear[:, 2].min()), float(ear[:, 2].max()))
        self.ear_az = self.azimuth(self.half_width + 0.006, sum(self.ear_y) / 2)
        e = self.ear_az
        # (azimuth in degrees from the front, height of the hairline above eye level)
        self.hairline = [
            (0, 0.064), (25, 0.066), (45, 0.060), (60, 0.046), (e - 24, 0.022), (e - 14, -0.010),
            (e - 7, 0.018), (e, 0.024), (e + 10, 0.018), (e + 19, -0.022), (e + 36, -0.060),
            (150, -0.078), (180, -0.082),
        ]

    def azimuth(self, x, y):
        return math.degrees(math.atan2(abs(x), -(y - self.yc)))

    def hairline_z(self, az):
        pts = self.hairline
        if az <= pts[0][0]:
            return self.eye_z + pts[0][1]
        for (a0, h0), (a1, h1) in zip(pts, pts[1:]):
            if az <= a1:
                t = (az - a0) / (a1 - a0)
                t = t * t * (3 - 2 * t)
                return self.eye_z + lerp(h0, h1, t)
        return self.eye_z + pts[-1][1]

    def margin(self, p):
        """Height of a point above the hairline (positive means hair grows here)."""
        return p[2] - self.hairline_z(self.azimuth(p[0], p[1]))

    def radial(self, p):
        """Horizontal direction pointing away from the head axis."""
        out = Vector((p[0], p[1] - self.yc, 0.0))
        return out.normalized() if out.length > 1e-6 else Vector((0, 1, 0))


# --------------------------------------------------------------------------- scalp cap
def clip_scalp(verts, normals, tris, head):
    """Triangles of the scalp, cut cleanly along the hairline (scalar field clipping)."""
    field = {}

    def value(i):
        if i not in field:
            field[i] = head.margin(verts[i])
        return field[i]

    out_v, out_n, out_t, index = [], [], [], {}

    def add(pos, nor):
        key = (round(pos[0], 5), round(pos[1], 5), round(pos[2], 5))
        if key not in index:
            index[key] = len(out_v)
            out_v.append(pos)
            out_n.append(nor)
        return index[key]

    z_floor = head.eye_z - 0.11
    for a, b, c in tris:
        if verts[a][2] < z_floor and verts[b][2] < z_floor and verts[c][2] < z_floor:
            continue
        corners = [(Vector(verts[i]), Vector(normals[i]), value(i)) for i in (a, b, c)]
        if all(s < 0 for _, _, s in corners):
            continue
        poly = []
        for k in range(3):
            p, q = corners[k], corners[(k + 1) % 3]
            if p[2] >= 0:
                poly.append((p[0], p[1]))
            if (p[2] >= 0) != (q[2] >= 0):
                t = p[2] / (p[2] - q[2])
                poly.append((p[0].lerp(q[0], t), p[1].lerp(q[1], t).normalized()))
        ids = [add(pos, nor) for pos, nor in poly]
        for k in range(1, len(ids) - 1):
            tri = (ids[0], ids[k], ids[k + 1])
            if len(set(tri)) == 3:
                out_t.append(tri)
    return out_v, out_n, out_t


def sample_roots(cap_v, cap_n, cap_t, spacing, rng):
    """Evenly spaced points on the scalp (dart throwing with a spatial hash)."""
    areas = []
    for a, b, c in cap_t:
        areas.append(((cap_v[b] - cap_v[a]).cross(cap_v[c] - cap_v[a])).length / 2)
    total = sum(areas)
    cum, acc = [], 0.0
    for area in areas:
        acc += area
        cum.append(acc)
    tries = int(total / (spacing * spacing) * 30)
    grid, roots = {}, []
    cell = spacing
    import bisect
    for _ in range(tries):
        tri = cap_t[bisect.bisect_left(cum, rng.random() * total)]
        u, v = rng.random(), rng.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        a, b, c = (cap_v[i] for i in tri)
        p = a + (b - a) * u + (c - a) * v
        key = (int(p.x // cell), int(p.y // cell), int(p.z // cell))
        ok = True
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for q in grid.get((key[0] + dx, key[1] + dy, key[2] + dz), ()):
                        if (q - p).length < spacing:
                            ok = False
                            break
                    if not ok:
                        break
                if not ok:
                    break
            if not ok:
                break
        if ok:
            grid.setdefault(key, []).append(p)
            na, nb, nc = (cap_n[i] for i in tri)
            roots.append((p, (na + (nb - na) * u + (nc - na) * v).normalized()))
    return roots


# --------------------------------------------------------------------------- strands
def surface(bvh, p):
    """Nearest surface point, its outward normal, and the signed distance of p from it."""
    loc, nor, _, _ = bvh.find_nearest(p)
    delta = p - loc
    dist = delta.length if delta.dot(nor) >= 0 else -delta.length
    return loc, nor, dist


def grow_male(root, normal, head, bvh, rng):
    top = smoothstep(normal.z, 0.30, 0.70)
    edge = smoothstep(head.margin(root), 0.0, 0.03)
    length = lerp(0.016, 0.034, top) * lerp(0.55, 1.0, edge) * rng.uniform(0.75, 1.25)
    segments = 3 if length > 0.022 else 2
    tip_lift = lerp(0.0035, 0.0085, top) * rng.uniform(0.7, 1.3)
    sweep = Vector((0.55, -0.80, 0.0)).normalized()
    yaw = rng.uniform(-0.30, 0.30)
    pts = [(root + normal * 0.0022, normal)]
    p, n = root, normal
    for i in range(1, segments + 1):
        flow = tangent(sweep, n) * top + tangent(Vector((0.0, 0.30, -1.0)), n) * (1 - top)
        side = n.cross(flow)
        flow = (flow + side * yaw).normalized() if flow.length > 1e-6 else tangent(DOWN, n)
        loc, n, _ = surface(bvh, p + flow * (length / segments))
        p = loc
        lift = lerp(0.0022, tip_lift, (i / segments) ** 0.8)
        pts.append((p + n * lift, n))
    width = lerp(0.0105, 0.0125, top) * rng.uniform(0.85, 1.15)
    return pts, width


def grow_female(root, normal, head, bvh, rng, part_x, hem_z):
    """A long lock: walks over the head away from the part, then hangs to the hem."""
    step = 0.017
    lift_max = lerp(0.005, 0.011, rng.random())
    hem = hem_z + rng.uniform(-0.006, 0.006)
    yaw = rng.uniform(-0.12, 0.12)
    part_front = head.front_y - 0.05
    part_back = head.yc + 0.035
    pts = [(root + normal * 0.003, normal)]
    p, n = root.copy(), normal.copy()
    direction = None
    free = False
    travelled = 0.0
    for _ in range(40):
        travelled += step
        lift = lerp(0.003, lift_max, smoothstep(travelled, 0.0, 0.04))
        if not free and n.z < -0.05 and direction is not None:
            free = True  # the surface now faces down: the lock leaves it and hangs
            p = p + n * lift
        if not free:
            # Away from the part line on top and on the forehead, downhill elsewhere.
            nearest_y = min(max(p.y, part_front), part_back)
            away = Vector((p.x - part_x, p.y - nearest_y, 0.0))
            if away.length < 1e-4:
                away = Vector((1.0 if rng.random() < 0.5 else -1.0, 0, 0))
            w = max(smoothstep(n.z, 0.35, 0.75), smoothstep(-n.y, 0.25, 0.60))
            flow = tangent(away.normalized(), n) * w + tangent(Vector((0.0, 0.12, -1.0)), n) * (1 - w)
            if flow.length < 1e-6:
                flow = tangent(DOWN, n)
            flow = flow.normalized()
            flow = (flow + n.cross(flow) * yaw).normalized()
            direction = flow if direction is None else (direction * 0.35 + flow * 0.65).normalized()
            loc, n, _ = surface(bvh, p + direction * step)
            p = loc
            pts.append((loc + n * lift, n))
        else:
            inward = -head.radial(p) * (0.55 * smoothstep(p.z, hem + 0.045, hem))
            direction = (direction * 0.45 + DOWN * 0.55 + inward).normalized()
            cand = p + direction * step
            loc, nor, dist = surface(bvh, cand)
            if dist < lift:
                cand = loc + nor * lift
                if nor.z > 0.25:  # landed on a supporting surface: walk on it again
                    free, p, n = False, loc, nor
                    pts.append((cand, nor))
                    continue
            p = cand
            n = (head.radial(p) * 0.9 + Vector((0, 0, 0.1))).normalized()
            pts.append((p, n))
        if pts[-1][0].z < hem:
            break
    if len(pts) < 3:
        return None, 0.0
    return pts, 0.0165 * rng.uniform(0.85, 1.2)


def ribbon(bm, pts, width, rng):
    """A tapered lock with a raised centre ridge, three vertices across."""
    count = len(pts)
    rows = []
    for i, (p, n) in enumerate(pts):
        if i == 0:
            t = pts[1][0] - p
        elif i == count - 1:
            t = p - pts[i - 1][0]
        else:
            t = pts[i + 1][0] - pts[i - 1][0]
        t = t.normalized()
        side = t.cross(n)
        side = side.normalized() if side.length > 1e-6 else Vector((1, 0, 0))
        up = side.cross(t).normalized()
        f = i / (count - 1)
        w = width * (lerp(0.7, 1.0, smoothstep(f, 0.0, 0.25)) if f < 0.25 else lerp(1.0, 0.22, smoothstep(f, 0.45, 1.0)))
        if i == count - 1:
            rows.append((bm.verts.new(p),))
        else:
            rows.append((bm.verts.new(p - side * (w / 2) - up * (w * 0.10)),
                         bm.verts.new(p + up * (w * 0.14)),
                         bm.verts.new(p + side * (w / 2) - up * (w * 0.10))))
    for a, b in zip(rows, rows[1:]):
        if len(b) == 3:
            bm.faces.new((a[0], a[1], b[1], b[0]))
            bm.faces.new((a[1], a[2], b[2], b[1]))
        else:
            bm.faces.new((a[0], a[1], b[0]))
            bm.faces.new((a[1], a[2], b[0]))


def build_hair(sex, verts_hi, tris_hi, mesh_lo, head, seed):
    rng = random.Random(seed)
    bvh = BVHTree.FromPolygons([Vector(v) for v in verts_hi], [tuple(t) for t in tris_hi])

    lo_v = [tuple(v.co) for v in mesh_lo.vertices]
    lo_n = [tuple(v.normal) for v in mesh_lo.vertices]
    mesh_lo.calc_loop_triangles()
    lo_t = [tuple(t.vertices) for t in mesh_lo.loop_triangles]
    cap_v, cap_n, cap_t = clip_scalp(lo_v, lo_n, lo_t, head)

    if sex == "female":
        # Long locks walk over a smoothed copy of the head, so the ears read as soft bumps.
        proxy = bmesh.new()
        proxy.from_mesh(mesh_lo)
        head_verts = [v for v in proxy.verts if v.co.z > head.eye_z - 0.13]
        for _ in range(25):
            bmesh.ops.smooth_vert(proxy, verts=head_verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        proxy.normal_update()
        walk_bvh = BVHTree.FromBMesh(proxy)
        proxy.free()
    else:
        walk_bvh = bvh

    bm = bmesh.new()
    cap_offset = 0.0020 if sex == "male" else 0.0025
    cap_bm_verts = [bm.verts.new(p + n * cap_offset) for p, n in zip(cap_v, cap_n)]
    for a, b, c in cap_t:
        try:
            bm.faces.new((cap_bm_verts[a], cap_bm_verts[b], cap_bm_verts[c]))
        except ValueError:
            pass
    cap_faces = len(bm.faces)

    spacing = 0.0095 if sex == "male" else 0.0120
    roots = sample_roots(cap_v, cap_n, cap_t, spacing, rng)
    strands = 0
    for root, normal in roots:
        if sex == "male":
            pts, width = grow_male(root, normal, head, bvh, rng)
        else:
            pts, width = grow_female(root, normal, head, walk_bvh, rng, part_x=0.014, hem_z=head.eye_z - 0.118)
        if pts:
            ribbon(bm, pts, width, rng)
            strands += 1

    mesh = bpy.data.meshes.new("Hair")
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(HAIR_MAT)
    mesh.calc_loop_triangles()
    print("HAIR", sex, "cap_tris", cap_faces, "roots", len(roots), "strands", strands, "tris", len(mesh.loop_triangles), "verts", len(mesh.vertices))
    return mesh


# --------------------------------------------------------------------------- body
def build(sex, source_name):
    body = bpy.data.objects[source_name]
    eyes = [c for c in body.children if c.type == "MESH"]

    hi = world_mesh(body, 2)
    lo = world_mesh(body, 1)
    eye_meshes = [world_mesh(e, 0) for e in eyes]

    co = np.array([tuple(v.co) for v in hi.vertices])
    offset = Vector(((co[:, 0].min() + co[:, 0].max()) / 2, (co[:, 1].min() + co[:, 1].max()) / 2, co[:, 2].min()))
    for mesh in [hi, lo] + eye_meshes:
        mesh.transform(Matrix.Translation(-offset))

    verts_hi = np.array([tuple(v.co) for v in hi.vertices])
    hi.calc_loop_triangles()
    tris_hi = [tuple(t.vertices) for t in hi.loop_triangles]
    eye_z = sum(sum(v.co.z for v in m.vertices) / len(m.vertices) for m in eye_meshes) / len(eye_meshes)
    head = Head(verts_hi, eye_z)
    print("HEAD", sex, "eye_z", round(eye_z, 4), "top", round(head.top, 4), "yc", round(head.yc, 4),
          "half_width", round(head.half_width, 4), "ear_y", [round(v, 3) for v in head.ear_y],
          "ear_z", [round(v, 3) for v in head.ear_z], "ear_az", round(head.ear_az, 1))

    hair_mesh = build_hair(sex, verts_hi, tris_hi, lo, head, seed=11 if sex == "male" else 23)

    # Body: level-2 surface + eyes, decimated.
    bm = bmesh.new()
    bm.from_mesh(hi)
    for mesh in eye_meshes:
        bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    full_tris = len(bm.faces)
    merged = bpy.data.meshes.new("full")
    bm.to_mesh(merged)
    bm.free()
    tmp = bpy.data.objects.new("full", merged)
    scene.collection.objects.link(tmp)
    dec = tmp.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, BODY_TRIS / full_tris)
    view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    body_mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(depsgraph), depsgraph=depsgraph)
    bpy.data.objects.remove(tmp)
    for mesh in [merged, hi, lo] + eye_meshes:
        bpy.data.meshes.remove(mesh)

    body_mesh.name = "Body"
    while body_mesh.uv_layers:
        body_mesh.uv_layers.remove(body_mesh.uv_layers[0])
    for attr in list(body_mesh.color_attributes):
        body_mesh.color_attributes.remove(attr)
    for attr in [a for a in body_mesh.attributes if not a.is_internal and not a.is_required and a.name not in {"sharp_face", "sharp_edge"}]:
        try:
            body_mesh.attributes.remove(attr)
        except Exception:  # noqa: BLE001
            pass
    for poly in body_mesh.polygons:
        poly.use_smooth = True
    body_mesh.materials.clear()
    body_mesh.materials.append(BODY_MAT)

    body_obj = bpy.data.objects.new("Body", body_mesh)
    hair_obj = bpy.data.objects.new("Hair", hair_mesh)
    for o in view_layer.objects:
        o.select_set(False)
    for o in (body_obj, hair_obj):
        scene.collection.objects.link(o)
        o.select_set(True)
    view_layer.objects.active = body_obj

    path = f"{OUT_DIR}/body-{sex}.glb"
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=False, export_normals=True, export_tangents=False, export_materials="EXPORT",
        export_animations=False, export_skins=False, export_morph=False, export_cameras=False,
        export_lights=False, export_extras=False,
    )
    hair_mesh.calc_loop_triangles()
    print("BUILT", sex, "body_tris", len(body_mesh.polygons), "hair_tris", len(hair_mesh.loop_triangles), "->", path)
    for o in (body_obj, hair_obj):
        o.select_set(False)
        bpy.data.objects.remove(o)


for sex_name, src in SOURCES.items():
    build(sex_name, src)
print("DONE")
