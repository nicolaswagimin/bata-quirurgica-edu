"""V2 entry: blender --background --python build_v2.py -- <step> [export].

Metres, Z up, figure faces -Y. Writes only tools/bata-3d/.work/out.
No Blender work is performed on import.
"""
import ast
import math
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import bmesh
import bpy
from mathutils import Vector
from common import build_human, clear_scene, render_views, setup_render
from gown import (TRIM, bone_head, build_gown_v2, evaluated_body, fabric_material,
                  landmarks, surgical_cap, outward_normals_v2, restore_sleeve_rims_v2)
from steps_v2 import check_layout, config_for, pose_step_v2
from cuffs_v2 import assert_hand_coverage, build_cuffs, cuff_layouts
from sleeve_clearance_v2 import enforce_hand_clearance, prepare_clearance
from sleeve_seam_v2 import assert_seam_gap, choose_seams
from extras_v2 import build_extras, finalize_extra_geometry, validate_extras
from budget_v2 import fit_extra_budget
from detail_v2 import reduce_cap_elastic
from sleeve_guard_v2 import finalize_coverage, prepare_guard
from seam_boundary_v2 import restore_owned_rims
from gloving_gown_v2 import build_gloving_gown, island_normals

OUT = HERE / '.work' / 'out'
MODELS = OUT / 'v2'


def legacy_helpers():
    """Load frozen helper definitions without its unconditional main(), as AR does.

    Override only the isolated namespace's output directory, never source files.
    Export options and static mesh helpers therefore match the legacy pipeline.
    """
    path = HERE / 'build_step.py'
    tree = ast.parse(path.read_text())
    tree.body = [node for node in tree.body if not (
        isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name) and node.value.func.id == 'main')]
    namespace = {'__file__': str(path), '__name__': '_v2_legacy_helpers'}
    exec(compile(tree, str(path), 'exec'), namespace)
    namespace['MODELS'] = str(MODELS)
    return namespace


def measured_hands(human, body, threshold=0.5, prefixes=('wrist', 'finger', 'metacarpal')):
    """Hand-dominant evaluated vertices, world metres; no forearm weight tails.

    threshold=0.01 is used separately for the conservative protocol check.
    Cuff fit selects only finger2..5 groups; palm/thumb remain sleeve-covered.
    """
    names = {group.index: group.name for group in human.vertex_groups}
    points = {'L': [], 'R': []}
    for vertex in body.data.vertices:
        for side in points:
            weight = sum(g.weight for g in vertex.groups
                         if names.get(g.group, '').startswith(prefixes)
                         and names.get(g.group, '').endswith('.' + side))
            if weight > threshold:
                points[side].append(body.matrix_world @ vertex.co)
    if not all(points.values()):
        raise RuntimeError('Cannot measure evaluated hand vertices')
    return points


def trim_scrub_shirt(shirt, marks):
    """Keep only the neckline band on the frozen copy, world metres, Z up."""
    bm = bmesh.new()
    bm.from_mesh(shirt.data)
    threshold = marks['neck'] - 0.04
    doomed = [v for v in bm.verts if (shirt.matrix_world @ v.co).z < threshold]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(shirt.data)
    bm.free()
    shirt.data.update()
    print('SCRUB neckline', 'removed vertices', len(doomed), 'min z', round(threshold, 3))


def check_protocol(points, rig, marks):
    """Check every retained hand vertex against waist and shoulder plane, metres."""
    all_points = points['L'] + points['R']
    lowest = min(p.z for p in all_points)
    torso_front = min(bone_head(rig, f'upperarm01.{s}').y for s in 'LR') - 0.10
    print('HANDS lowest', round(lowest, 3), 'waist', round(marks['waist'], 3),
          'wrists', [tuple(bone_head(rig, f'wrist.{s}')) for s in 'LR'])
    if lowest <= marks['waist'] or any(p.y >= torso_front for p in all_points):
        print('PROTOCOL VIOLATION: hands below waist or behind torso front')
        raise RuntimeError('Hand protocol failed')


def budget(helpers, gown, layouts, context, cuffs, config, hands):
    """Enforce 80,000 evaluated triangles, including curves and retained hands."""
    count = helpers['triangles'](gown)
    if count > helpers['GOWN_TRIANGLES']:
        helpers['decimate'](gown, helpers['GOWN_TRIANGLES'] / count)
    enforce_hand_clearance(gown, layouts, 'post-decimate')
    if config['pose'] == 'gloving':
        restore_owned_rims(gown, layouts)
    else:
        restore_sleeve_rims_v2(gown, layouts)
    if config['pose'] == 'gloving':
        island_normals(gown)
    else:
        outward_normals_v2(gown)
    assert_seam_gap(gown, layouts)
    reduce_cap_elastic(helpers, config['cap_elastic_triangles'])
    finalize_coverage(gown, layouts, hands, config['hand_clearance_guard'])
    finalize_extra_geometry(config, context, gown)
    fit_extra_budget(helpers, context, cuffs, limit=config['triangle_target'],
                     cuff_floor=config['cuff_triangle_floor'])
    if config['hand_clearance_guard']:
        assert_seam_gap(gown, layouts)
    counts = {obj.name: helpers['triangles'](obj) for obj in helpers['visible_objects']()}
    total = sum(counts.values())
    print('TRIANGLES', total, dict(sorted(counts.items(), key=lambda item: -item[1])))
    if config['triangle_target'] < helpers['MAX_TRIANGLES']:
        print('BUDGET target', config['triangle_target'], 'headroom triangles', helpers['MAX_TRIANGLES']-total)
    if total > config['triangle_target']:
        raise RuntimeError(f'OVER BUDGET: {total} triangles')


def render_hands(rig, prefix):
    """Front-three-quarter detail, camera 1.15 m from wrist midpoint, world metres."""
    scene = bpy.context.scene
    target = sum((bone_head(rig, f'wrist.{s}') for s in 'LR'), Vector()) / 2
    angle = math.radians(25)
    offset = Vector((math.sin(angle), -math.cos(angle), 0.12)).normalized() * 1.15
    camera = scene.camera
    camera.data.lens = 26  # wide enough for both diverging cuffs in portrait framing
    camera.location = target + offset
    camera.rotation_euler = (-offset).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'{prefix}-hands.png')
    bpy.ops.render.render(write_still=True)
    return scene.render.filepath


def render_back(rig, context, prefix):
    """Neck-to-bow detail from rear three-quarter, 1.1 m away, world metres."""
    target = (context['neck']+context['waist'])/2
    angle = math.radians(160)
    offset = Vector((math.sin(angle), -math.cos(angle), 0.04)).normalized()*1.1
    camera = bpy.context.scene.camera
    camera.data.lens = 50
    camera.location = target+offset
    camera.rotation_euler = (-offset).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.render.filepath = str(OUT/f'{prefix}-back.png')
    bpy.ops.render.render(write_still=True)
    return bpy.context.scene.render.filepath


def render_detail(config, rig, context, prefix):
    """Choose the configured detail camera; world metres, Z up, -Y front."""
    handlers = {'hands': lambda: render_hands(rig, prefix),
                'back': lambda: render_back(rig, context, prefix),
                'detail': lambda: render_new_detail(rig, context, prefix)}
    return handlers[config['detail']]()


def render_new_detail(rig, context, prefix):
    """New steps' hand detail, world metres; preserve approved detail cameras."""
    from preparation_scene_v2 import render_detail_view
    return render_detail_view(rig, context, prefix)


def main():
    """Build only supported steps; render previews and optionally export to v2/."""
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args or len(args) > 2 or (len(args) == 2 and args[1] != 'export'):
        raise SystemExit('Usage: blender --background --python build_v2.py -- <step> [export]')
    step = int(args[0])
    config = config_for(step)
    if config.get('scene') == 'preparation':
        from preparation_scene_v2 import run
        return run(step, config, args, sys.modules[__name__])
    MODELS.mkdir(parents=True, exist_ok=True)
    helpers = legacy_helpers()
    clear_scene()
    human, rig, clothes = build_human(gloves=config['gloves'])
    pose_step_v2(rig, step)
    bpy.context.view_layer.update()
    marks = landmarks(rig)
    collider = helpers['whole_body_copy'](human)
    frozen = helpers['freeze']([o for o in helpers['character_meshes'](rig) if o != collider])
    # Measure on the full collider, so clothing masks cannot hide finger vertices.
    hands = measured_hands(human, collider)
    check_protocol(measured_hands(human, collider, threshold=0.01), rig, marks)
    shirt = frozen[clothes['joepal_crude_t-shirt_female'].name]
    trim_scrub_shirt(shirt, marks)
    fingers = measured_hands(human, collider, prefixes=('finger2-', 'finger3-', 'finger4-', 'finger5-'))
    layouts = cuff_layouts(rig, hands, fingers)
    if step == 6:
        for profile in layouts.values():
            profile['owned_seam'] = True
    prepare_clearance(layouts, hands)
    prepare_guard(layouts, hands, config['hand_clearance_guard'])
    choose_seams(layouts, hands, minimum_shift_m=config['seam_min_shift_m'])
    check_layout(rig, layouts, config)
    helpers['decimate'](frozen[clothes['toigo_flats'].name], helpers['SHOES_RATIO'])
    surgical_cap(evaluated_body(human), marks,
                 fabric_material('v2-cap', (0.105, 0.32, 0.35, 1)),
                 fabric_material('v2-cap-trim', TRIM))
    colliders = [collider, frozen[clothes['toigo_wool_pants'].name]]
    if step == 6:
        gown, marks = build_gloving_gown(human, rig, colliders, layouts)
    else:
        gown, marks = build_gown_v2(human, rig, colliders, layouts, closure=config['closure'])
    cuffs = build_cuffs(layouts, axial_segments=config['cuff_segments'])
    context = build_extras(config, human, rig, gown, marks)
    budget(helpers, gown, layouts, context, cuffs, config, hands)
    assert_hand_coverage(gown, layouts, hands)
    validate_extras(config, context, gown, cuffs, layouts, rig)
    paths = []
    if 'export' in args:
        helpers['export_glb'](step)
        path = MODELS / f'paso-{step}.glb'
        if path.stat().st_size > helpers['MAX_GLB_BYTES']:
            path.unlink()
            raise RuntimeError('GLB OVER BUDGET: rejected export above 3 MB')
        paths.append(str(path))
    setup_render(samples=64, res=(620, 930))
    prefix = f'v2-paso{step}'
    paths += render_views(prefix, config['views'])
    paths.append(render_detail(config, rig, context, prefix))
    print('PATHS', paths)


if __name__ == '__main__':
    main()
