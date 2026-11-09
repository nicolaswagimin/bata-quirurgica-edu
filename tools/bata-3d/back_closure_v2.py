"""Unwrapped back closure controlled DURING cloth simulation, world metres, Z up, -Y front."""
import math

import bmesh
import bpy
from gown import NECK_RIM_RADIUS, bmesh_boundary, cut_hem, neck_rim, prune_flying, sleeve_rims

BACK_GAP_LIMITS_M = {'neck': 0.02, 'mid-back': 0.06, 'waist': 0.03, 'hem': 0.15}


def seam_gap_target(z, marks):
    """Small sewn-back opening, metres: 6 mm neck, 15 mm waist, 9 cm hem."""
    if z < marks['waist']:
        t = max(0, min(1, (marks['waist']-z)/(marks['waist']-marks['hem'])))
        return 0.015+0.075*t
    t = max(0, min(1, (z-marks['waist'])/(marks['neck']-marks['waist'])))
    return 0.015*(1-t)+0.006*t+0.012*math.sin(math.pi*t)


def back_pin_keys(gown, marks, center, pin):
    """Animated shape-key pin targets keep both cut back edges near the centre.

    Shape keys feed the cloth modifier, never warp its baked output. Every
    seam level is controlled so the skirt cannot become a neck-to-hem V.
    Other cloth vertices remain free to drape against the body under gravity.
    """
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    bm.verts.ensure_lookup_table()
    seam = {v for e in bm.edges if e.is_boundary for v in e.verts
            if abs(v.co.x) < 0.018 and v.co.y > center.y+0.025}
    side = {v.index: (1 if sum(f.calc_center_median().x for f in v.link_faces) >= 0 else -1)
            for v in seam}
    bm.free()
    if len(side) < 20:
        raise RuntimeError('Cannot identify both unwrapped back seam edges')
    gown.shape_key_add(name='Basis')
    target = gown.shape_key_add(name='v2-back-pin-targets')
    for index, sign in side.items():
        co = target.data[index].co
        co.x = sign*seam_gap_target(co.z, marks)/2
        pin.add([index], 1.0, 'REPLACE')
    target.value = 0
    target.keyframe_insert(data_path='value', frame=1)
    target.value = 1
    target.keyframe_insert(data_path='value', frame=12)
    print('BACK sim seam pins', len(side), 'closure frame', 12, 'unwrapped', True)


def simulate_closed_back(gown, rig, colliders, marks, center, frames=46):
    """Cloth with neck/sleeve pins plus animated back seam and waist gathering.

    World metres. This separate v2 solver leaves legacy simulate() untouched.
    No post-simulation panel repositioning is used.
    """
    scene = bpy.context.scene
    scene.frame_set(1)
    pin = gown.vertex_groups.new(name='pin')
    gather = gown.vertex_groups.new(name='gather')
    rim = neck_rim(gown, marks)+sleeve_rims(gown, rig)
    for v in gown.data.vertices:
        if any((v.co-r).length_squared < NECK_RIM_RADIUS**2 for r in rim):
            pin.add([v.index], 1.0, 'REPLACE')
        weight = max(0, 1-abs(v.co.z-marks['waist'])/0.055)
        if weight and v.co.y > center.y:
            gather.add([v.index], weight, 'REPLACE')
    back_pin_keys(gown, marks, center, pin)
    for obj in colliders:
        collision = obj.modifiers.new('v2-back-collision', 'COLLISION')
        collision.settings.thickness_outer = 0.006
        collision.settings.cloth_friction = 6
    cloth = gown.modifiers.new('v2-closed-back-cloth', 'CLOTH')
    settings = cloth.settings
    settings.quality, settings.mass = 7, 0.12
    settings.tension_stiffness, settings.compression_stiffness = 14, 14
    settings.shear_stiffness, settings.bending_stiffness = 6, 1.2
    settings.air_damping = 2
    settings.vertex_group_mass, settings.vertex_group_shrink = pin.name, gather.name
    settings.shrink_min, settings.shrink_max = 0, 0.10
    cloth.collision_settings.distance_min = 0.005
    cloth.collision_settings.collision_quality = 3
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames
    scene.frame_start, scene.frame_end = 1, frames
    for frame in range(1, frames+1):
        scene.frame_set(frame)
    iron = gown.vertex_groups.new(name='v2-front-iron')
    for v in gown.data.vertices:
        across = max(0, 1-abs(v.co.x)/0.1)
        along = max(0, 1-abs(v.co.z-1.13)/0.2)
        if v.co.y < center.y and across and along:
            iron.add([v.index], min(1, 2*across)*min(1, 2*along), 'REPLACE')
    modifier = gown.modifiers.new('v2-front-relax', 'SMOOTH')
    modifier.factor, modifier.iterations, modifier.vertex_group = 1, 60, iron.name
    # Keep the pinned seam out of the final relax pass as well.
    relax = gown.vertex_groups.new(name='v2-relax-free-cloth')
    for v in gown.data.vertices:
        weights = {g.group: g.weight for g in v.groups}
        if weights.get(pin.index, 0) < 0.99:
            relax.add([v.index], 1, 'REPLACE')
    modifier = gown.modifiers.new('v2-free-relax', 'SMOOTH')
    modifier.factor, modifier.iterations, modifier.vertex_group = 0.5, 8, relax.name
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    mesh = bpy.data.meshes.new_from_object(gown.evaluated_get(graph))
    gown.modifiers.clear()
    gown.shape_key_clear()
    old = gown.data
    gown.data = mesh
    prune_flying(gown, marks)
    cut_hem(gown, marks)
    bpy.data.meshes.remove(old)
    for obj in colliders:
        obj.modifiers.remove(obj.modifiers['v2-back-collision'])
    scene.frame_set(1)
    measure_back_gaps(gown, marks, 'post-sim')


def measure_back_gaps(gown, marks, stage='final'):
    """Actual cut-edge gaps at four heights, metres; no mesh correction."""
    edges = [(a, b) for a, b, _ in bmesh_boundary(gown)
             if a.y > 0 and b.y > 0 and abs(a.x) < 0.13 and abs(b.x) < 0.13
             and abs(a.z-b.z) > 0.25*(a-b).length]
    if not edges:
        raise RuntimeError('No measurable cut back seam')
    neck = min(marks['neck'], max(max(a.z, b.z) for a, b in edges))-0.015
    heights = {'neck': neck, 'mid-back': (neck+marks['waist'])/2,
               'waist': marks['waist'], 'hem': marks['hem']+0.005}
    gaps = {}
    for name, z in heights.items():
        xs = [a.lerp(b, (z-a.z)/(b.z-a.z)).x for a, b in edges
              if min(a.z, b.z) <= z <= max(a.z, b.z)]
        negative, positive = [x for x in xs if x < 0], [x for x in xs if x > 0]
        if not negative or not positive:
            raise RuntimeError(f'Cannot measure both back panels at {name} z={z:.3f}')
        gaps[name] = min(positive)-max(negative)
        print('BACK gap', stage, name, 'cm', round(gaps[name]*100, 3),
              'limit cm', BACK_GAP_LIMITS_M[name]*100)
        assert gaps[name] <= BACK_GAP_LIMITS_M[name], f'Back opening too wide at {name}'
    return gaps
