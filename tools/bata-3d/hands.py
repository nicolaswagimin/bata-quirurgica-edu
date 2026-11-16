"""Reusable MPFB finger poses. Metres, Z up, figure faces -Y; armature space."""
import math

from poses import _aim, _head, _rotate, orient_hand

PRESETS = {
    'relaxed': ((15, 20, 10), (20, 25, 12), (25, 30, 15), (30, 35, 18)),
    'pinch': ((55, 75, 35), (50, 65, 30), (55, 70, 35), (60, 75, 40)),
    'grip': ((45, 65, 35), (50, 70, 40), (55, 75, 45), (60, 80, 50)),
    'tucked': ((10, 15, 8), (12, 16, 8), (14, 18, 10), (16, 20, 10)),
    'glove_flat': ((5, 8, 4),) * 4,
}


def hand_frame(rig, side):
    """Return finger direction, thumb-side vector and anatomical palm normal."""
    index = _head(rig, f'finger2-1.{side}')
    pinky = _head(rig, f'finger5-1.{side}')
    forward = ((index + pinky) / 2 - _head(rig, f'wrist.{side}')).normalized()
    across = index - pinky
    across = (across - forward * across.dot(forward)).normalized()
    palm = forward.cross(across) * (1 if side == 'L' else -1)
    return forward, across, palm.normalized()


def pose_hand(rig, side, preset='relaxed'):
    """Set an absolute finger preset; preserve wrist orientation (armature axes).

    glove_flat turns the palm up while retaining the finger direction.
    Flexion axes are recomputed
    at every joint from its posed direction cross the transported palm normal.
    Metacarpals remain unmodified; repeated calls reset only finger bones.
    """
    if side not in ('L', 'R'):
        raise ValueError(side)
    flexions = PRESETS[preset]
    import bpy
    for finger in range(1, 6):
        for joint in range(1, 4):
            rig.pose.bones[f'finger{finger}-{joint}.{side}'].matrix_basis.identity()
    bpy.context.view_layer.update()
    forward, across, palm = hand_frame(rig, side)
    if preset == 'glove_flat':
        from mathutils import Vector
        up = Vector((0, 0, 1))
        up -= forward * up.dot(forward)
        if up.length < 1e-5:
            raise ValueError('glove_flat needs a nonvertical finger direction')
        orient_hand(rig, side, forward, up.normalized().cross(forward) * (1 if side == 'L' else -1))
        _, across, palm = hand_frame(rig, side)
    wrist = rig.pose.bones[f'wrist.{side}'].matrix.to_3x3()
    palm_local = wrist.inverted() @ palm
    for finger, angles, spread in zip(range(2, 6), flexions, (-4, 0, 3, 6)):
        name = f'finger{finger}-1.{side}'
        bone = rig.pose.bones[name]
        # Positive spread is towards the little finger on either mirrored hand.
        if preset == 'tucked':
            # Remove the stock rig's fan, not just the additional preset fan.
            _aim(rig, name, bone.head.copy(), bone.tail - bone.head, forward)
        direction = (bone.tail - bone.head).normalized()
        away = -across
        fan_axis = direction.cross(away).normalized()
        _rotate(rig, name, bone.head.copy(), fan_axis,
                math.radians(0 if preset in ('glove_flat', 'tucked') else spread))
        for joint, degrees in enumerate(angles, 1):
            name = f'finger{finger}-{joint}.{side}'
            bone = rig.pose.bones[name]
            # Store the palm in this joint's local frame before rotating: descendants
            # transport it with their parents, including the MCP fan rotation.
            local_palm = bone.matrix.to_3x3().inverted() @ (
                rig.pose.bones[f'wrist.{side}'].matrix.to_3x3() @ palm_local)
            if joint > 1:
                local_palm = transported
            normal = bone.matrix.to_3x3() @ local_palm
            axis = (bone.tail - bone.head).normalized().cross(normal).normalized()
            child = rig.pose.bones.get(f'finger{finger}-{joint + 1}.{side}')
            child_normal = child.matrix.to_3x3().inverted() @ normal if child else None
            _rotate(rig, name, bone.head.copy(), axis, math.radians(degrees))
            transported = child_normal
    if preset == 'tucked':
        # Straighten/adduct in the palm plane alongside the index. No rotation
        # about the finger direction (opposition), and no flexion into the palm.
        for joint in range(1, 4):
            name = f'finger1-{joint}.{side}'
            bone = rig.pose.bones[name]
            target = (forward - across * 0.10).normalized()
            _aim(rig, name, bone.head.copy(), bone.tail - bone.head, target)
        return
    if preset == 'pinch':
        pinch_thumb(rig, side)
        return
    # Thumb adduction/opposition uses the hand frame, then each thumb joint's
    # own longitudinal direction; no world-axis rotations or mirrored Euler hacks.
    name = f'finger1-1.{side}'
    bone = rig.pose.bones[name]
    toward_index = _head(rig, f'finger2-1.{side}') - bone.head
    axis = (bone.tail - bone.head).cross(toward_index).normalized()
    _rotate(rig, name, bone.head.copy(), axis, math.radians(25 if preset == 'grip' else 10))
    for joint, degrees in enumerate((22, 28, 15) if preset == 'grip' else (8, 12, 8), 1):
        name = f'finger1-{joint}.{side}'
        bone = rig.pose.bones[name]
        normal = rig.pose.bones[f'wrist.{side}'].matrix.to_3x3() @ palm_local
        axis = (bone.tail - bone.head).normalized().cross(normal).normalized()
        _rotate(rig, name, bone.head.copy(), axis, math.radians(degrees))


def pinch_thumb(rig, side):
    """Oppose thumb pad to index pad with CCD; armature metres, anatomical frame.

    Only the pinch preset uses this solver. Thumb base can oppose across the
    palm; distal thumb joints follow their own posed directions toward the pad.
    """
    _, _, palm = hand_frame(rig, side)
    target = rig.pose.bones[f'finger2-3.{side}'].tail.copy()+palm*0.006
    for _ in range(12):
        for joint in (3, 2, 1):
            name = f'finger1-{joint}.{side}'
            bone = rig.pose.bones[name]
            tip = rig.pose.bones[f'finger1-3.{side}'].tail.copy()
            _aim(rig, name, bone.head.copy(), tip-bone.head, target-bone.head)
    gap = (rig.pose.bones[f'finger1-3.{side}'].tail-target).length
    print('PINCH thumb-index pad error mm', side, round(gap*1000, 3))
    assert gap <= 0.012, f'{side}: thumb cannot reach index pad'
