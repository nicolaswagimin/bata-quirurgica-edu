"""Numerical reach/contact regressions; python3 test_circulator_ik_v2.py.

Uses stdlib only: load numerical function ASTs without importing bpy/Blender.
Metres, Z up, both characters face -Y. Does not validate a Blender render.
"""
import ast
import contextlib
import io
import math
from pathlib import Path
from types import SimpleNamespace as NS
import unittest

HERE = Path(__file__).resolve().parent


class Vec:
    def __init__(self, xyz=(0, 0, 0)):
        self.xyz = tuple(xyz)

    def __add__(self, other):
        return Vec(a+b for a, b in zip(self.xyz, other.xyz))

    def __sub__(self, other):
        return Vec(a-b for a, b in zip(self.xyz, other.xyz))

    def __mul__(self, scalar):
        return Vec(v*scalar for v in self.xyz)

    def __truediv__(self, scalar):
        return self*(1/scalar)

    def __iter__(self):
        return iter(self.xyz)

    x = property(lambda self: self.xyz[0])
    y = property(lambda self: self.xyz[1])
    z = property(lambda self: self.xyz[2])
    length_squared = property(lambda self: self.dot(self))
    length = property(lambda self: math.sqrt(self.length_squared))

    def dot(self, other):
        return sum(a*b for a, b in zip(self.xyz, other.xyz))

    def cross(self, other):
        x, y, z = self.xyz
        a, b, c = other.xyz
        return Vec((y*c-z*b, z*a-x*c, x*b-y*a))

    def normalized(self):
        return self/self.length

    def normalize(self):
        self.xyz = self.normalized().xyz

    def lerp(self, other, t):
        return self*(1-t)+other*t

    def copy(self):
        return Vec(self.xyz)


class World:
    def __init__(self, origin):
        self.translation = origin

    def copy(self):
        return World(self.translation.copy())

    def inverted(self):
        return World(self.translation*-1)

    def __matmul__(self, point):
        return self.translation+point

    def to_3x3(self):
        return Rotation()


class Rotation:
    def __matmul__(self, vector):
        return vector


class Rig:
    def __init__(self):
        self.matrix_world = World(Vec((-.10, .66, -.28)))
        self.lengths = {'L': (.247, .229), 'R': (.225, .215)}
        self.offsets = {'L': Vec((.012, -.055, .065)), 'R': Vec((-.012, -.055, .065))}
        self.wrists = {}

    def head(self, name):
        name, side = name.split('.')
        sign = 1 if side == 'L' else -1
        point = Vec((sign*.164, -.025, 1.34))
        upper, forearm = self.lengths[side]
        if name == 'lowerarm01':
            point += Vec((sign*upper, 0, 0))
        if name == 'wrist':
            if side in self.wrists:
                return self.wrists[side]
            point += Vec((sign*(upper+forearm), 0, 0))
        return self.matrix_world @ point

    def tail(self, name):
        side = name[-1]
        return self.head('wrist.'+side)+self.offsets[side]


def load_functions(name, namespace, selected=None):
    tree = ast.parse((HERE/name).read_text())
    nodes = [n for n in tree.body if isinstance(n, ast.Assign)
             or isinstance(n, ast.FunctionDef) and (selected is None or n.name in selected)]
    exec(compile(ast.Module(body=nodes, type_ignores=[]), name, 'exec'), namespace)


def planner_namespace():
    namespace = dict(math=math, Vector=Vec,
                     bone_head=lambda rig, name: rig.head(name),
                     bone_tail=lambda rig, name: rig.tail(name),
                     orient_hand=lambda *args: None, pose_hand=lambda *args: None,
                     bpy=NS(context=NS(view_layer=NS(update=lambda: None))))
    load_functions('circulator_ik_v2.py', namespace)
    return namespace


class ReachTests(unittest.TestCase):
    def setUp(self):
        self.rig = Rig()
        self.targets = {'L': Vec((.035, .200, .981)), 'R': Vec((-.035, .210, .915))}
        self.ns = planner_namespace()

    def plan(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return self.ns['plan_contacts'](self.rig, self.targets)

    def test_asymmetric_unreachable_right_arm_gets_bilateral_margin(self):
        right_wrist = self.targets['R']-self.rig.offsets['R']
        old_ratio = (right_wrist-self.rig.head('upperarm01.R')).length/sum(self.rig.lengths['R'])
        self.assertGreater(old_ratio, 1.0)
        original_targets = {s: p.xyz for s, p in self.targets.items()}
        plans = self.plan()
        self.assertEqual(self.rig.matrix_world.translation.x, 0)
        self.assertAlmostEqual(plans['L']['elbow'].x, -plans['R']['elbow'].x)
        self.assertGreaterEqual(plans['L']['elbow'].x, .12)
        self.assertLessEqual(plans['L']['elbow'].x, .18)
        for side, plan in plans.items():
            shoulder = self.rig.head('upperarm01.'+side)
            self.assertLessEqual((plan['wrist']-shoulder).length/plan['reach'], .82)
            self.assertAlmostEqual((plan['elbow']-shoulder).length, plan['upper'])
            self.assertAlmostEqual((plan['wrist']-plan['elbow']).length, plan['forearm'])
            direction = (plan['wrist']-plan['elbow']).normalized()
            self.assertLess(direction.y, -.70)
            self.assertLess(abs(direction.x), .65)
            self.assertLess(direction.x*(1 if side == 'L' else -1), 0)
        self.assertEqual(original_targets, {s: p.xyz for s, p in self.targets.items()})

    def test_both_sides_keep_own_lr_direction_facing_minus_y(self):
        self.assertLess(self.ns['pinch_direction']('L').x, 0)
        self.assertGreater(self.ns['pinch_direction']('R').x, 0)
        self.assertLess(self.ns['pinch_direction']('L').y, 0)
        self.assertLess(self.ns['pinch_direction']('R').y, 0)

    def test_measured_pad_correction_converges_and_logs_each_right_iteration(self):
        plans = self.plan()
        # Simulate a small post-orientation offset absent from calibration.
        self.rig.offsets['R'] += Vec((0, .003, 0))
        clamps = []

        def solve(rig, side, local_wrist, pole):
            goal = rig.matrix_world @ local_wrist
            shoulder = rig.head('upperarm01.'+side)
            vector = goal-shoulder
            maximum = sum(rig.lengths[side])*.995
            actual = shoulder+vector.normalized()*min(vector.length, maximum)
            rig.wrists[side] = actual
            clamps.append((actual-goal).length)

        self.ns.update(solve_arm=solve, contact_point=lambda rig, side: rig.tail('finger2-3.'+side))
        load_functions('circulator_v2.py', self.ns, {'pose_contact'})
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            for side in ('L', 'R'):
                self.ns['pose_contact'](self.rig, side, self.targets[side], plans[side])
        for side in ('L', 'R'):
            self.assertLess((self.targets[side]-self.rig.tail('finger2-3.'+side)).length, .005)
        self.assertLess(max(clamps), 1e-10)
        self.assertIn('IK R iteration 1 pad error mm 3.0', output.getvalue())
        self.assertIn('IK R iteration 2 pad error mm 0.0', output.getvalue())
        self.assertIn('wrist clamp mm 0.0', output.getvalue())

    def test_impossible_centred_elbow_goal_is_rejected(self):
        result = self.ns['centred_elbow'](Vec(), Vec((0, 2, 0)), .2, .2, .14)
        self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main()
