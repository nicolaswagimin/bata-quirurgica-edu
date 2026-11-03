"""Pixel-art teaching videos from the approved step models (apps/web/public/models/paso-N.glb).

Every frame is rendered small (320x180, EEVEE), snapped to the app palette (tokens of
apps/web/src/styles.css plus shades mixed from them), outlined in ink and scaled x4 with no
smoothing. Between steps the approved 3D crossfade becomes an ordered (Bayer) dissolve. Captions
are WebVTT built from content/protocolos/bata-pasos.json, never burned into the image.

Run (from tools/bata-3d):
  blender --background --factory-startup --python render_videos.py -- --preview
      one sample frame per video -> .work/out/video-preview/
  blender --background --factory-startup --python render_videos.py -- --all
      every frame, MP4 (H.264) + WebM (VP9) + poster + VTT -> apps/web/public/videos/
"""
import json
import math
import os
import re
import shutil
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MODELS = os.path.join(ROOT, "apps", "web", "public", "models")
VIDEOS = os.path.join(ROOT, "apps", "web", "public", "videos")
WORK = os.path.join(HERE, ".work", "video")
PREVIEW = os.path.join(HERE, ".work", "out", "video-preview")

LOW_W, LOW_H, SCALE, FPS = 320, 180, 4, 12
DISSOLVE_S, ORBIT_S, CLOSE_S = 3, 9, 8  # per step: 20 s
ZONE_S = 18
WAIST_Z, CHEST_Z = 0.96, 1.33

# Where each step's close-up looks: target (x, y, z), azimuth in degrees (0 = front), distance.
CLOSE_UPS = {
    1: ((0, -0.2, 1.18), 10, 1.15),
    2: ((0, -0.25, 1.32), 15, 1.25),
    3: ((0, -0.3, 1.22), 40, 1.3),
    4: ((0, 0.05, 1.18), 180, 1.35),
    5: ((0, -0.3, 1.12), 20, 1.05),
    6: ((0, -0.15, 1.0), 35, 1.3),
}

BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16


# ---------- palette ----------


def hex_rgb(h):
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255


def palette():
    css = open(os.path.join(ROOT, "apps", "web", "src", "styles.css"), encoding="utf8").read()
    tok = {m[0]: hex_rgb(m[1]) for m in re.findall(r"--color-([a-z-]+):\s*(#[0-9a-f]{6})", css)}
    ink, white = tok["ink"], np.ones(3, dtype=np.float32)
    mix = lambda a, b, t: a * (1 - t) + b * t  # noqa: E731
    base = [tok[k] for k in (
        "ink", "bg", "band", "tile", "primary", "primary-strong", "primary-soft", "gown", "gown-trim",
        "mask", "mask-shade", "glove", "glove-shade", "px-skin", "px-skin-shade", "px-hair", "xp",
        "seal", "px-bronze", "danger", "muted", "border", "surface", "circulante-glove",
        "circulante-cuff",
    )]
    shades = [
        mix(tok["gown"], ink, 0.45), mix(tok["gown"], white, 0.22), mix(tok["gown-trim"], ink, 0.4),
        mix(tok["px-skin-shade"], ink, 0.35), mix(tok["px-skin"], white, 0.2),
        mix(tok["glove"], white, 0.2), mix(tok["mask"], white, 0.3), mix(tok["muted"], ink, 0.5),
        mix(tok["band"], ink, 0.25), mix(tok["danger"], white, 0.35),
    ]
    return tok, np.stack(base + shades)


TOK, PALETTE = palette()


# ---------- scene ----------


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    # Rendered at 2x and averaged down: kills texture noise before the palette snap.
    scene.render.resolution_x, scene.render.resolution_y = LOW_W * 2, LOW_H * 2
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("flat")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    scene.world = world
    for name, energy, rot in (("key", 3.2, (50, 0, 35)), ("fill", 1.2, (60, 0, -60)), ("back", 1.6, (60, 0, 170))):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = [math.radians(a) for a in rot]
        scene.collection.objects.link(obj)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def load_model(step):
    """Imports paso-N.glb into its own collection; returns the collection."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f"paso-{step}.glb"))
    coll = bpy.data.collections.new(f"paso-{step}")
    bpy.context.scene.collection.children.link(coll)
    for obj in set(bpy.data.objects) - before:
        for c in obj.users_collection:
            c.objects.unlink(obj)
        coll.objects.link(obj)
    return coll


def show_only(colls, visible):
    for c in colls.values():
        c.hide_render = c is not visible


def aim(cam, target, azimuth, distance, height=0.0):
    a = math.radians(azimuth)
    t = Vector(target)
    loc = t + Vector((distance * math.sin(a), -distance * math.cos(a), height))
    cam.location = loc
    cam.rotation_euler = (t - loc).to_track_quat("-Z", "Y").to_euler()


def full_shot(cam, t):
    """Slow orbit from -30 to +30 degrees around the standing figure."""
    aim(cam, (0, 0, 0.86), -30 + 60 * t, 4.3, 0.15)


def close_shot(cam, step, t):
    target, azimuth, distance = CLOSE_UPS[step]
    aim(cam, target, azimuth - 12 + 24 * t, distance, 0.05)


def highlight_zones(coll):
    """Sterile front (chest to waist) and forward sleeves in mint; the back in red. Didactic approximation."""
    mint = bpy.data.materials.new("zone-sterile")
    red = bpy.data.materials.new("zone-back")
    for mat, key in ((mint, "band"), (red, "danger")):
        mat.use_nodes = True
        mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*srgb_to_linear(TOK[key]), 1)
    for obj in coll.objects:
        if obj.type != "MESH" or not obj.name.startswith("gown"):
            continue
        mesh = obj.data
        mesh.materials.append(mint)
        mesh.materials.append(red)
        n = len(mesh.materials)
        world = obj.matrix_world
        normal_matrix = world.to_3x3().inverted().transposed()
        for poly in mesh.polygons:
            c = world @ poly.center
            normal = (normal_matrix @ poly.normal).normalized()
            upper_arm = abs(c.x) > 0.16 and c.y > -0.13  # above the elbow: not sterile
            if WAIST_Z <= c.z <= CHEST_Z and not upper_arm and (normal.y < -0.35 or c.y < -0.17):
                poly.material_index = n - 2
            elif normal.y > 0.35 and c.z > 0.5:
                poly.material_index = n - 1


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return tuple(np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4))


# ---------- frames ----------


def render_raw(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = "Non-Color"
    px = np.empty(LOW_W * LOW_H * 16, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    big = px.reshape(LOW_H * 2, LOW_W * 2, 4)[::-1]  # top row first
    return big.reshape(LOW_H, 2, LOW_W, 2, 4).mean(axis=(1, 3))


def background():
    bg = np.empty((LOW_H, LOW_W, 3), dtype=np.float32)
    bg[:] = TOK["primary-soft"]
    bg[::16, :] = TOK["tile"]
    bg[:, ::16] = TOK["tile"]
    bg[LOW_H - 22 :, :] = TOK["tile"]  # floor band
    return bg


BG = background()


def pixelate(raw):
    """Snap to the palette, outline the silhouette in ink, composite on the mint tile wall."""
    rgb, alpha = raw[..., :3], raw[..., 3] > 0.5
    flat = rgb.reshape(-1, 3)
    weights = np.array([0.3, 0.59, 0.11], dtype=np.float32)
    d = (((flat[:, None, :] - PALETTE[None, :, :]) ** 2) * weights).sum(-1)
    snapped = PALETTE[d.argmin(1)].reshape(rgb.shape)
    out = np.where(alpha[..., None], snapped, BG)
    edge = np.zeros_like(alpha)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        edge |= alpha & ~np.roll(np.roll(alpha, dy, 0), dx, 1)
    out[edge] = TOK["ink"]
    return out, alpha


def dissolve(a, b, t):
    """Ordered dither from frame a to frame b (t 0 -> 1)."""
    mask = np.tile(BAYER, (LOW_H // 4, LOW_W // 4)) < t
    return np.where(mask[..., None], b, a)


def save(rgb, path):
    big = np.repeat(np.repeat(rgb, SCALE, 0), SCALE, 1)
    h, w = big.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.concatenate([big[::-1], np.ones((h, w, 1), dtype=np.float32)], -1)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


# ---------- videos ----------


def step_frames(step, colls, cam, frame_dir, only=None):
    """Frames of one step clip: dissolve from the previous pose, orbit, close-up. Returns count."""
    total = (DISSOLVE_S + ORBIT_S + CLOSE_S) * FPS
    raw = os.path.join(WORK, "raw.png")
    for i in range(total):
        if only is not None and i != only:
            continue
        if only is None and os.path.exists(os.path.join(frame_dir, f"{i:04d}.png")):
            continue
        t_sec = i / FPS
        if t_sec < DISSOLVE_S + ORBIT_S:
            full_shot(cam, i / ((DISSOLVE_S + ORBIT_S) * FPS))
        else:
            close_shot(cam, step, (i - (DISSOLVE_S + ORBIT_S) * FPS) / (CLOSE_S * FPS))
        show_only(colls, colls[step])
        frame, _ = pixelate(render_raw(raw))
        if t_sec < DISSOLVE_S:
            if step > 1:
                show_only(colls, colls[step - 1])
                prev, _ = pixelate(render_raw(raw))
            else:
                prev = BG
            frame = dissolve(prev, frame, t_sec / DISSOLVE_S)
        save(frame, os.path.join(frame_dir, f"{i:04d}.png"))
    return total


def zone_frames(colls, cam, frame_dir, only=None):
    """Gowned figure: plain, then sterile zones in mint while turning to show the red back."""
    total = ZONE_S * FPS
    raw = os.path.join(WORK, "raw.png")
    plain, zones = colls[6], colls["zonas"]
    for i in range(total):
        if only is not None and i != only:
            continue
        if only is None and os.path.exists(os.path.join(frame_dir, f"{i:04d}.png")):
            continue
        t = i / total
        aim(cam, (0, 0, 0.98), -20 + 200 * max(0.0, (t - 0.35) / 0.65), 3.6, 0.12)
        show_only(colls, plain)
        a, _ = pixelate(render_raw(raw))
        if t < 0.15:
            frame = a
        else:
            show_only(colls, zones)
            b, _ = pixelate(render_raw(raw))
            frame = dissolve(a, b, min(1.0, (t - 0.15) / 0.12))
        save(frame, os.path.join(frame_dir, f"{i:04d}.png"))
    return total


def encode(frame_dir, count, out_base, crf):
    scene = bpy.data.scenes.new("encode")
    scene.render.resolution_x, scene.render.resolution_y = LOW_W * SCALE, LOW_H * SCALE
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, count
    scene.view_settings.view_transform = "Standard"
    seq = scene.sequence_editor_create()
    files = [{"name": f"{i:04d}.png"} for i in range(count)]
    strips = seq.strips if hasattr(seq, "strips") else seq.sequences
    strip = strips.new_image("frames", os.path.join(frame_dir, files[0]["name"]), 1, 1)
    for f in files[1:]:
        strip.elements.append(f["name"])
    strip.colorspace_settings.name = "sRGB"
    for fmt, codec, ext in (("MPEG4", "H264", "mp4"), ("WEBM", "WEBM", "webm")):
        scene.render.image_settings.media_type = "VIDEO"
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = fmt
        scene.render.ffmpeg.codec = codec
        scene.render.ffmpeg.constant_rate_factor = crf  # enum in Blender 5: MEDIUM, LOW, ...
        scene.render.ffmpeg.ffmpeg_preset = "BEST"
        scene.render.ffmpeg.gopsize = FPS * 2
        scene.render.ffmpeg.audio_codec = "NONE"
        scene.render.filepath = f"{out_base}.{ext}"
        render_animation(scene)
    shutil.copyfile(os.path.join(frame_dir, f"{min(count - 1, FPS * (DISSOLVE_S + 2)):04d}.png"), f"{out_base}-portada.png")


def render_animation(scene):
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(animation=True, scene=scene.name)


# ---------- captions ----------


def vtt_time(s):
    return f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{s % 60:06.3f}"


def vtt(cues):
    lines = ["WEBVTT", ""]
    for n, (start, end, text) in enumerate(cues, 1):
        lines += [str(n), f"{vtt_time(start)} --> {vtt_time(end)}", text, ""]
    return "\n".join(lines)


def step_cues(step, hotspots, offset=0.0, short=False):
    first, second = DISSOLVE_S, DISSOLVE_S + ORBIT_S
    cues = [
        (offset, offset + first, f"Paso {step['order']}: {step['title']}"),
        (offset + first, offset + second, step["description"]),
    ]
    if not short:
        notes = [hotspots[h]["description"] for h in step["hotspotIds"] if h in hotspots]
        note = notes[0] if notes else step["description"]
        cues.append((offset + second, offset + second + CLOSE_S, note))
    return cues


def zone_cues(hotspots, offset=0.0):
    third = ZONE_S / 3
    return [
        (offset, offset + third, "Zona estéril de la bata puesta"),
        (offset + third, offset + 2 * third, f"{hotspots['zona-esteril']['description']} {hotspots['mangas']['description']}"),
        (offset + 2 * third, offset + ZONE_S, hotspots["cierre-posterior"]["description"]),
    ]


# ---------- main ----------


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    preview = "--preview" in args
    pasos = json.load(open(os.path.join(ROOT, "content", "protocolos", "bata-pasos.json"), encoding="utf8"))
    steps = sorted(pasos["donning"], key=lambda s: s["order"])
    hotspots = {h["id"]: h for h in pasos["hotspots"]}
    os.makedirs(WORK, exist_ok=True)
    scene, cam = reset()
    colls = {n: load_model(n) for n in range(1, 7)}
    colls["zonas"] = load_model(6)
    highlight_zones(colls["zonas"])
    out_dir = PREVIEW if preview else VIDEOS
    os.makedirs(out_dir, exist_ok=True)

    summary_cues, summary_frames = [], []
    for step in steps:
        n = step["order"]
        name = f"paso-{n}"
        frame_dir = os.path.join(WORK, name)
        os.makedirs(frame_dir, exist_ok=True)
        if preview:
            picks = {"entero": (DISSOLVE_S + ORBIT_S // 2) * FPS, "detalle": (DISSOLVE_S + ORBIT_S) * FPS + CLOSE_S * FPS // 2}
            for label, pick in picks.items():
                step_frames(n, colls, cam, frame_dir, only=pick)
                shutil.copyfile(os.path.join(frame_dir, f"{pick:04d}.png"), os.path.join(out_dir, f"{name}-{label}.png"))
            continue
        count = step_frames(n, colls, cam, frame_dir)
        encode(frame_dir, count, os.path.join(out_dir, name), crf="MEDIUM")
        open(os.path.join(out_dir, f"{name}.vtt"), "w", encoding="utf8").write(vtt(step_cues(step, hotspots)))
        offset = len(summary_frames) / FPS
        summary_frames += [os.path.join(frame_dir, f"{i:04d}.png") for i in range((DISSOLVE_S + ORBIT_S) * FPS)]
        summary_cues += step_cues(step, hotspots, offset, short=True)

    zone_dir = os.path.join(WORK, "zona-esteril")
    os.makedirs(zone_dir, exist_ok=True)
    if preview:
        pick = int(ZONE_S * FPS * 0.32)
        zone_frames(colls, cam, zone_dir, only=pick)
        shutil.copyfile(os.path.join(zone_dir, f"{pick:04d}.png"), os.path.join(out_dir, "zona-esteril.png"))
        print("PREVIEW DONE", out_dir)
        return
    count = zone_frames(colls, cam, zone_dir)
    encode(zone_dir, count, os.path.join(out_dir, "zona-esteril"), crf="MEDIUM")
    open(os.path.join(out_dir, "zona-esteril.vtt"), "w", encoding="utf8").write(vtt(zone_cues(hotspots)))

    offset = len(summary_frames) / FPS
    summary_frames += [os.path.join(zone_dir, f"{i:04d}.png") for i in range(count)]
    summary_cues += zone_cues(hotspots, offset)
    summary_dir = os.path.join(WORK, "resumen")
    shutil.rmtree(summary_dir, ignore_errors=True)
    os.makedirs(summary_dir)
    for i, src in enumerate(summary_frames):
        shutil.copyfile(src, os.path.join(summary_dir, f"{i:04d}.png"))
    encode(summary_dir, len(summary_frames), os.path.join(out_dir, "resumen"), crf="LOW")
    open(os.path.join(out_dir, "resumen.vtt"), "w", encoding="utf8").write(vtt(summary_cues))
    print("ALL DONE", out_dir)


main()
