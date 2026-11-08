"""Shared helpers for the Blender pipeline: human, pose, render. Units: metres, Z up, faces -Y."""
import math
import os
import addon_utils
import bpy
from mathutils import Matrix, Vector

addon_utils.enable("bl_ext.blender_org.mpfb")
from bl_ext.blender_org.mpfb.services.assetservice import AssetService  # noqa: E402
from bl_ext.blender_org.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.blender_org.mpfb.services.targetservice import TargetService  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, ".work", "out")
os.makedirs(OUT, exist_ok=True)

SKIN = "skins/callharvey3d_midtoned_female/callharvey3d_midtoned_female.mhmat"
ASSETS = [
    "joepal_medical_mouth_protection",
    "toigo_flats",
    "toigo_wool_pants",
    "joepal_crude_t-shirt_female",
]
GLOVES = "toigo_gloves_short"
SCRUBS = (0.018, 0.05, 0.085, 1)
LATEX = (0.6, 0.43, 0.26, 1)  # surgical latex, linear RGB


BODY_PARTS = [
    ("eyes", "low-poly/low-poly.mhclo"),
    ("eyebrows", "eyebrow006/eyebrow006.mhclo"),
    ("eyelashes", "eyelashes01/eyelashes01.mhclo"),
]


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj)


def asset_path(name):
    path = AssetService.find_asset_absolute_path(f"{name}/{name}.mhclo", "clothes")
    if not path:
        raise RuntimeError(f"Missing asset {name}")
    return path


def build_human(gloves=False):
    macro = TargetService.get_default_macro_info_dict()
    macro.update(gender=0.15, age=0.55, muscle=0.5, weight=0.5, height=0.55)
    macro["race"] = {"asian": 0.15, "caucasian": 0.55, "african": 0.3}
    human = HumanService.create_human(macro_detail_dict=macro)
    HumanService.add_builtin_rig(human, "default")
    rig = human.parent
    skin = AssetService.find_asset_absolute_path(SKIN.split("/", 1)[1], "skins")
    HumanService.set_character_skin(skin, human, skin_type="MAKESKIN")
    for kind, rel in BODY_PARTS:
        path = AssetService.find_asset_absolute_path(rel, kind)
        if not path:
            raise RuntimeError(f"Missing {kind}: {rel}")
        HumanService.add_mhclo_asset(path, human, asset_type=kind, material_type="MAKESKIN")
    clothes = {}
    for name in ASSETS + ([GLOVES] if gloves else []):
        clothes[name] = HumanService.add_mhclo_asset(
            asset_path(name), human, asset_type="Clothes", material_type="MAKESKIN"
        )
    recolor(clothes["toigo_wool_pants"], SCRUBS, 0.85)
    recolor(clothes["joepal_crude_t-shirt_female"], SCRUBS, 0.85)
    if gloves:
        recolor(clothes[GLOVES], LATEX, 0.38)
    recolor(clothes["toigo_flats"], (0.72, 0.74, 0.74, 1), 0.45)
    return human, rig, clothes


def recolor(obj, color, roughness):
    """Replaces a stock clothing texture with a flat colour (scrubs and OR shoes)."""
    material = bpy.data.materials.new(f"{obj.name}-flat")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    obj.data.materials.clear()
    obj.data.materials.append(material)


def rotate_bone(rig, bone_name, axis, degrees):
    """Rotates a pose bone around an armature-space axis through its head."""
    bone = rig.pose.bones[bone_name]
    head = bone.head.copy()
    rot = Matrix.Rotation(math.radians(degrees), 4, Vector(axis))
    bone.matrix = Matrix.Translation(head) @ rot @ Matrix.Translation(-head) @ bone.matrix
    bpy.context.view_layer.update()


def pose_relaxed(rig):
    """Standing, arms lowered close to the body with a soft elbow."""
    for side, sign in (("L", 1), ("R", -1)):
        rotate_bone(rig, f"upperarm01.{side}", (0, 1, 0), sign * 21)
        rotate_bone(rig, f"lowerarm01.{side}", (1, 0, 0), 14)


def setup_render(samples=96, res=(720, 1080)):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    # `compute_device_type` only accepts the backends this build supports for the current OS
    # (METAL is macOS only, HIP and ONEAPI on Windows/Linux), and its enum is populated at
    # runtime, so it cannot be introspected up front. Scan once with a neutral backend, then
    # pick the fastest backend that actually reported a device and fall back to CPU otherwise.
    prefs.compute_device_type = "NONE"
    prefs.get_devices()
    available = {device.type for device in prefs.devices}
    backend = next(
        (name for name in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI") if name in available),
        "NONE",
    )
    prefs.compute_device_type = backend
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True
    scene.cycles.device = "GPU" if backend != "NONE" and prefs.devices else "CPU"
    print("RENDER backend", backend, "device", scene.cycles.device)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.8, 0.81, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.3
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=30)
    floor = bpy.context.object
    floor.name = "floor"
    mat = bpy.data.materials.new("floor")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.45, 0.46, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.7
    floor.data.materials.append(mat)
    floor.is_shadow_catcher = True
    for name, energy, loc, size in (
        ("key", 430, (2.2, -3.2, 3.2), 2.5),
        ("fill", 90, (-3.0, -2.2, 2.0), 3.5),
        ("rim", 240, (0.6, 3.5, 3.0), 2.5),
    ):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size = energy, size
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(obj)


def render_views(prefix, views, target=(0, 0, 0.88), distance=4.4, lens=70):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = lens
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    paths = []
    for name, azimuth in views:
        a = math.radians(azimuth)
        loc = Vector((distance * math.sin(a), -distance * math.cos(a), target[2] + 0.12))
        cam.location = loc
        cam.rotation_euler = (Vector(target) - loc).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(OUT, f"{prefix}-{name}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths
