"""Builds one donning step and renders its previews.
Run: source env.sh && blender --background --python build_step.py -- <step>"""
import math
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh
import bpy
from mathutils import Vector
from common import SCRUBS, build_human, clear_scene, pose_relaxed, render_views, setup_render
from gown import FABRIC, TRIM, bone_head, build_gown, evaluated_body, fabric_material, landmarks, loft, surgical_cap
from poses import place_hand, pose_step

MAX_TRIANGLES = 80_000
GOWN_TRIANGLES = 26_000
SHOES_RATIO = 0.015
HAND_BONES = ("wrist", "finger", "metacarpal")
CUTOUT = re.compile("eyebrow|eyelash|mouth_protection", re.IGNORECASE)
AR_STEP = 6  # the fully gowned figure is the one placed in the room
MAX_TEXTURE = 1024
MAX_GLB_BYTES = 3 * 1024 * 1024
MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "apps", "web", "public", "models")
CLOSURE = {2: "held", 3: "open", 4: "tied", 5: "tied", 6: "wrapped"}


def freeze(objects):
    """Bakes posed meshes into static copies; originals stop rendering."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    frozen = {}
    for obj in objects:
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        copy = bpy.data.objects.new(f"{obj.name}-static", mesh)
        copy.matrix_world = obj.matrix_world
        bpy.context.scene.collection.objects.link(copy)
        frozen[obj.name] = copy
        obj.hide_render = True
    return frozen


def character_meshes(rig):
    return [o for o in bpy.data.objects if o.type == "MESH" and is_descendant(o, rig)]


def is_descendant(obj, ancestor):
    while obj.parent:
        if obj.parent == ancestor:
            return True
        obj = obj.parent
    return False


def delete_by_weight(human, static, prefixes, keep=False, threshold=0.5):
    """Deletes (or keeps only) vertices driven by the given bones on a static copy of the body."""
    groups = {g.index: g.name for g in human.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(static.data)
    layer = bm.verts.layers.deform.verify()
    doomed = []
    for vertex in bm.verts:
        weight = sum(w for g, w in vertex[layer].items() if groups.get(g, "").startswith(prefixes))
        if (weight > threshold) != keep:
            doomed.append(vertex)
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(static.data)
    bm.free()


def whole_body_copy(human):
    masks = [m for m in human.modifiers if m.type == "MASK" and m.name != "Hide helpers"]
    for modifier in masks:
        modifier.show_viewport = False
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(human.evaluated_get(depsgraph))
    for modifier in masks:
        modifier.show_viewport = True
    bpy.context.view_layer.update()
    collider = bpy.data.objects.new("collider-body", mesh)
    collider.matrix_world = human.matrix_world
    bpy.context.scene.collection.objects.link(collider)
    collider.hide_render = True
    return collider


def remove_shirt_front(shirt):
    bm = bmesh.new()
    bm.from_mesh(shirt.data)
    doomed = [v for v in bm.verts if v.co.y < -0.02 and v.co.z < 1.28]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(shirt.data)
    bm.free()


def decimate(obj, ratio):
    modifier = obj.modifiers.new("decimate", "DECIMATE")
    modifier.ratio = ratio
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def triangles(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    count = len(mesh.loop_triangles)
    evaluated.to_mesh_clear()
    return count


def visible_objects():
    return [
        o
        for o in bpy.data.objects
        if o.type in {"MESH", "CURVE"} and not o.hide_render and o.name != "floor"
    ]


def circulator_hands(human, rig, bows):
    """Circulating nurse's hands only, tying the back knots: same body, re-posed behind, kept hands."""
    behind = Vector((0, 0.6, 0))
    rig.location = behind
    bpy.context.view_layer.update()
    for side, knot in (("L", bows["neck"]), ("R", bows["waist"])):
        wrist = knot - behind + Vector((0.03 if side == "L" else -0.03, 0.16, 0.012))
        pole = (1 if side == "L" else -1, 0.2, -1)
        place_hand(rig, side, wrist, pole, (0, -1, 0), (0, 0, 1), 0.45)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(human.evaluated_get(depsgraph))
    hands = bpy.data.objects.new("circulator-hands", mesh)
    hands.matrix_world = human.matrix_world
    bpy.context.scene.collection.objects.link(hands)
    delete_by_weight(human, hands, HAND_BONES, keep=True, threshold=0.4)
    material = fabric_material("circulator-cuff", SCRUBS, 0.9, 3200)
    for side in ("L", "R"):
        wrist = bone_head(rig, f"wrist.{side}")
        direction = (bone_head(rig, f"lowerarm02.{side}") - wrist).normalized()
        u = direction.orthogonal().normalized()
        v = direction.cross(u).normalized()
        rings = []
        for t, radius in ((-0.005, 0.0335), (0.012, 0.0345), (0.03, 0.0355), (0.042, 0.036)):
            center = wrist + direction * t
            rings.append(
                [
                    center + (u * math.cos(a) + v * math.sin(a)) * (radius + 0.0009 * math.cos(a * 10))
                    for a in (2 * math.pi * i / 30 for i in range(30))
                ]
            )
        cuff = loft(f"circulator-cuff-{side}", rings, cap=True)
        cuff.data.materials.append(material)
        cuff.data.polygons.foreach_set("use_smooth", [True] * len(cuff.data.polygons))
    rig.location = (0, 0, 0)
    return hands


def opaque_materials():
    """MPFB wires every texture's alpha, so the exporter marks the skin and lips as blended and viewers
    sort them wrongly (lips over the mask). Only lashes, brows and the mask's ear loops keep alpha."""
    for material in bpy.data.materials:
        if not material.use_nodes or CUTOUT.search(material.name):
            continue
        tree = material.node_tree
        for link in list(tree.links):
            if link.to_socket.name == "Alpha" and link.to_node.type == "BSDF_PRINCIPLED":
                tree.links.remove(link)
        for node in tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                node.inputs["Alpha"].default_value = 1.0


def export_glb(step, ar=False):
    """Static, Draco-compressed GLB: textures at most 1024 px in WebP, nothing hidden included.
    `ar` writes the variant for "Ver en tu espacio": JPEG/PNG textures, which every AR viewer reads."""
    objects = visible_objects()
    opaque_materials()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    for image in bpy.data.images:
        width, height = image.size
        if max(width, height) > MAX_TEXTURE:
            factor = MAX_TEXTURE / max(width, height)
            image.scale(int(width * factor), int(height * factor))
    path = os.path.join(MODELS, f"paso-{step}-ar.glb" if ar else f"paso-{step}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_apply=True,
        export_image_format="AUTO" if ar else "WEBP",
        export_image_quality=90,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    size = os.path.getsize(path)
    print("GLB", path, round(size / 1024 / 1024, 2), "MB")
    if size > MAX_GLB_BYTES:
        print("GLB OVER BUDGET", size)


def main():
    step = int(sys.argv[sys.argv.index("--") + 1])
    started = time.time()
    clear_scene()
    gloved = step >= 5
    human, rig, clothes = build_human(gloves=gloved)
    shell_points = None
    if step == 2:
        pose_relaxed(rig)
        bpy.context.view_layer.update()
        shell_points = evaluated_body(human)
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
        bpy.context.view_layer.update()
    pose_step(rig, step)
    bpy.context.view_layer.update()
    marks = landmarks(rig)

    # Collide against the whole body: the visible copy has no torso where clothing hides it.
    collider = whole_body_copy(human)
    frozen = freeze([o for o in character_meshes(rig) if o != collider])
    body = frozen[human.name]
    shirt = frozen[clothes["joepal_crude_t-shirt_female"].name]
    colliders = [collider, frozen[clothes["toigo_wool_pants"].name]]
    if step >= 3:
        # The stock shirt has a front knot; hidden under the gown, it would only crease the cloth.
        remove_shirt_front(shirt)
    else:
        colliders.append(shirt)
    decimate(frozen[clothes["toigo_flats"].name], SHOES_RATIO)

    hand_points = [
        body.matrix_world @ v.co
        for v in body.data.vertices
        if any(body.vertex_groups[g.group].name.startswith(HAND_BONES) and g.weight > 0.5 for g in v.groups)
    ]
    print("HANDS lowest", round(min(p.z for p in hand_points), 3), "waist", round(marks["waist"], 3),
          "wrists", [tuple(round(x, 3) for x in bone_head(rig, f"wrist.{s}")) for s in "LR"])
    if step > 1 and min(p.z for p in hand_points) <= marks["waist"]:
        print("PROTOCOL VIOLATION: hands below the waist")

    covered = step in (3, 4)
    if covered:
        delete_by_weight(human, body, HAND_BONES)

    cap_trim = fabric_material("cap-trim", TRIM, 0.9, 3200)
    cap_fabric = fabric_material("cap-fabric", (0.105, 0.32, 0.35, 1))
    points = evaluated_body(human)
    surgical_cap(points, marks, cap_fabric, cap_trim)

    bows = {}
    if step in CLOSURE:
        gown, trims, marks, bows = build_gown(
            human, rig, colliders, CLOSURE[step], covered=covered,
            shell_points=shell_points, offset_y=-0.42 if step == 2 else 0.0, slim_sleeves=gloved,
        )
        print("GOWN sim verts", len(gown.data.vertices))
        count = triangles(gown)
        if count > GOWN_TRIANGLES:
            decimate(gown, GOWN_TRIANGLES / count)
    if step == 4:
        circulator_hands(human, rig, bows)

    counts = {o.name: triangles(o) for o in visible_objects()}
    total = sum(counts.values())
    print("TRIANGLES", total, dict(sorted(counts.items(), key=lambda kv: -kv[1])[:7]))
    if total > MAX_TRIANGLES:
        print("OVER BUDGET", total)
    print("TIME build", round(time.time() - started))
    if "export" in sys.argv:
        export_glb(step)
        if step == AR_STEP:
            export_glb(step, ar=True)
    setup_render(samples=64, res=(620, 930))
    views = [("front", 0), ("three", 35), ("back3", 150)]
    if step in (2, 4, 6):
        views.append(("side", 90))
    print("PATHS", render_views(f"paso{step}", views))
    print("TIME total", round(time.time() - started))


main()
