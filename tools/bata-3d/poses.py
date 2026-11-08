"""Arm IK and the protocol poses. Coordinates: armature space (rig at origin, faces -Y).
Positions are for the figure's left arm (+X); the right arm mirrors them unless given explicitly."""
import math

import bpy
from mathutils import Matrix, Vector

CURL_SEGMENTS = ("1", "2", "3")


def _head(rig, name):
    return rig.pose.bones[name].head.copy()


def _rotate(rig, name, pivot, axis, angle):
    if axis.length < 1e-6 or abs(angle) < 1e-5:
        return
    bone = rig.pose.bones[name]
    rot = Matrix.Rotation(angle, 4, axis.normalized())
    bone.matrix = Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot) @ bone.matrix
    bpy.context.view_layer.update()


def _aim(rig, name, pivot, current, target):
    _rotate(rig, name, pivot, current.cross(target), current.angle(target, 0.0))


def solve_arm(rig, side, wrist, pole):
    """Two-bone IK: puts the wrist at `wrist` with the elbow bending towards `pole`."""
    upper, fore, hand = f"upperarm01.{side}", f"lowerarm01.{side}", f"wrist.{side}"
    a, b, c = _head(rig, upper), _head(rig, fore), _head(rig, hand)
    l1, l2 = (b - a).length, (c - b).length
    to_target = wrist - a
    d = min(to_target.length, (l1 + l2) * 0.995)
    direction = to_target.normalized()
    along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    height = math.sqrt(max(l1 * l1 - along * along, 0.0))
    perpendicular = (pole - direction * pole.dot(direction)).normalized()
    elbow = a + direction * along + perpendicular * height
    _aim(rig, upper, a, b - a, elbow - a)
    b, c = _head(rig, fore), _head(rig, hand)
    _aim(rig, fore, b, c - b, (a + direction * d) - b)


def orient_hand(rig, side, fingers, thumb):
    """Points the fingers along `fingers`, turning the hand so the thumb side faces `thumb`."""
    hand = f"wrist.{side}"
    pivot = _head(rig, hand)
    knuckles = (_head(rig, f"finger2-1.{side}") + _head(rig, f"finger5-1.{side}")) / 2
    _aim(rig, hand, pivot, knuckles - pivot, fingers)
    knuckles = (_head(rig, f"finger2-1.{side}") + _head(rig, f"finger5-1.{side}")) / 2
    axis = (knuckles - pivot).normalized()
    across = _head(rig, f"finger2-1.{side}") - _head(rig, f"finger5-1.{side}")
    across -= axis * across.dot(axis)
    goal = thumb - axis * thumb.dot(axis)
    angle = across.angle(goal, 0.0)
    if across.cross(goal).dot(axis) < 0:
        angle = -angle
    _rotate(rig, hand, pivot, axis, angle)


def curl_fingers(rig, side, amount):
    """Closes the four fingers by `amount` radians per joint, towards the palm."""
    pivot = _head(rig, f"wrist.{side}")
    knuckles = (_head(rig, f"finger2-1.{side}") + _head(rig, f"finger5-1.{side}")) / 2
    forward = (knuckles - pivot).normalized()
    thumb = (_head(rig, f"finger2-1.{side}") - _head(rig, f"finger5-1.{side}")).normalized()
    palm = forward.cross(thumb) if side == "L" else thumb.cross(forward)
    axis = forward.cross(palm).normalized()
    for finger in ("2", "3", "4", "5"):
        for segment in CURL_SEGMENTS:
            name = f"finger{finger}-{segment}.{side}"
            _rotate(rig, name, _head(rig, name), axis, amount)


def place_hand(rig, side, wrist, pole, fingers, thumb, curl=0.0):
    solve_arm(rig, side, Vector(wrist), Vector(pole))
    orient_hand(rig, side, Vector(fingers).normalized(), Vector(thumb).normalized())
    if curl:
        curl_fingers(rig, side, curl)


def mirrored(side, vector):
    return (vector[0] * (1 if side == "L" else -1), vector[1], vector[2])


def symmetric(rig, wrist, pole, fingers, thumb, curl=0.0):
    for side in ("L", "R"):
        place_hand(
            rig, side, mirrored(side, wrist), mirrored(side, pole),
            mirrored(side, fingers), mirrored(side, thumb), curl,
        )


def pose_step(rig, step):
    if step == 1:  # Clean hands held up in front of the chest, fingers to the ceiling.
        symmetric(rig, (0.2, -0.24, 1.2), (0.7, 0.3, -1), (0.02, -0.12, 1), (1, -0.3, 0), 0.06)
    elif step == 2:  # Holding the gown by the inside of the neck, away from the body.
        symmetric(rig, (0.15, -0.33, 1.36), (0.8, 0.1, -1), (-0.1, -1, 0.1), (-0.1, 0, 1), 0.5)
    elif step == 3:  # Arms forward inside the sleeves, hands covered.
        symmetric(rig, (0.2, -0.45, 1.24), (0.7, 0, -1), (0, -1, 0.1), (-0.6, 0, 1), 0.3)
    elif step == 4:  # Wait while the circulator fastens the back. Elbows low, covered hands at chest.
        symmetric(rig, (0.14, -0.27, 1.28), (0.6, 0.1, -1), (-0.35, -0.45, 0.82), (-0.6, 0, 1), 0.3)
    elif step == 5:  # Hands together in front of the chest, seating the gloves over the cuffs.
        symmetric(rig, (0.1, -0.33, 1.15), (0.8, 0.1, -1), (-0.65, -0.7, 0.3), (0, -0.2, 1), 0.2)
    elif step == 6:  # Tying the front bow, hands kept above the waist.
        symmetric(rig, (0.1, -0.27, 1.07), (0.8, 0.1, -1), (-0.72, -0.62, -0.28), (0.1, -0.2, 1), 0.5)
    else:
        raise ValueError(step)
