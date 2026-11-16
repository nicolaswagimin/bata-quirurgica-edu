"""Circulating nurse's hands/forearms only. World metres, Z up, -Y front."""
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from common import SCRUBS
from gown import bone_head, bone_tail, fabric_material, loft
from hands import pose_hand
from poses import orient_hand, solve_arm
from circulator_ik_v2 import (CONTACT_ITERATIONS, CONTACT_SOLVE_M, CONTACT_TOLERANCE_M,
                              MAX_REACH_FRACTION, plan_contacts)

SKIN_CUT_M = 0.145
SLEEVE_CAP_EXTENSION_M = 0.025  # closed rounded end just beyond the elbow
CIRCULATOR_ORIGIN_M = (0, 0.40, -0.25)  # Y offset measured from gown back
HAND_TRIANGLE_FLOOR = 2000  # per hand + visible forearm, not a whole character


def copy_source(human, rig, context):
    """Independent posed rig/body copies; source figure and its masks untouched."""
    copy_rig = rig.copy()
    copy_rig.data = rig.data.copy()
    copy_rig.name = 'v2-circulator-rig'
    copy_rig.animation_data_clear()
    bpy.context.scene.collection.objects.link(copy_rig)
    ox, oy, oz = CIRCULATOR_ORIGIN_M
    copy_rig.location = (ox, context['waist'].y-0.025+oy, oz)
    for bone in copy_rig.pose.bones:
        bone.matrix_basis.identity()
    source = human.copy()
    source.data = human.data.copy()
    source.name = 'v2-circulator-source'
    bpy.context.scene.collection.objects.link(source)
    source.parent = copy_rig
    source.matrix_parent_inverse = human.matrix_parent_inverse.copy()
    for modifier in source.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.object = copy_rig
        if modifier.type == 'MASK' and modifier.name != 'Hide helpers':
            modifier.show_viewport = False
    source.hide_render = True
    source.hide_set(False)
    bpy.context.view_layer.update()
    return source, copy_rig


def contact_point(rig, side):
    """Midpoint of the opposed thumb/index pads, world metres."""
    return (bone_tail(rig, f'finger1-3.{side}')+bone_tail(rig, f'finger2-3.{side}'))/2


def pose_contact(rig, side, target, plan):
    """Measured-pad IK with preflight reach margin; world metres, Z up, -Y front.

    Reapply the same calibrated orientation/pinch after each IK solve. Report
    requested/actual wrist reach and clamping separately from pad error so an
    unreachable arm cannot masquerade as a hand-preset convergence problem.
    """
    inverse = rig.matrix_world.inverted()
    wrist = plan['wrist'].copy()
    shoulder = bone_head(rig, f'upperarm01.{side}')
    pole = inverse.to_3x3() @ (plan['elbow']-shoulder)
    for iteration in range(1, CONTACT_ITERATIONS+1):
        fraction = (wrist-shoulder).length/plan['reach']
        assert fraction <= MAX_REACH_FRACTION, f'{side}: corrected wrist exceeds 82% reach'
        solve_arm(rig, side, inverse @ wrist, pole)
        actual_wrist = bone_head(rig, f'wrist.{side}')
        clamp = (wrist-actual_wrist).length
        orient_hand(rig, side, plan['fingers'], plan['thumb'])
        pose_hand(rig, side, 'pinch')
        delta = target-contact_point(rig, side)
        error = delta.length
        if side == 'R':
            print('CIRCULATOR IK R iteration', iteration, 'pad error mm', round(error*1000, 5),
                  'requested reach pct', round(fraction*100, 3),
                  'actual reach pct', round((actual_wrist-shoulder).length/plan['reach']*100, 3),
                  'wrist clamp mm', round(clamp*1000, 5),
                  'correction mm', tuple(round(c*1000, 4) for c in delta))
        assert clamp < 0.001, f'{side}: IK clamped despite preflight reach margin'
        if error < CONTACT_SOLVE_M:
            break
        wrist += delta
    print('CIRCULATOR tie contact', side, 'pad error mm', round(error*1000, 5),
          'reach pct', round((bone_head(rig, f'wrist.{side}')-shoulder).length/plan['reach']*100, 3))
    assert error < CONTACT_TOLERANCE_M, f'{side}: circulating hand misses tie by {error*1000:.3f} mm'


def keep_forearm(mesh, source, rig, side):
    """Retain hand + 14.5 cm forearm; cut skin inside its long scrub sleeve."""
    names = {g.index: g.name for g in source.vertex_groups}
    wrist = bone_head(rig, f'wrist.{side}')
    axis = (wrist-bone_head(rig, f'lowerarm01.{side}')).normalized()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    layer = bm.verts.layers.deform.verify()
    doomed = []
    for v in bm.verts:
        weight = sum(w for g, w in v[layer].items() if names.get(g, '').endswith('.'+side)
                     and names.get(g, '').startswith(('lowerarm', 'wrist', 'finger', 'metacarpal')))
        delta = v.co-wrist
        z = delta.dot(axis)
        if weight < 0.2 or z < -SKIN_CUT_M or delta.length > 0.33:
            doomed.append(v)
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    # A planar cut, not a weight-defined jagged stump; buried well inside the elbow-length fabric.
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                          plane_co=wrist-axis*SKIN_CUT_M, plane_no=-axis, clear_outer=True)
    bm.to_mesh(mesh)
    bm.free()
    if len(mesh.vertices) < 100:
        raise RuntimeError(f'{side}: missing evaluated hand/forearm deform weights')
    print('CIRCULATOR static skin', side, 'vertices', len(mesh.vertices))
    elbow = bone_head(rig, f'lowerarm01.{side}')
    print('CIRCULATOR forearm direction', side, tuple(round(c, 3) for c in axis),
          'elbow', tuple(round(c, 3) for c in elbow))
    assert axis.y < -0.70 and abs(axis.x) < 0.65, 'Circulator forearm must approach from behind'
    assert axis.x*(1 if side == 'L' else -1) < 0, 'Circulator forearms must converge'
    return wrist, axis, elbow


def scrub_sleeve(side, wrist, axis, elbow, skin, length_m=None, skin_cut_m=SKIN_CUT_M):
    """Authored round sleeve, closed end; shorten by length, never X deformation."""
    material = fabric_material(f'v2-circulator-scrub-{side}', SCRUBS, 0.85)
    u = axis.orthogonal().normalized()
    v = axis.cross(u).normalized()
    radius = 0.034
    for vertex in skin.data.vertices:
        delta = vertex.co-wrist
        if -skin_cut_m < delta.dot(axis) < -0.045:
            radius = max(radius, (delta-axis*delta.dot(axis)).length+0.004)
    length = (wrist-elbow).length+SLEEVE_CAP_EXTENSION_M if length_m is None else length_m
    cap = min(0.025, (length-0.035)*0.65)
    levels = [(-length, 0.001), (-length+0.003, radius*0.30),
              (-length+0.010, radius*0.65), (-length+cap, radius)]
    if -length+cap < -skin_cut_m < -0.035:
        levels.append((-skin_cut_m, radius))
    levels += [(-0.040, radius), (-0.035, radius)]
    rings = [[wrist+axis*z+(u*math.cos(a)+v*math.sin(a))*r
              for a in (2*math.pi*j/24 for j in range(24))] for z, r in levels]
    sleeve = loft(f'v2-circulator-sleeve-{side}', rings, cap=False)
    bm = bmesh.new()
    bm.from_mesh(sleeve.data)
    bm.verts.ensure_lookup_table()
    bm.faces.new([bm.verts[i] for i in range(23, -1, -1)])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    proximal_open = sum(e.is_boundary and all((v.co-wrist).dot(axis) < -0.04 for v in e.verts)
                        for e in bm.edges)
    print('CIRCULATOR rounded sleeve end', side, 'length cm', round(length*100, 2),
          'proximal open edges', proximal_open, 'skin buried cm', round((length-skin_cut_m)*100, 2))
    assert proximal_open == 0
    bm.to_mesh(sleeve.data)
    bm.free()
    sleeve.data.materials.append(material)
    sleeve.data.polygons.foreach_set('use_smooth', [True]*len(sleeve.data.polygons))
    hem_rings = [[wrist+axis*z+(u*math.cos(a)+v*math.sin(a))*(radius+dr)
                  for a in (2*math.pi*j/24 for j in range(24))]
                 for z, dr in ((-0.038, 0), (-0.035, 0.0018), (-0.032, 0))]
    hem = loft(f'v2-circulator-hem-{side}', hem_rings, cap=False)
    hem.data.materials.append(material)
    hem.data.polygons.foreach_set('use_smooth', [True]*len(hem.data.polygons))
    return [sleeve, hem]


def build_circulator(human, rig, context):
    """Bake two skin-preserving hands with scrub sleeves; leave originals intact."""
    source, copy_rig = copy_source(human, rig, context)
    plans = plan_contacts(copy_rig, context['holds'], back_y=context['waist'].y-0.025)
    for side in ('L', 'R'):
        pose_contact(copy_rig, side, context['holds'][side], plans[side])
    for side in ('L', 'R'):
        error = (context['holds'][side]-contact_point(copy_rig, side)).length
        print('CIRCULATOR final tie error mm', side, round(error*1000, 5))
        assert error < CONTACT_TOLERANCE_M, f'{side}: tie contact changed while posing the other arm'
    left_elbow = bone_head(copy_rig, 'lowerarm01.L')
    right_elbow = bone_head(copy_rig, 'lowerarm01.R')
    print('CIRCULATOR actual elbows x cm', round(left_elbow.x*100, 4), round(right_elbow.x*100, 4),
          'rig x m', copy_rig.matrix_world.translation.x)
    assert copy_rig.matrix_world.translation.x == 0 and left_elbow.x > 0 > right_elbow.x
    print('CIRCULATOR approach spans cm',
          'elbows', round(abs(bone_head(copy_rig, 'lowerarm01.L').x-bone_head(copy_rig, 'lowerarm01.R').x)*100, 2),
          'wrists', round(abs(bone_head(copy_rig, 'wrist.L').x-bone_head(copy_rig, 'wrist.R').x)*100, 2))
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(graph)
    baked = bpy.data.meshes.new_from_object(evaluated)
    # Copy evaluated coordinates into world space before trimming each side.
    baked.transform(source.matrix_world)
    hands, clothing, frames, sources, minimum_cut = [], [], {}, {}, {}
    for side in ('L', 'R'):
        mesh = baked.copy()
        wrist, axis, elbow = keep_forearm(mesh, source, copy_rig, side)
        obj = bpy.data.objects.new(f'v2-circulator-hand-{side}', mesh)
        bpy.context.scene.collection.objects.link(obj)
        mesh.polygons.foreach_set('use_smooth', [True]*len(mesh.polygons))
        hands.append(obj)
        sources[side] = mesh.copy()
        group_ids = {g.index for g in source.vertex_groups if g.name.endswith('.'+side)
                     and g.name.startswith(('wrist', 'finger', 'metacarpal'))}
        hand_z = [(vertex.co-wrist).dot(axis) for vertex in mesh.vertices
                  if sum(g.weight for g in vertex.groups if g.group in group_ids) > 0.5]
        if not hand_z:
            raise RuntimeError('Missing hand weights for forearm cut protection')
        minimum_cut[side] = max(0.035, -min(hand_z)+0.005)
        sleeve_objects = scrub_sleeve(side, wrist, axis, elbow, obj)
        clothing += sleeve_objects
        for item in sleeve_objects:
            frames[item.name] = (wrist, axis)
        distance = elbow.y-(context['waist'].y-0.025)
        print('CIRCULATOR elbow behind back cm', side, round(distance*100, 2))
        assert 0.28 <= distance <= 0.50, 'Elbow must stay behind the gown'
    bpy.data.meshes.remove(baked)
    bpy.data.objects.remove(source, do_unlink=True)
    bpy.data.objects.remove(copy_rig, do_unlink=True)
    return dict(circulator_hands=hands, circulator_clothing=clothing, circulator_frames=frames,
                circulator_sources=sources, circulator_min_cut_m=minimum_cut)


def segment_distance(point, a, b):
    """Distance to a finite world-space segment, metres."""
    ab = b-a
    t = max(0, min(1, (point-a).dot(ab)/ab.length_squared))
    return (point-(a+ab*t)).length


def assert_sterile_clearance(gown, cuffs, layouts, rig, objects):
    """Every circulator vertex >=1 cm from front/sleeves, including knit cuffs."""
    segments = [(bone_head(rig, f'upperarm01.{side}'), bone_head(rig, f'lowerarm01.{side}'),
                 p['rim']) for side, p in layouts.items()]
    vertices = [gown.matrix_world @ v.co for v in gown.data.vertices]
    faces = []
    for face in gown.data.polygons:
        center = sum((vertices[i] for i in face.vertices), Vector())/len(face.vertices)
        on_sleeve = any(min(segment_distance(center, a, b), segment_distance(center, b, c)) < 0.11
                        for a, b, c in segments)
        if center.y < 0 or on_sleeve:
            faces.append(tuple(face.vertices))
    for cuff in cuffs:
        offset = len(vertices)
        vertices += [cuff.matrix_world @ v.co for v in cuff.data.vertices]
        faces += [tuple(offset+i for i in f.vertices) for f in cuff.data.polygons]
    tree = BVHTree.FromPolygons(vertices, faces)
    minimum, count = float('inf'), 0
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        for vertex in mesh.vertices:
            _, _, _, distance = tree.find_nearest(obj.matrix_world @ vertex.co)
            minimum = min(minimum, distance)
            count += 1
        evaluated.to_mesh_clear()
    print('CIRCULATOR sterile clearance min cm', round(minimum*100, 3), 'vertices', count)
    assert count and minimum >= 0.01, 'Circulator within 1 cm of gown front or sleeves'
