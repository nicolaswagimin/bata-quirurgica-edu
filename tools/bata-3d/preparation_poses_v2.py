"""Preparation/gloving/transfer poses; armature metres, Z up, front -Y."""
import math
import bpy
from mathutils import Vector
from poses import solve_arm, orient_hand, _rotate
from hands import pose_hand

HELD_FORWARD_M = 0.40
HELD_HEIGHT_M = 1.38
UNFOLD_HEIGHT_M = 1.40
DRY_LEAN_DEG = 10


def place(rig, side, target, fingers, thumb, preset):
    """Reach a wrist target in armature metres, retaining anatomical fingers."""
    sign = 1 if side == 'L' else -1
    solve_arm(rig, side, Vector(target), Vector((sign*.65, .1, -1)))
    orient_hand(rig, side, Vector(fingers).normalized(), Vector(thumb))
    pose_hand(rig, side, preset)
    actual = rig.pose.bones[f'wrist.{side}'].head
    error = (actual-Vector(target)).length
    shoulder=rig.pose.bones[f'upperarm01.{side}'].head
    elbow=rig.pose.bones[f'lowerarm01.{side}'].head
    flexion=math.degrees((elbow-shoulder).angle(actual-elbow))
    print('POSE wrist target', side, 'error mm', round(error*1000, 3),
          'elbow flexion deg',round(flexion,2),'preset',preset)
    assert error < .005, f'{side}: preparation wrist target unreachable'


def drying(rig, config):
    """Lean torso toward -Y, then hold left arm up and towel at its midpoint."""
    bone = next((rig.pose.bones.get(n) for n in ('spine02', 'spine01') if rig.pose.bones.get(n)), None)
    if bone is None:
        raise RuntimeError('No spine bone available for drying lean')
    _rotate(rig, bone.name, bone.head.copy(), Vector((1, 0, 0)), math.radians(DRY_LEAN_DEG))
    place(rig, 'L', (.10, -.28, 1.20), (0, -.2, 1), (1, 0, 0), 'relaxed')
    elbow = rig.pose.bones['lowerarm01.L'].head.copy()
    wrist = rig.pose.bones['wrist.L'].head.copy()
    mid = (elbow+wrist)/2
    place(rig, 'R', mid+Vector((-.025, -.065, .025)), (1, 0, .1), (0, 0, 1), 'grip')
    print('DRY torso lean deg', DRY_LEAN_DEG, 'wipe left forearm midpoint', tuple(mid))


def held(rig, config):
    """Both grips on inner neck; symmetric shoulder-height suspension, metres."""
    spread = .055 if config['garment'] == 'folded' else .22
    height = HELD_HEIGHT_M if config['garment'] == 'folded' else UNFOLD_HEIGHT_M
    for side, sign in (('L', 1), ('R', -1)):
        place(rig, side, (sign*spread, -HELD_FORWARD_M, height),
              (0, -.1, -1), (-sign, 0, 0), 'grip')


def gloving(rig, config):
    """Left palm up, right covered fingertips at free glove cuff, metres."""
    place(rig, 'L', (.12, -.22, 1.19), (0, -1, .12), (1, 0, 0), 'tucked')
    place(rig, 'R', (-.04, -.37, 1.25), (.91, -.40, .11), (0, 0, 1), 'tucked')


def transfer(rig, config):
    """Retain left tie above waist; right hand reaches across to front-left."""
    place(rig, 'L', (.12, -.30, 1.10), (0, -1, -.1), (1, 0, 0), 'grip')
    place(rig, 'R', (.12, -.25, 1.17), (1, -.25, .1), (0, 0, 1), 'pinch')


def pose_preparation(rig, config):
    """Dispatch exclusively from the STEPS pose value; armature metres."""
    {'drying': drying, 'held': held, 'gloving': gloving,
     'transfer': transfer}[config['pose']](rig, config)
    bpy.context.view_layer.update()
