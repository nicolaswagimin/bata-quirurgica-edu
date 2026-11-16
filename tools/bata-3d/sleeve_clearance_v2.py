"""Smooth hand-covering sleeves. World metres, Z up, figure faces -Y."""
import math

import bpy
from sleeve_seam_v2 import TAPER_LENGTH_M, taper_radius

HAND_CLEARANCE_M = 0.010
SMOOTH_ITERATIONS = 20
FOLD_RESERVE_M = 0.004


def prepare_clearance(layouts, hands):
    """Enclose the palm/thumb by one smooth radial envelope, not knuckle relief.

    A constant radius across the hand bridges skin bumps. Clearance is measured
    from actual posed hand vertices; the extra fold reserve preserves soft waves.
    The upstream transition is on the forearm, away from the hand itself.
    """
    for side, p in layouts.items():
        offset = p['across']*p['offset'][0] + p['normal']*p['offset'][1]
        radii, positions = [], []
        for point in hands[side]:
            delta = point-p['wrist']-offset
            z = delta.dot(p['axis'])
            if z <= p['sleeve_end']:
                radii.append((delta-p['axis']*z).length)
                positions.append(z)
        if not radii:
            raise RuntimeError(f'{side}: no palm vertices for sleeve clearance')
        p['hand_start'] = min(positions)-0.015
        p['hand_envelope_radius'] = max(0.05, max(radii)+HAND_CLEARANCE_M)
        p['palm_radius'] = p['hand_envelope_radius']+FOLD_RESERVE_M
        print('SLEEVE hand envelope', side, 'skin radius cm', round(max(radii)*100, 3),
              'clearance mm', HAND_CLEARANCE_M*1000,
              'fabric radius cm', round(p['palm_radius']*100, 3),
              'smooth iterations', SMOOTH_ITERATIONS)


def clearance_weight(z, p):
    """Smooth forearm transition into the constant hand envelope, axial metres."""
    t = max(0, min(1, (z-(p['hand_start']-0.035))/0.035))
    return t*t*(3-2*t)


def smooth_hand_sleeves(gown, layouts):
    """Twenty-pass vertex-group SMOOTH limited to hand-covering fabric.

    Run before adding compression folds, so smoothing cannot erase those folds
    or the elbow drape. Boundary ring is restored by gown's existing v2 helper.
    """
    group = gown.vertex_groups.new(name='v2-smooth-hand-fabric')
    counts = {}
    for side, p in layouts.items():
        offset = p['across']*p['offset'][0]+p['normal']*p['offset'][1]
        count = 0
        selected = None
        if p.get('owned_seam', False):
            from sleeve_guard_v2 import sleeve_vertices
            selected, _ = sleeve_vertices(gown, p)
        for vertex in gown.data.vertices:
            if selected is not None and vertex.index not in selected:
                continue
            delta = gown.matrix_world @ vertex.co-p['wrist']-offset
            z = delta.dot(p['axis'])
            radial = (delta-p['axis']*z).length
            if p['hand_start']-0.035 < z < p['sleeve_end'] and 0.025 < radial < 0.11:
                group.add([vertex.index], clearance_weight(z, p), 'REPLACE')
                count += 1
        counts[side] = count
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = gown
    gown.select_set(True)
    modifier = gown.modifiers.new('v2-smooth-hand-fabric', 'SMOOTH')
    modifier.vertex_group = group.name
    modifier.factor, modifier.iterations = 0.5, SMOOTH_ITERATIONS
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print('SLEEVE hand smoothing', counts, 'iterations', SMOOTH_ITERATIONS)


def enforce_hand_clearance(gown, layouts, stage):
    """Project fabric outside the measured skin envelope, world metres.

    Also run AFTER decimation: that can otherwise move a few triangles through
    the hand. The palm keeps its 10 mm margin upstream of the 4 cm taper.
    The taper follows the sewn ellipse and gather pleats exactly; it must never
    inherit the wide circular palm envelope. No topology or skin changes.
    """
    inverse = gown.matrix_world.inverted()
    for side, p in layouts.items():
        radius_at = taper_radius
        if p.get('coverage_guard', False):
            from sleeve_guard_v2 import guarded_taper_radius
            radius_at = guarded_taper_radius
        offset = p['across']*p['offset'][0]+p['normal']*p['offset'][1]
        changed, largest = 0, 0.0
        selected = None
        if p.get('owned_seam', False):
            from sleeve_guard_v2 import sleeve_vertices
            selected, _ = sleeve_vertices(gown, p)
        for vertex in gown.data.vertices:
            if selected is not None and vertex.index not in selected:
                continue
            point = gown.matrix_world @ vertex.co
            delta = point-p['wrist']-offset
            z = delta.dot(p['axis'])
            radial = delta-p['axis']*z
            if not p['hand_start']-0.035 < z <= p['sleeve_end']+0.0001 or not 0.025 < radial.length < 0.11:
                continue
            if z >= p['sleeve_end']-TAPER_LENGTH_M:
                angle = math.atan2(radial.dot(p['normal']), radial.dot(p['across']))
                target = radius_at(z, angle, p)
            else:
                minimum = 0.048+(p['hand_envelope_radius']-0.048)*clearance_weight(z, p)
                target = max(radial.length, minimum)
            correction = abs(target-radial.length)
            if correction > 1e-8:
                largest = max(largest, correction)
                vertex.co = inverse @ (p['wrist']+offset+p['axis']*z+radial.normalized()*target)
                changed += 1
        print('SLEEVE hand clearance', stage, side, 'moved vertices', changed,
              'max correction mm', round(largest*1000, 3), 'skin margin mm', HAND_CLEARANCE_M*1000)
    gown.data.update()
