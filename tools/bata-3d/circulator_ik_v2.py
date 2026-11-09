"""Centred circulator placement. World metres, Z up, both figures face -Y."""
import math

import bpy
from mathutils import Vector
from gown import bone_head, bone_tail
from hands import pose_hand
from poses import orient_hand

MAX_REACH_FRACTION = 0.82
PLAN_REACH_FRACTION = 0.80  # reserve 2% for final pad correction
CONTACT_TOLERANCE_M = 0.005
CONTACT_SOLVE_M = 0.001
CONTACT_ITERATIONS = 12
ELBOW_HALFSPANS_M = (0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18)
PLACEMENT_GRID_M = 0.005


def pinch_direction(side):
    """Own L/R stays unchanged for a person facing -Y; no mirrored rig pose."""
    return Vector((-0.25 if side == 'L' else 0.25, -1, 0.12)).normalized()


def pinch_thumb_direction(side):
    """Natural supination for forward-reaching pinch; world ±X thumb side.

    Rotating the wrist/palm is a real skeletal pose, not mesh deformation.
    It keeps the forearm and hand directed toward the bow instead of sideways.
    """
    return Vector((1 if side == 'L' else -1, 0, 0))


def pad_point(rig, side):
    """Actual opposed-pad midpoint, world metres; no assumed hand length."""
    return (bone_tail(rig, f'finger1-3.{side}')+bone_tail(rig, f'finger2-3.{side}'))/2


def centred_elbow(shoulder, wrist, upper, forearm, elbow_x):
    """Two-circle IK in Y/Z with a prescribed symmetric elbow X, metres.

    Return the rear intersection; no translation of the rig or skin in X is
    permitted. Both upper-arm and forearm lengths are preserved exactly.
    """
    upper2 = upper*upper-(elbow_x-shoulder.x)**2
    fore2 = forearm*forearm-(elbow_x-wrist.x)**2
    dy, dz = wrist.y-shoulder.y, wrist.z-shoulder.z
    distance2 = dy*dy+dz*dz
    if min(upper2, fore2, distance2) <= 0:
        return None
    distance = math.sqrt(distance2)
    a, b = math.sqrt(upper2), math.sqrt(fore2)
    if not abs(a-b) <= distance <= a+b:
        return None
    along = (upper2-fore2+distance2)/(2*distance)
    height = math.sqrt(max(0, upper2-along*along))
    uy, uz = dy/distance, dz/distance
    choices = [Vector((elbow_x, shoulder.y+uy*along-uz*height*sign,
                        shoulder.z+uz*along+uy*height*sign)) for sign in (-1, 1)]
    return max(choices, key=lambda point: point.y)


def plan_contacts(rig, targets, back_y=None):
    """Fit Y/Z only, x=0, with symmetric elbows and bilateral <=82% reach.

    Calibrate each posed hand before positioning. Only centred Y/Z candidates
    are tested; bow asymmetry cannot pull the circulating nurse sideways.
    """
    preferred = rig.matrix_world.translation.copy()
    if back_y is None:
        back_y = min(point.y for point in targets.values())-0.043
    plans = {}
    for side in ('L', 'R'):
        shoulder = bone_head(rig, f'upperarm01.{side}')
        elbow = bone_head(rig, f'lowerarm01.{side}')
        wrist = bone_head(rig, f'wrist.{side}')
        l1, l2 = (elbow-shoulder).length, (wrist-elbow).length
        fingers = pinch_direction(side)
        thumb = pinch_thumb_direction(side)
        orient_hand(rig, side, fingers, thumb)
        pose_hand(rig, side, 'pinch')
        offset = pad_point(rig, side)-bone_head(rig, f'wrist.{side}')
        goal = targets[side]-offset
        plans[side] = dict(wrist=goal, fingers=fingers, thumb=thumb, shoulder_offset=shoulder-preferred,
                           upper=l1, forearm=l2, reach=l1+l2, pad_offset=offset)
        print('CIRCULATOR pad calibration', side, 'offset m', tuple(round(c, 5) for c in offset),
              'wrist goal', tuple(round(c, 5) for c in goal))
    best = None
    for iy in range(-40, 25):
        y = preferred.y+iy*PLACEMENT_GRID_M
        if y < back_y+0.20:
            continue
        for iz in range(-32, 33):
            origin = Vector((0, y, preferred.z+iz*PLACEMENT_GRID_M))
            shoulders = {side: origin+p['shoulder_offset'] for side, p in plans.items()}
            fractions = [(p['wrist']-shoulders[side]).length/p['reach'] for side, p in plans.items()]
            if max(fractions) > PLAN_REACH_FRACTION:
                continue
            for halfspan in ELBOW_HALFSPANS_M:
                elbows = {}
                for side, sign in (('L', 1), ('R', -1)):
                    p = plans[side]
                    elbow = centred_elbow(shoulders[side], p['wrist'], p['upper'], p['forearm'], sign*halfspan)
                    if elbow is None:
                        break
                    axis = (p['wrist']-elbow).normalized()
                    if not (axis.y < -0.70 and abs(axis.x) < 0.65 and sign*axis.x < 0
                            and 0.28 <= elbow.y-back_y <= 0.50):
                        break
                    elbows[side] = elbow
                if len(elbows) != 2:
                    continue
                symmetry = (elbows['L'].y-elbows['R'].y)**2+(elbows['L'].z-elbows['R'].z)**2
                score = ((origin.y-preferred.y)**2+(origin.z-preferred.z)**2
                         +0.2*symmetry+0.2*(halfspan-0.12)**2)
                if best is None or score < best[0]:
                    best = (score, origin, elbows)
    if best is None:
        raise RuntimeError('No centred Y/Z placement with symmetric rear elbows and <=82% reach')
    _, origin, elbows = best
    world = rig.matrix_world.copy()
    world.translation = origin
    rig.matrix_world = world
    bpy.context.view_layer.update()
    print('CIRCULATOR centred origin', tuple(round(c, 5) for c in origin), 'facing -Y')
    assert origin.x == 0
    for side, p in plans.items():
        p['elbow'] = elbows[side]
        shoulder = bone_head(rig, f'upperarm01.{side}')
        fraction = (p['wrist']-shoulder).length/p['reach']
        upper_error = abs((p['elbow']-shoulder).length-p['upper'])
        print('CIRCULATOR reach preflight', side, 'pct', round(fraction*100, 3),
              'elbow', tuple(round(c, 5) for c in p['elbow']),
              'upper-arm goal error mm', round(upper_error*1000, 5))
        assert fraction <= MAX_REACH_FRACTION and upper_error < 1e-5
    assert abs(plans['L']['elbow'].x+plans['R']['elbow'].x) < 1e-8
    return plans
