"""Surgical gown fitted to the posed human: long sleeves, tight knit cuffs, mid-calf, no collar,
crossed back wrap with waist and neck ties. Measured from the body, unified with a voxel remesh,
then draped with a cloth simulation and frozen as a static mesh."""
import math

import bmesh
import bpy
from mathutils import Vector

FABRIC = (0.047, 0.245, 0.315, 1)  # surgical blue, linear RGB
TRIM = (0.018, 0.11, 0.15, 1)
SECTORS = 96
# Vertices the torso silhouette ignores: arms get their own sleeves, the face stays uncovered.
NOT_TORSO_BONES = (
    "upperarm", "lowerarm", "wrist", "finger", "metacarpal",
    "head", "jaw", "special", "eye", "oris", "levator", "orbicularis", "risorius", "tongue",
    "temporalis",
)
WRAP_WIDTH = 0.15
NECK_RX = 0.086
NECK_RY = 0.086
HEM_ALLOWANCE = 0.2  # extra skirt to simulate; the hem is cut after the cloth has settled
NECK_RIM_RADIUS = 0.016
BACK_GAP = 0.04
WRAP_OFFSET = 0.012
VOXEL = 0.0105
SLEEVE_END = 0.06  # distance from the wrist where the loose sleeve meets the knit cuff


def bone_head(rig, name):
    return rig.matrix_world @ rig.pose.bones[name].head


def bone_tail(rig, name):
    return rig.matrix_world @ rig.pose.bones[name].tail


def landmarks(rig):
    knee = bone_head(rig, "lowerleg01.L")
    ankle = bone_head(rig, "foot.L")
    return {
        "hem": ankle.z + 0.5 * (knee.z - ankle.z),
        "hip": bone_head(rig, "upperleg01.L").z,
        "waist": bone_head(rig, "spine04").z,
        "shoulder": bone_head(rig, "upperarm01.L").z,
        "neck": bone_head(rig, "neck01").z,
    }


def evaluated_body(human):
    """Returns world-space (co, excluded_from_torso) for the posed visible body."""
    # MPFB hides the body under each clothing asset; the gown must be measured on the whole body.
    clothing_masks = [
        m for m in human.modifiers if m.type == "MASK" and m.show_viewport and m.name != "Hide helpers"
    ]
    for modifier in clothing_masks:
        modifier.show_viewport = False
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = human.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    names = {g.index: g.name for g in human.vertex_groups}
    points = []
    for vertex in mesh.vertices:
        weight = sum(
            g.weight for g in vertex.groups if names.get(g.group, "").startswith(NOT_TORSO_BONES)
        )
        points.append((human.matrix_world @ vertex.co, weight > 0.15))
    evaluated.to_mesh_clear()
    for modifier in clothing_masks:
        modifier.show_viewport = True
    bpy.context.view_layer.update()
    return points


def smooth_circular(values, passes=3):
    n = len(values)
    for _ in range(passes):
        values = [
            (values[(i - 1) % n] + 2 * values[i] + values[(i + 1) % n]) / 4 for i in range(n)
        ]
    return values


def convex_ring(radii):
    """Convex envelope of a polar ring: cloth bridges the sternum, the navel and the gap between
    the legs instead of following them, which would leave a crease down the front."""
    step = 2 * math.pi / SECTORS
    result = radii[:]
    for _ in range(3):
        for span in (1, 2, 4, 8, 12, 16):
            cos_span = math.cos(span * step)
            result = [
                # Radius, at the middle angle, of the chord joining the two neighbours at +-span.
                max(
                    result[i],
                    2 * cos_span / (1 / result[(i - span) % SECTORS] + 1 / result[(i + span) % SECTORS]),
                )
                for i in range(SECTORS)
            ]
    return result


def ring_radii(points, z, center, band=0.02):
    """Outer body radius per angle around `center`, interpolating sectors no vertex falls in."""
    radii = [0.0] * SECTORS
    for co, _ in points:
        if abs(co.z - z) > band:
            continue
        dx, dy = co.x - center.x, co.y - center.y
        sector = int((math.atan2(dy, dx) + math.pi) / (2 * math.pi) * SECTORS) % SECTORS
        radii[sector] = max(radii[sector], math.hypot(dx, dy))
    known = [i for i, r in enumerate(radii) if r > 0]
    if not known:
        return [0.05] * SECTORS
    filled = radii[:]
    for i, r in enumerate(radii):
        if r > 0:
            continue
        prev = max((k - SECTORS if k > i else k) for k in known)
        nxt = min((k + SECTORS if k < i else k) for k in known)
        t = (i - prev) / (nxt - prev)
        filled[i] = radii[prev % SECTORS] * (1 - t) + radii[nxt % SECTORS] * t
    return smooth_circular(convex_ring(filled))


def loft(name, rings, cap=True):
    """Builds a closed mesh from equally sized rings of world-space points."""
    verts = [co for ring in rings for co in ring]
    n = len(rings[0])
    faces = []
    for r in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append((r * n + i, r * n + j, (r + 1) * n + j, (r + 1) * n + i))
    if cap:
        faces.append(tuple(range(n - 1, -1, -1)))
        faces.append(tuple((len(rings) - 1) * n + i for i in range(n)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def torso_shell(points, marks):
    torso = [p for p in points if not p[1]]
    top = marks["neck"] + 0.04
    count = 54
    bottom = marks["hem"] - HEM_ALLOWANCE
    levels = [bottom + (top - bottom) * i / (count - 1) for i in range(count)]

    # Each level centres on its own slice: the body's axis is not straight in profile.
    centers = []
    for z in levels:
        ys = [co.y for co, _ in torso if abs(co.z - z) < 0.02 and abs(co.x) < 0.07]
        centers.append((min(ys) + max(ys)) / 2 if ys else 0.0)
    for _ in range(6):
        centers = [
            (centers[max(i - 1, 0)] + 2 * centers[i] + centers[min(i + 1, count - 1)]) / 4
            for i in range(count)
        ]
    profiles = [ring_radii(torso, z, Vector((0, cy, 0))) for z, cy in zip(levels, centers)]

    # From the hip down the gown falls free: never narrower than above it, with an A-line flare.
    hip_index = min(range(count), key=lambda i: abs(levels[i] - marks["hip"]))
    for r in range(hip_index - 1, -1, -1):
        centers[r] = centers[hip_index]
        drop = levels[hip_index] - levels[r]
        for s in range(SECTORS):
            profiles[r][s] = max(profiles[r + 1][s], profiles[hip_index][s] + 0.09 * drop)

    rings = []
    for z, cy, radii in zip(levels, centers, profiles):
        # Loose below the shoulder, close at the neckline.
        t = min(1.0, max(0.0, (z - marks["shoulder"]) / (top - marks["shoulder"])))
        ease = 0.03 * (1 - t) + 0.012 * t
        ring = []
        for s in range(SECTORS):
            angle = (s + 0.5) / SECTORS * 2 * math.pi - math.pi
            radius = radii[s] + ease
            ring.append(Vector((radius * math.cos(angle), cy + radius * math.sin(angle), z)))
        rings.append(ring)
    chest = [cy for z, cy in zip(levels, centers) if marks["waist"] < z < marks["shoulder"]]
    return loft("torso-shell", rings), Vector((0, sum(chest) / len(chest), 0))


def sleeve_shell(points, rig, side, slim=False):
    arm = [p[0] for p in points if p[1] and (p[0].x > 0) == (side == "L")]
    path = [
        bone_head(rig, f"upperarm01.{side}"),
        bone_head(rig, f"upperarm02.{side}"),
        bone_head(rig, f"lowerarm01.{side}"),
        bone_head(rig, f"lowerarm02.{side}"),
        bone_head(rig, f"wrist.{side}"),
    ]
    samples = []
    forearm = (path[-1] - path[-2]).normalized()
    path[-1] = path[-1] - forearm * SLEEVE_END
    for a, b in zip(path, path[1:]):
        samples += [a.lerp(b, i / 6) for i in range(6)]
    samples.append(path[-1])
    # Starts inside the shoulder so the sleeve and the torso unify without a gap.
    samples.insert(0, path[0] + Vector((-0.07 if side == "L" else 0.07, 0, -0.005)))
    total = len(samples)
    rings = []
    for index, co in enumerate(samples):
        forward = (samples[min(index + 1, total - 1)] - samples[max(index - 1, 0)]).normalized()
        nearby = [
            (p - co) - forward * (p - co).dot(forward)
            for p in arm
            if abs((p - co).dot(forward)) < 0.025
        ]
        radius = max((v.length for v in nearby), default=0.05)
        # Roomy at the shoulder, narrowing towards the cuff where the sleeve gets gathered.
        along = index / (total - 1)
        if slim:
            # With the elbow bent a roomy sleeve has nowhere to go and balloons.
            radius = min(radius, 0.056 - 0.012 * along) + 0.014 - 0.002 * along
        else:
            radius = min(radius, 0.072 - 0.02 * along) + 0.024 - 0.006 * along
        u = forward.orthogonal().normalized()
        v = forward.cross(u).normalized()
        rings.append(
            [
                co + (u * math.cos(a) + v * math.sin(a)) * radius
                for a in (2 * math.pi * i / 32 for i in range(32))
            ]
        )
    return loft(f"sleeve-shell-{side}", rings)


def apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def unify(parts):
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    gown = bpy.context.object
    gown.name = "gown"
    gown.data.name = "gown"
    modifier = gown.modifiers.new("remesh", "REMESH")
    modifier.mode = "VOXEL"
    modifier.voxel_size = VOXEL
    modifier.use_smooth_shade = True
    # Melts the seams of the union so shoulders read as cloth instead of lumps.
    smooth = gown.modifiers.new("smooth", "LAPLACIANSMOOTH")
    smooth.iterations = 12
    smooth.lambda_factor = 0.6
    apply_modifiers(gown)
    return gown


def cut(bm, co, normal):
    """Removes everything on the +normal side of the plane."""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=normal, clear_outer=True)


def open_garment(gown, rig, marks, center, closure):
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    # Collarless neckline: an ellipse around the neck, set forward so the front sits lower.
    neck_y = bone_head(rig, "neck01").y - 0.03
    bm.faces.ensure_lookup_table()
    opening = []
    for face in bm.faces:
        c = face.calc_center_median()
        inside = (c.x / NECK_RX) ** 2 + ((c.y - neck_y) / NECK_RY) ** 2 < 1
        if inside and c.z > marks["shoulder"] + 0.01:
            opening.append(face)
    bmesh.ops.delete(bm, geom=opening, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    # Nothing stands above the neck base, and the front scoops below the throat.
    cut(bm, (0, 0, marks["neck"] + 0.012), (0, 0, 1))
    front = [f for f in bm.faces if abs(f.calc_center_median().x) < 0.095 and f.calc_center_median().y < neck_y]
    verts = list({v for f in front for v in f.verts})
    edges = list({e for f in front for e in f.edges})
    bmesh.ops.bisect_plane(
        bm,
        geom=verts + edges + front,
        plane_co=(0, neck_y, marks["neck"] + 0.012),
        plane_no=Vector((0, -0.3, 1)).normalized(),
        clear_outer=True,
    )
    for side in ("L", "R"):
        wrist = bone_head(rig, f"wrist.{side}")
        forearm = (wrist - bone_head(rig, f"lowerarm02.{side}")).normalized()
        # Opens the rounded end the remesh left on the sleeve; the cylinder test spares the skirt.
        tip = wrist - forearm * SLEEVE_END
        end_cap = [
            f
            for f in bm.faces
            if (f.calc_center_median() - tip).dot(forearm) > -0.004
            and ((f.calc_center_median() - tip) - forearm * (f.calc_center_median() - tip).dot(forearm)).length < 0.07
            and (f.calc_center_median() - tip).length < 0.09
        ]
        bmesh.ops.delete(bm, geom=end_cap, context="FACES")

    # Back opening at x = 0; the left panel gets a flap that crosses over the right one.
    back = [f for f in bm.faces if f.calc_center_median().y > center.y]
    geom = list({v for f in back for v in f.verts}) + list({e for f in back for e in f.edges}) + back
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=(1, 0, 0))
    bm.edges.ensure_lookup_table()
    seam = [
        e
        for e in bm.edges
        if all(abs(v.co.x) < 1e-5 and v.co.y > center.y for v in e.verts)
    ]
    seam_verts = {v.index: v.co.copy() for e in seam for v in e.verts}
    bmesh.ops.split_edges(bm, edges=seam)
    if closure in ("open", "held"):
        # Nothing tied yet: the two back panels simply do not meet.
        for x in (-BACK_GAP, BACK_GAP):
            back = [f for f in bm.faces if f.calc_center_median().y > center.y]
            geom = list({v for f in back for v in f.verts}) + list({e for f in back for e in f.edges}) + back
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
        gap = [
            f
            for f in bm.faces
            if f.calc_center_median().y > center.y and abs(f.calc_center_median().x) < BACK_GAP
        ]
        bmesh.ops.delete(bm, geom=gap, context="FACES")
    if closure != "wrapped":
        bm.to_mesh(gown.data)
        bm.free()
        gown.data.update()
        return

    back = [f for f in bm.faces if f.calc_center_median().y > center.y]
    geom = list({v for f in back for v in f.verts}) + list({e for f in back for e in f.edges}) + back
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(-WRAP_WIDTH, 0, 0), plane_no=(1, 0, 0))
    source = [
        f
        for f in bm.faces
        if f.calc_center_median().y > center.y and -WRAP_WIDTH < f.calc_center_median().x < 0
    ]
    copy = bmesh.ops.duplicate(bm, geom=source)
    flap_faces = [g for g in copy["geom"] if isinstance(g, bmesh.types.BMFace)]
    flap_verts = {v for f in flap_faces for v in f.verts}
    bm.normal_update()
    for vertex in flap_verts:
        outward = Vector((vertex.co.x, vertex.co.y - center.y, 0))
        vertex.co += outward.normalized() * WRAP_OFFSET
    # Weld the flap's x = 0 edge to the left panel so the wrap is one continuous piece of cloth.
    left_edge = [
        v
        for v in bm.verts
        if abs(v.co.x) < 1e-4 and v.co.y > center.y and v not in flap_verts
    ]
    near = [v for v in flap_verts if abs(v.co.x) < 1e-3]
    bmesh.ops.remove_doubles(bm, verts=near + left_edge, dist=WRAP_OFFSET * 1.6)
    bm.to_mesh(gown.data)
    bm.free()
    gown.data.update()
    del seam_verts


def neck_rim(gown, marks):
    """Boundary around the neck opening; `offset_y` is how far forward a held gown sits."""
    offset = gown.get("offset_y", 0.0)
    return [
        e[0]
        for e in bmesh_boundary(gown)
        if e[2] > marks["shoulder"] - 0.01 and math.hypot(e[0].x, e[0].y - offset) < 0.17
    ]


def sleeve_rims(gown, rig):
    """Sleeve edges are sewn to the cuffs: fixed so the cloth cannot ride up the forearm."""
    tips = []
    for side in ("L", "R"):
        wrist = bone_head(rig, f"wrist.{side}")
        forearm = (wrist - bone_head(rig, f"lowerarm02.{side}")).normalized()
        tips.append(wrist - forearm * SLEEVE_END)
    return [e[0] for e in bmesh_boundary(gown) if any((e[0] - tip).length < 0.09 for tip in tips)]


def simulate(gown, rig, colliders, marks, center, closure, frames=46):
    """Drapes the gown over the body; shoulders stay pinned and the waist is gathered."""
    pin = gown.vertex_groups.new(name="pin")
    gather = gown.vertex_groups.new(name="gather")
    # Only the bound neck edge is fixed, like a real binding that does not stretch; everything else
    # hangs from the shoulders by collision.
    rim = neck_rim(gown, marks)
    if closure != "held":
        rim += sleeve_rims(gown, rig)
    wrap = gown.vertex_groups.new(name="wrap")
    for vertex in gown.data.vertices:
        co = gown.matrix_world @ vertex.co
        if any((co - r).length_squared < NECK_RIM_RADIUS**2 for r in rim):
            pin.add([vertex.index], 1.0, "REPLACE")
        if co.y > center.y and abs(co.x) < WRAP_WIDTH + 0.06:
            wrap.add([vertex.index], 1.0, "REPLACE")
        band = max(0.0, 1 - abs(co.z - marks["waist"]) / 0.05)
        if band > 0 and abs(co.x) < 0.26 and closure in ("tied", "wrapped"):
            gather.add([vertex.index], band, "REPLACE")

    for obj in colliders:
        modifier = obj.modifiers.new("collision", "COLLISION")
        modifier.settings.thickness_outer = 0.006
        modifier.settings.cloth_friction = 6

    cloth = gown.modifiers.new("cloth", "CLOTH")
    settings = cloth.settings
    settings.quality = 7
    settings.mass = 0.12
    settings.tension_stiffness = 14
    settings.compression_stiffness = 14
    settings.shear_stiffness = 6
    settings.bending_stiffness = 1.2
    settings.air_damping = 2
    settings.vertex_group_mass = "pin"
    settings.vertex_group_shrink = "gather"
    settings.shrink_min = 0.0
    settings.shrink_max = 0.05
    cloth.collision_settings.distance_min = 0.005
    cloth.collision_settings.collision_quality = 3
    # The wrap flap lies on the panel below it: without this they pierce each other at the waist.
    cloth.collision_settings.use_self_collision = closure == "wrapped"
    cloth.collision_settings.self_distance_min = 0.004
    # Only there: on the whole garment it wrinkles the fabric like crepe.
    cloth.collision_settings.vertex_group_self_collisions = "wrap"
    cloth.point_cache.frame_start = 1
    cloth.point_cache.frame_end = frames

    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, frames
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    if closure != "held":
        # The cloth buckles symmetrically on the midline between bust and belly; iron that band only.
        band = gown.vertex_groups.new(name="iron")
        for vertex in gown.data.vertices:
            co = gown.matrix_world @ vertex.co
            across = max(0.0, 1 - abs(co.x) / 0.1)
            along = max(0.0, 1 - abs(co.z - 1.13) / 0.2)
            if co.y < center.y and across > 0 and along > 0:
                band.add([vertex.index], min(1.0, 2 * across) * min(1.0, 2 * along), "REPLACE")
        iron = gown.modifiers.new("iron", "SMOOTH")
        iron.factor = 1.0
        iron.iterations = 60
        iron.vertex_group = "iron"
    relax = gown.modifiers.new("relax", "SMOOTH")
    relax.factor = 0.5
    relax.iterations = 8
    depsgraph.update()
    baked = bpy.data.meshes.new_from_object(gown.evaluated_get(depsgraph))
    gown.modifiers.clear()
    old = gown.data
    gown.data = baked
    prune_flying(gown, marks)
    cut_hem(gown, marks)
    baked.name = "gown"
    bpy.data.meshes.remove(old)
    for obj in colliders:
        obj.modifiers.remove(obj.modifiers["collision"])
    scene.frame_set(1)


def cut_hem(gown, marks):
    """Level hem at mid-calf, cut once the cloth has settled so it lands exactly there."""
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    cut(bm, (0, 0, marks["hem"]), (0, 0, -1))
    bm.to_mesh(gown.data)
    bm.free()


def prune_flying(gown, marks):
    """Drops anything the solver flung off the garment."""
    bm = bmesh.new()
    bm.from_mesh(baked_mesh := gown.data)
    flying = [
        v
        for v in bm.verts
        if not (marks["hem"] - HEM_ALLOWANCE - 0.1 < v.co.z < marks["neck"] + 0.2 and abs(v.co.x) < 0.75 and -1.3 < v.co.y < 0.6)
    ]
    print("PRUNED", len(flying))
    bmesh.ops.delete(bm, geom=flying, context="VERTS")
    bm.to_mesh(baked_mesh)
    bm.free()


def fabric_material(name, color, roughness=0.82, weave=1800):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = weave
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    links.new(noise.outputs[0], bump.inputs["Height"])
    links.new(bump.outputs[0], bsdf.inputs["Normal"])
    return material


def slice_ring(gown, z, band=0.012):
    """Outer radius of the draped gown per angle around the body axis at height z."""
    center = Vector((0, 0, 0))
    points = [v.co for v in gown.data.vertices if abs(v.co.z - z) < band and abs(v.co.x) < 0.2]
    center.y = sum(p.y for p in points) / len(points)
    radii = [0.0] * SECTORS
    for co in points:
        dx, dy = co.x - center.x, co.y - center.y
        sector = int((math.atan2(dy, dx) + math.pi) / (2 * math.pi) * SECTORS) % SECTORS
        radii[sector] = max(radii[sector], math.hypot(dx, dy))
    fallback = max(radii)
    return smooth_circular([r or fallback for r in radii], 8), center


def ribbon(name, points, material, width=0.009, thickness=0.0022, cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    spline.use_endpoint_u = not cyclic
    spline.order_u = 4 if len(points) >= 4 else len(points)
    curve.bevel_depth = thickness
    curve.bevel_resolution = 1
    curve.extrude = width
    curve.twist_mode = "Z_UP"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    curve.materials.append(material)
    return obj


def bow(prefix, origin, material, scale=1.0, facing=1):
    """Reef bow: two loops and two tails, standing off the cloth along +Y (facing=1) or -Y."""
    x, y, z = origin
    out = scale * facing
    objects = []
    for sign in (-1, 1):
        loop = [
            (x, y, z),
            (x + sign * 0.03 * scale, y + 0.012 * out, z + 0.022 * scale),
            (x + sign * 0.078 * scale, y + 0.017 * out, z + 0.024 * scale),
            (x + sign * 0.09 * scale, y + 0.016 * out, z - 0.004 * scale),
            (x + sign * 0.05 * scale, y + 0.012 * out, z - 0.018 * scale),
            (x, y + 0.002 * out, z),
        ]
        objects.append(ribbon(f"{prefix}-loop", loop, material, 0.0, 0.0034))
        tail = [
            (x, y + 0.004 * out, z),
            (x + sign * 0.022 * scale, y + 0.014 * out, z - 0.06 * scale),
            (x + sign * 0.03 * scale, y + 0.012 * out, z - 0.13 * scale),
            (x + sign * 0.05 * scale, y + 0.008 * out, z - 0.2 * scale),
        ]
        objects.append(ribbon(f"{prefix}-tail", tail, material, 0.0, 0.0034))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.014 * scale, location=(x, y + 0.006 * out, z), segments=10, ring_count=6)
    knot = bpy.context.object
    knot.name = f"{prefix}-knot"
    knot.scale = (1.1, 0.7, 0.85)
    knot.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    objects.append(knot)
    return objects


def add_cuff(rig, side, points, material, covered):
    """Knit cuff. With `covered` the hand is retracted inside (closed technique) and the end is capped."""
    wrist = bone_head(rig, f"wrist.{side}")
    start = bone_head(rig, f"lowerarm02.{side}")
    forward = (wrist - start).normalized()
    arm = [p[0] for p in points if p[1] and (p[0].x > 0) == (side == "L")]
    u = forward.orthogonal().normalized()
    v = forward.cross(u).normalized()
    reach = 0.035 if covered else 0.02
    rings = []
    count = 8
    for level in range(count):
        t = level / (count - 1)
        co = wrist - forward * (0.078 - (0.078 + reach) * t)
        # Measured on the forearm only: past the wrist the hand would flare the cuff open.
        probe = wrist - forward * max(0.03, 0.078 - 0.098 * t)
        near = [
            (p - probe) - forward * (p - probe).dot(forward)
            for p in arm
            if abs((p - probe).dot(forward)) < 0.01
        ]
        radius = min(max((n.length for n in near), default=0.035), 0.045) + 0.005
        rib = []
        for i in range(48):
            angle = 2 * math.pi * i / 48
            bump = 0.0012 * math.cos(angle * 12)
            rib.append(co + (u * math.cos(angle) + v * math.sin(angle)) * (radius + bump))
        rings.append(rib)
    obj = loft(f"cuff-{side}", rings, cap=covered)
    obj.data.materials.append(material)
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()
    return obj


def hanging_cuff(gown, side, material):
    """Cuff at the free end of a sleeve that hangs from the held gown, read from the cloth itself."""
    sign = 1 if side == "L" else -1
    ends = [e[0] for e in bmesh_boundary(gown) if e[0].x * sign > 0.14 and e[2] > 0.45]
    if not ends:
        return []
    low = min(p.z for p in ends)
    ring = [p for p in ends if p.z < low + 0.06]
    center = sum(ring, Vector()) / len(ring)
    above = [v.co for v in gown.data.vertices if 0.02 < (v.co - center).length < 0.09 and v.co.x * sign > 0.1]
    forward = (center - sum(above, Vector()) / len(above)).normalized() if above else Vector((0, 0, -1))
    u = forward.orthogonal().normalized()
    w = forward.cross(u).normalized()
    rings = []
    for level in range(6):
        co = center + forward * (0.078 * level / 5 - 0.008)
        rings.append(
            [
                co + (u * math.cos(2 * math.pi * i / 48) + w * math.sin(2 * math.pi * i / 48)) * (0.044 + 0.0012 * math.cos(2 * math.pi * i / 4))
                for i in range(48)
            ]
        )
    obj = loft(f"cuff-{side}", rings, cap=False)
    obj.data.materials.append(material)
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()
    return [obj]


def add_trims(gown, rig, marks, points, trim, closure, covered):
    objects = []
    if closure == "held":
        for side in ("L", "R"):
            objects += hanging_cuff(gown, side, trim)
    else:
        objects += [add_cuff(rig, side, points, trim, covered) for side in ("L", "R")]

    # Neck binding follows the real edge of the draped neckline.
    ring = neckline(gown, marks)
    neck_back = None
    if ring:
        step = max(1, len(ring) // 44)
        objects.append(ribbon("neck-binding", ring[::step], trim, width=0.0, thickness=0.0042))
        neck_back = max(ring, key=lambda co: co[1])

    bows = {}
    if closure in ("tied", "wrapped"):
        radii, center = slice_ring(gown, marks["waist"])
        belt = []
        for s in range(0, SECTORS, 2):
            angle = (s + 0.5) / SECTORS * 2 * math.pi - math.pi
            radius = radii[s] + 0.007
            belt.append((center.x + radius * math.cos(angle), center.y + radius * math.sin(angle), marks["waist"]))
        tape = fabric_material("woven-tie-tape", (0.24, 0.54, 0.54, 1), 0.94, 3200)
        objects.append(ribbon("tie-waist-belt", belt, tape, cyclic=True))
        # On the wrapped gown the flap lies over the back, so the bow must clear one more layer.
        stand_off = 0.024 if closure == "wrapped" else 0.006
        neck_origin = (0.0, neck_back[1] + stand_off, neck_back[2] - 0.014)
        objects += bow("tie-neck", neck_origin, tape, 0.5)
        bows["neck"] = Vector(neck_origin)
        if closure == "tied":
            back = center.y + radii[int(0.75 * SECTORS)] + 0.012
            origin = (0.02, back, marks["waist"])
            objects += bow("tie-waist", origin, tape)
            bows["waist"] = Vector(origin)
        else:
            front = center.y - radii[int(0.25 * SECTORS)] - 0.012
            objects += bow("tie-front", (0.0, front, marks["waist"]), tape, facing=-1)
            objects += wrap_edge(gown, center, marks, trim)
    return objects, bows


def wrap_edge(gown, center, marks, trim):
    """Binding along the flap's free edge makes the crossed closure legible from behind."""
    edges = bmesh_boundary(gown)
    edge = [
        tuple(e[0])
        for e in edges
        if e[0].x < -WRAP_WIDTH * 0.72 and e[0].y > center.y and marks["hem"] + 0.03 < e[2] < marks["shoulder"] + 0.02
    ]
    if len(edge) < 6:
        print("WRAP EDGE NOT FOUND", len(edge))
        return []
    edge.sort(key=lambda co: co[2])
    step = max(1, len(edge) // 28)
    return [ribbon("wrap-edge", edge[::step], trim, width=0.0035, thickness=0.002)]


def bmesh_boundary(gown):
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    result = []
    for edge in bm.edges:
        if edge.is_boundary:
            a, b = edge.verts
            result.append((a.co.copy(), b.co.copy(), (a.co.z + b.co.z) / 2))
    bm.free()
    return result


def neckline(gown, marks):
    """Neck-opening boundary points ordered around the neck, starting and ending at the back."""
    points = neck_rim(gown, marks)
    if not points:
        return []
    cx = sum(p.x for p in points) / len(points)
    cy = sum(p.y for p in points) / len(points)
    # atan2(x, y) is 0 at the back (+Y), so the open end of the ribbon hides under the bow.
    points.sort(key=lambda p: math.atan2(p.x - cx, p.y - cy) % (2 * math.pi))
    return [(p.x, p.y, p.z + 0.001) for p in points]


def surgical_cap(points, marks, material, trim):
    """Soft disposable cap: gathered dome, elastic edge from the brow to the nape."""
    head = [p[0] for p in points if p[0].z > marks["neck"] + 0.09]
    xs, ys, zs = [p.x for p in head], [p.y for p in head], [p.z for p in head]
    center = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2 + 0.006, max(zs) - 0.09))
    rx, ry = (max(xs) - min(xs)) / 2 + 0.009, (max(ys) - min(ys)) / 2 + 0.012
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=center)
    cap = bpy.context.object
    cap.name = "surgical-cap"
    cap.scale = (rx, ry, 0.104)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    edge_center = Vector((0, center.y, center.z - 0.012))
    normal = Vector((0, -0.62, -1)).normalized()
    cut(bm, edge_center - cap.location, normal)
    rim = []
    for vertex in bm.verts:
        world = vertex.co + cap.location
        vertex.co += vertex.normal * (
            0.0035 * math.sin(world.x * 95 + world.z * 34) * math.sin(world.y * 80 + world.z * 21)
        )
        if abs((world - edge_center).dot(normal)) < 1e-3:
            rim.append(world.copy())
    bm.to_mesh(cap.data)
    bm.free()
    cap.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    cx = sum(p.x for p in rim) / len(rim)
    cy = sum(p.y for p in rim) / len(rim)
    rim.sort(key=lambda p: math.atan2(p.y - cy, p.x - cx))
    band = ribbon("cap-elastic", [tuple(p) for p in rim[:: max(1, len(rim) // 40)]], trim, 0.003, 0.003, cyclic=True)
    return [cap, band]


def build_gown(human, rig, colliders, closure, covered=False, shell_points=None, offset_y=0.0, slim_sleeves=False):
    """closure: held (in front of the body), open (no ties), tied (back ties), wrapped (flap crossed)."""
    marks = landmarks(rig)
    points = evaluated_body(human)
    measured = shell_points or points
    torso, center = torso_shell(measured, marks)
    sleeves = [sleeve_shell(measured, rig, side, slim_sleeves) for side in ("L", "R")]
    gown = unify([torso, *sleeves])
    open_garment(gown, rig, marks, center, closure)
    if offset_y:
        gown["offset_y"] = offset_y
        for vertex in gown.data.vertices:
            vertex.co.y += offset_y
    simulate(gown, rig, colliders, marks, center, closure)
    fabric = fabric_material("gown-fabric", FABRIC)
    trim = fabric_material("gown-trim", TRIM, 0.9, 3200)
    gown.data.materials.append(fabric)
    gown.data.polygons.foreach_set("use_smooth", [True] * len(gown.data.polygons))
    gown.data.update()
    trims, bows = add_trims(gown, rig, marks, points, trim, closure, covered)
    return gown, trims, marks, bows


FABRIC_V2 = (0.030, 0.165, 0.255, 1)  # v2 only: deeper surgical blue, linear RGBA


def sleeve_shell_v2(rig, side, profile):
    """Loose sleeve covers wrist/palm and overlaps knit; world metres, Z up.

    Join/remesh uses the legacy pipeline. The last 4 cm gather onto the cuff
    ellipse, with the same radial frame and sewing plane as the knit.
    """
    from sleeve_seam_v2 import TAPER_LENGTH_M, taper_radius
    radius_at = taper_radius
    if profile.get('coverage_guard', False):
        from sleeve_guard_v2 import guarded_taper_radius
        radius_at = guarded_taper_radius
    shoulder = bone_head(rig, f'upperarm01.{side}')
    elbow = bone_head(rig, f'lowerarm01.{side}')
    wrist, axis = profile['wrist'], profile['axis']
    offset = profile['across']*profile['offset'][0] + profile['normal']*profile['offset'][1]
    root = shoulder + Vector((-0.07 if side == 'L' else 0.07, 0, -0.005))
    path = [root, shoulder, elbow, wrist - axis*0.06 + offset,
            wrist + offset, profile['rim']]
    sizes = [0.065, 0.065, 0.058, profile['palm_radius'], profile['palm_radius'], max(profile['seam_axes'])+0.0015]
    samples, radii = [], []
    for a, b, ra, rb in zip(path, path[1:], sizes, sizes[1:]):
        for i in range(18):
            t = i/18
            samples.append(a.lerp(b, t))
            radii.append(ra*(1-t) + rb*t)
    samples.append(path[-1])
    radii.append(sizes[-1])
    rings, u = [], None
    for i, center in enumerate(samples):
        direction = (samples[min(i+1, len(samples)-1)] - samples[max(0, i-1)]).normalized()
        u = direction.orthogonal().normalized() if u is None else (u-direction*u.dot(direction)).normalized()
        v = direction.cross(u).normalized()
        ring = []
        for j in range(48):
            a = 2*math.pi*j/48
            point = center+radii[i]*(u*math.cos(a)+v*math.sin(a))
            delta = point-wrist-offset
            z = delta.dot(axis)
            if z >= profile['sleeve_end']-TAPER_LENGTH_M:
                radial = delta-axis*z
                angle = math.atan2(radial.dot(profile['normal']), radial.dot(profile['across']))
                point = wrist+offset+axis*z+radial.normalized()*radius_at(z, angle, profile)
            ring.append(point)
        rings.append(ring)
    return loft(f'v2-sleeve-{side}', rings)


def sleeve_rig_v2(rig, profiles):
    """Read-only coordinate adapter for legacy sleeve cutting/pinning, metres.

    Legacy helpers put the rim 6 cm before their supplied wrist. Supply virtual
    wrist landmarks placing that rim at the new MCP-region seam. Real rig/bones
    and the legacy functions are untouched; neck landmarks remain unchanged.
    """
    from types import SimpleNamespace
    bones = {bone.name: bone for bone in rig.pose.bones}
    inverse = rig.matrix_world.inverted()
    for side, p in profiles.items():
        virtual_wrist = p['rim'] + p['axis']*SLEEVE_END
        bones[f'wrist.{side}'] = SimpleNamespace(head=inverse @ virtual_wrist)
        bones[f'lowerarm02.{side}'] = SimpleNamespace(head=inverse @ (virtual_wrist-p['axis']*0.2))
    return SimpleNamespace(matrix_world=rig.matrix_world, pose=SimpleNamespace(bones=bones))


def restore_sleeve_rims_v2(gown, profiles):
    """Seat the open cloth boundary on the shared seam plane, world metres.

    The knit root stays at least 1 cm upstream. Match its actual polygonal
    outer ellipse plus 1.5 mm, without flaring back to the palm radius.
    """
    from sleeve_seam_v2 import SEAM_ALLOWANCE_M, cuff_radius
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    inverse = gown.matrix_world.inverted()
    boundary = {v for edge in bm.edges if edge.is_boundary for v in edge.verts}
    for side, p in profiles.items():
        seam = [v for v in boundary if (gown.matrix_world @ v.co-p['rim']).length < 0.08]
        if len(seam) < 12:
            raise RuntimeError(f'{side}: missing sleeve boundary after legacy remesh/simulation')
        for vertex in seam:
            delta = gown.matrix_world @ vertex.co-p['rim']
            radial = delta-p['axis']*delta.dot(p['axis'])
            angle = math.atan2(radial.dot(p['normal']), radial.dot(p['across']))
            radius = cuff_radius(p, angle)+SEAM_ALLOWANCE_M
            vertex.co = inverse @ (p['rim']+radial.normalized()*radius)
        print('SLEEVE rim', side, 'vertices', len(seam), 'sewn ellipse semi-axes cm',
              tuple(round((r+SEAM_ALLOWANCE_M)*100, 3) for r in p['seam_axes']),
              'wrist-to-rim cm', round(p['sleeve_end']*100, 2), 'pinned at MCP seam')
    bm.to_mesh(gown.data)
    bm.free()
    gown.data.update()


def outward_normals_v2(obj, closed=False):
    """Weld, discard degenerate faces and orient normals outside, mesh metres."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00005)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=0.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    nonmanifold = sum(not e.is_manifold for e in bm.edges)
    print('GOWN topology', obj.name, 'nonmanifold edges', nonmanifold, 'closed', closed)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if closed and nonmanifold:
        raise RuntimeError('V2 union must be watertight before cutting garment openings')



def sleeve_folds_v2(gown, rig, profiles):
    """Local irregular compression and inner elbow folds; world metres.

    Compression occupies only the final 8 cm above the cuff. The middle of the
    forearm has no periodic displacement. Finished forearm radius >= 4.8 cm.
    """
    for side in ('L', 'R'):
        shoulder = bone_head(rig, f'upperarm01.{side}')
        wrist = bone_head(rig, f'wrist.{side}')
        elbow = bone_head(rig, f'lowerarm01.{side}')
        axis = (wrist - elbow).normalized()
        length = (wrist - elbow).length
        p = profiles[side]
        offset = p['across']*p['offset'][0] + p['normal']*p['offset'][1]
        u = axis.orthogonal().normalized()
        v = axis.cross(u).normalized()
        inner = (shoulder - elbow).normalized() + axis
        inner = (inner - axis * inner.dot(axis)).normalized()
        for vertex in gown.data.vertices:
            delta = vertex.co - wrist - offset
            along = delta.dot(axis)
            radial = delta - axis * along
            if not (-length - 0.055 < along < p['sleeve_end'] - 0.002 and 0.025 < radial.length < 0.09):
                continue
            angle = math.atan2(radial.dot(v), radial.dot(u))
            distance = p['sleeve_end'] - along
            displacement = 0.0
            if 0 < distance < 0.08:
                for center, width, amplitude, phase in ((0.014, 0.007, 0.0035, 0.4),
                                                       (0.039, 0.009, 0.0045, 2.1),
                                                       (0.065, 0.006, 0.0030, 4.0)):
                    shift = 0.004 * math.sin(angle + phase) + 0.0015 * math.sin(2 * angle - phase)
                    q = (distance - center - shift) / width
                    displacement += amplitude * (1 - 2*q*q) * math.exp(-q*q) * (0.85 + 0.15*math.sin(angle + phase))
                displacement *= math.sin(math.pi * distance / 0.08) ** 2
            inner_weight = max(0, (radial.normalized().dot(inner) - 0.15) / 0.85) ** 2
            for bend_offset in (-0.022, 0.004, 0.033):
                q = (along + length - bend_offset + 0.012*math.sin(angle)) / 0.010
                displacement += 0.0035 * inner_weight * (1 - 2*q*q) * math.exp(-q*q)
            radius = max(0.048, radial.length + displacement)
            vertex.co = wrist + offset + axis * along + radial.normalized() * radius
    gown.data.update()


def build_gown_v2(human, rig, colliders, profiles, closure='open'):
    """Configured unwrapped gown; world metres, Z up, figure faces -Y.

    Separate entry point deliberately leaves every legacy function unchanged.
    Cuffs are built by steps_v2 after the simulation, without capped ends.
    """
    from sleeve_clearance_v2 import enforce_hand_clearance, smooth_hand_sleeves
    marks = landmarks(rig)
    points = evaluated_body(human)
    torso, center = torso_shell(points, marks)
    gown = unify([torso, sleeve_shell_v2(rig, 'L', profiles['L']), sleeve_shell_v2(rig, 'R', profiles['R'])])
    gown.name = 'v2-gown'
    rim_rig = sleeve_rig_v2(rig, profiles)
    open_garment(gown, rim_rig, marks, center, closure)
    restore_sleeve_rims_v2(gown, profiles)  # pin the sewn ellipse before simulation
    if closure == 'tied':
        from back_closure_v2 import simulate_closed_back
        simulate_closed_back(gown, rim_rig, colliders, marks, center)
    else:
        simulate(gown, rim_rig, colliders, marks, center, closure)
    smooth_hand_sleeves(gown, profiles)
    enforce_hand_clearance(gown, profiles, 'post-smooth')
    sleeve_folds_v2(gown, rig, profiles)
    restore_sleeve_rims_v2(gown, profiles)
    enforce_hand_clearance(gown, profiles, 'post-folds')
    outward_normals_v2(gown)
    gown.data.materials.append(fabric_material('v2-gown-fabric', FABRIC_V2, 0.9))
    print('GOWN v2 colour linear RGB', FABRIC_V2[:3], 'roughness', 0.9)
    gown.data.polygons.foreach_set('use_smooth', [True] * len(gown.data.polygons))
    ring = neckline(gown, marks)
    if ring:
        ribbon('v2-neck-binding', ring[::max(1, len(ring) // 44)],
               fabric_material('v2-binding', TRIM), width=0, thickness=0.0042)
    return gown, marks
