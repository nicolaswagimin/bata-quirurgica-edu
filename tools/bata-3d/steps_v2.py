"""Seven-step v2 configuration. Metres, Z up, -Y front; poses in armature space."""
import math

from mathutils import Vector
from hands import pose_hand
from poses import _aim, _rotate, solve_arm

ARM_SPREAD_DEG = 22.5
WRIST_HEIGHT_M = 1.27
WRIST_FORWARD_M = 0.47
ELBOW_FLEXION_DEG = 28.0  # reach fallback target when 47 cm would lock the elbow
ELBOW_POLE = (0.35, 0.0, -1.0)
PALM_DOWN_DEG = 12.0
WAIT_WRIST_HEIGHT_M = 1.18  # cuff midpoint rises to ~1.22 m with neutral wrists
WAIT_WRIST_HALFSPAN_M = 0.18
WAIT_WRIST_FORWARD_M = 0.23  # from the shoulder line, armature -Y
WAIT_POLE_OUTWARD = 0.50
WAIT_FLEXION_RANGE_DEG = (95.0, 110.0)
WAIT_CUFF_HEIGHT_M = (1.20, 1.25)
WAIT_CUFF_SEPARATION_M = (0.18, 0.22)
WAIT_STERNUM_FROM_SHOULDER_M = 0.09

STEPS = {
    1: {'name': 'Secado', 'closure': None, 'hand': 'relaxed', 'pose': None, 'extras': ()},
    2: {'name': 'Tomar bata', 'closure': 'held', 'hand': 'grip', 'pose': None, 'extras': ()},
    3: {'name': 'Despliegue', 'closure': 'held', 'hand': 'grip', 'pose': None, 'extras': ()},
    4: {'name': 'Brazos en las mangas', 'closure': 'open', 'hand': 'tucked',
        'pose': 'forward', 'extras': (), 'gloves': False,
        'views': (('front', 0), ('three', 35)), 'detail': 'hands', 'layout_check': None,
        'triangle_target': 80000, 'cap_elastic_triangles': None, 'cuff_segments': 12, 'cuff_triangle_floor': 4200,
        'hand_clearance_guard': False, 'seam_min_shift_m': 0.0},
    5: {'name': 'Amarre circulante', 'closure': 'tied', 'hand': 'tucked',
        'pose': 'waiting', 'extras': ('back_fastening', 'circulator'), 'gloves': False,
        'views': (('front', 0), ('three', 35), ('back3', 150)), 'detail': 'back',
        'layout_check': 'waiting', 'triangle_target': 76000,
        'cap_elastic_triangles': 720, 'cuff_segments': 6, 'cuff_triangle_floor': 3000,
        'hand_clearance_guard': True, 'seam_min_shift_m': 0.01},
    6: {'name': 'Guantes cerrados', 'closure': 'tied', 'hand': 'glove_flat', 'pose': None, 'extras': ()},
    7: {'name': 'Tarjeta y giro', 'closure': 'wrapped', 'hand': 'grip', 'pose': None, 'extras': ()},
}


# Independent defaults for preparation/finishing scenes; 4/5 remain explicit.
for _step, _pose, _scene, _garment in (
    (1, 'drying', 'preparation', 'none'),
    (2, 'held', 'preparation', 'folded'),
    (3, 'held', 'preparation', 'unfolded'),
    (6, 'gloving', 'worn', 'closed'),
    (7, 'transfer', 'preparation', 'wrapped'),
):
    STEPS[_step].update(pose=_pose, scene=_scene, garment=_garment,
        gloves=_step == 7, views=(('front', 0), ('three', 35)), detail='detail',
        layout_check=None, triangle_target=80000, cap_elastic_triangles=720,
        cuff_segments=6, cuff_triangle_floor=3000, hand_clearance_guard=True,
        seam_min_shift_m=.01)
STEPS[6].update(hand='tucked', extras=('back_fastening', 'loose_glove'))


def config_for(step):
    """Return implemented config or fail before any scene mutation."""
    config = STEPS[step]
    if config.get('pose') is None:
        raise NotImplementedError(f'step {step} pending')
    return config.copy()


def neutral_wrist(rig, side):
    """Align wrist→middle MCP with forearm, then roll thumb up; armature axes.

    Roll about the already aligned hand axis preserves zero wrist deviation.
    Palm normal points medially and 12 degrees down, not up into the camera.
    """
    sign = 1 if side == 'L' else -1
    bone = rig.pose.bones[f'wrist.{side}']
    wrist = bone.head.copy()
    axis = (wrist - rig.pose.bones[f'lowerarm01.{side}'].head).normalized()
    middle = rig.pose.bones[f'finger3-1.{side}'].head - wrist
    _aim(rig, bone.name, wrist, middle, axis)
    desired = Vector((-sign * math.cos(math.radians(PALM_DOWN_DEG)),
                      0, -math.sin(math.radians(PALM_DOWN_DEG))))
    desired = (desired - axis * desired.dot(axis)).normalized()
    across = rig.pose.bones[f'finger2-1.{side}'].head - rig.pose.bones[f'finger5-1.{side}'].head
    across = (across - axis * across.dot(axis)).normalized()
    thumb_up = (desired.cross(axis) * sign).normalized()
    angle = math.atan2(axis.dot(across.cross(thumb_up)), across.dot(thumb_up))
    _rotate(rig, bone.name, wrist, axis, angle)
    middle = rig.pose.bones[f'finger3-1.{side}'].head - wrist
    deviation = math.degrees(axis.angle(middle))
    across = rig.pose.bones[f'finger2-1.{side}'].head - rig.pose.bones[f'finger5-1.{side}'].head
    thumb_up = (across - axis * across.dot(axis)).normalized()
    actual = axis.cross(thumb_up) * sign
    print('WRIST neutral', side, round(deviation, 3), 'deg; palm', tuple(round(c, 3) for c in actual),
          'thumb up', round(thumb_up.z, 3))
    assert deviation < 8, f'{side}: wrist deviation {deviation:.2f} deg'
    assert actual.z < 0 and thumb_up.z > 0, f'{side}: incorrect palm roll'


def pose_forward(rig, config):
    """Symmetric forward arms; solve reach analytically before IK, armature metres."""
    headings = []
    for side, sign in (('L', 1), ('R', -1)):
        shoulder = rig.pose.bones[f'upperarm01.{side}'].head.copy()
        elbow = rig.pose.bones[f'lowerarm01.{side}'].head.copy()
        wrist = rig.pose.bones[f'wrist.{side}'].head.copy()
        l1, l2 = (elbow - shoulder).length, (wrist - elbow).length
        spread = math.tan(math.radians(ARM_SPREAD_DEG))
        dz = WRIST_HEIGHT_M - shoulder.z
        forward = WRIST_FORWARD_M
        def flexion_at(distance):
            reach2 = distance * distance * (1 + spread * spread) + dz * dz
            cosine = (reach2 - l1 * l1 - l2 * l2) / (2 * l1 * l2)
            return math.degrees(math.acos(max(-1, min(1, cosine))))
        # Unreachable/near-locked arms: reduce forward reach symmetrically until
        # at least 20 degrees of flexion; aim at 28 rather than the solver clamp.
        if flexion_at(forward) < 20:
            reach2 = l1*l1 + l2*l2 + 2*l1*l2*math.cos(math.radians(ELBOW_FLEXION_DEG))
            forward = min(forward, math.sqrt(max(0, reach2 - dz*dz) / (1 + spread*spread)))
        target = shoulder + Vector((sign * forward * spread, -forward, dz))
        solve_arm(rig, side, target, Vector((sign * ELBOW_POLE[0], ELBOW_POLE[1], ELBOW_POLE[2])))
        pose_hand(rig, side, config['hand'])
        neutral_wrist(rig, side)
        elbow = rig.pose.bones[f'lowerarm01.{side}'].head.copy()
        wrist = rig.pose.bones[f'wrist.{side}'].head.copy()
        flexion = math.degrees((elbow - shoulder).angle(wrist - elbow))
        headings.append(math.degrees(math.atan2(wrist.x-shoulder.x, shoulder.y-wrist.y)))
        print('ARM', side, 'flexion', round(flexion, 1), 'forward', round(forward, 4),
              'requested', WRIST_FORWARD_M, 'top-view spread deg', 2*ARM_SPREAD_DEG, 'wrist', tuple(round(c, 3) for c in wrist),
              'elbow', tuple(round(c, 3) for c in elbow))
        assert 20 <= flexion <= 30, f'{side}: elbow flexion {flexion:.2f} outside range'
    heading_span = abs(headings[0]-headings[1])
    print('ARM separation top view deg', round(heading_span, 3))
    assert abs(heading_span-45.0) < 0.1, 'Arms must diverge 45 degrees in top view'


def pose_waiting(rig, config):
    """Waiting posture, armature metres: elbows low/outside, forearms rising -Y."""
    for side, sign in (('L', 1), ('R', -1)):
        shoulder = rig.pose.bones[f'upperarm01.{side}'].head.copy()
        target = Vector((sign*WAIT_WRIST_HALFSPAN_M,
                         shoulder.y-WAIT_WRIST_FORWARD_M, WAIT_WRIST_HEIGHT_M))
        solve_arm(rig, side, target, Vector((sign*WAIT_POLE_OUTWARD, 0, -1)))
        pose_hand(rig, side, config['hand'])
        neutral_wrist(rig, side)
        elbow = rig.pose.bones[f'lowerarm01.{side}'].head.copy()
        wrist = rig.pose.bones[f'wrist.{side}'].head.copy()
        flexion = math.degrees((elbow-shoulder).angle(wrist-elbow))
        print('ARM waiting', side, 'flexion', round(flexion, 2),
              'elbow', tuple(round(c, 3) for c in elbow),
              'wrist', tuple(round(c, 3) for c in wrist),
              'elbow lateral offset cm', round(abs(elbow.x-shoulder.x)*100, 2))
        assert WAIT_FLEXION_RANGE_DEG[0] <= flexion <= WAIT_FLEXION_RANGE_DEG[1]
        assert elbow.z < wrist.z and elbow.y < shoulder.y, 'Waiting elbows must be low and slightly forward'


def pose_step_v2(rig, step):
    """Dispatch pose from STEPS; metres, Z up, figure faces -Y."""
    config = config_for(step)
    if config['pose'] in ('forward', 'waiting'):
        {'forward': pose_forward, 'waiting': pose_waiting}[config['pose']](rig, config)
    else:
        from preparation_poses_v2 import pose_preparation
        pose_preparation(rig, config)


def check_layout(rig, layouts, config):
    """Optional configured cuff-position check, world metres, Z up."""
    if config['layout_check'] is None:
        return
    from gown import bone_head
    centers = [p['wrist']+p['axis']*((p['start']+p['end'])/2)
               + p['across']*p['offset'][0]+p['normal']*p['offset'][1]
               for p in layouts.values()]
    separation = abs(centers[0].x-centers[1].x)
    sternum = bone_head(rig, 'upperarm01.L').y-WAIT_STERNUM_FROM_SHOULDER_M
    print('WAIT cuffs', 'separation cm', round(separation*100, 2),
          'heights m', [round(c.z, 3) for c in centers],
          'forward from sternum cm', [round((sternum-c.y)*100, 2) for c in centers])
    assert WAIT_CUFF_SEPARATION_M[0] <= separation <= WAIT_CUFF_SEPARATION_M[1]
    assert all(WAIT_CUFF_HEIGHT_M[0] <= c.z <= WAIT_CUFF_HEIGHT_M[1] for c in centers)
