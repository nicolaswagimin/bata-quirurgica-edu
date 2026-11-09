"""Stdlib geometry regressions; python3 test_sleeve_guard_v2.py (no Blender).

Metres, Z up, -Y front. Tests actual triangle constraints and pose-local frames,
not a substitute for a Blender render or full cloth simulation.
"""
import bisect
import math
import sys
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch

from test_circulator_ik_v2 import Vec, World, load_functions


def kernels():
    ns = dict(math=math, bisect=bisect, Vector=Vec, HAND_CLEARANCE_M=0.010)
    load_functions('cuffs_v2.py', ns, {'coordinates', 'cuff_axes', 'inside_cuff'})
    load_functions('sleeve_seam_v2.py', ns, {'seam_polygon', 'cuff_radius', 'taper_radius', 'choose_seams'})
    load_functions('hand_coverage_v2.py', ns, {'local_skin', 'sleeve_membership'})
    load_functions('sleeve_guard_v2.py', ns,
                   {'prepare_guard', 'guarded_taper_radius', 'barycentric', 'repair_sample'})
    return ns


def profile(rotated=False):
    axis = Vec((.4, -.8, .3)).normalized() if rotated else Vec((0, 1, 0))
    across = Vec((1, 0, 0))
    across = (across-axis*across.dot(axis)).normalized()
    return dict(wrist=Vec((.2, -.3, 1.2)), axis=axis, across=across,
                normal=axis.cross(across).normalized(), offset=(0, 0),
                start=.1237, end=.1937, sleeve_end=.1337, mid=(.0484, .0303),
                palm_radius=.0627, hand_envelope_radius=.0587, hand_start=-.03)


def point(p, axial, x, y=0):
    return p['wrist']+p['axis']*axial+p['across']*x+p['normal']*y


class SleeveGuardTests(unittest.TestCase):
    def setUp(self):
        self.ns = kernels()

    def test_distal_waiting_seam_and_ten_mm_plateau_in_any_pose(self):
        for rotated in (False, True):
            p = profile(rotated)
            skin = [point(p, .12, .05), point(p, .07, .045)]
            self.ns['prepare_guard']({'R': p}, {'R': skin}, True)
            module = NS(guarded_taper_radius=self.ns['guarded_taper_radius'],
                        MIN_TAPER_RUN_M=self.ns['MIN_TAPER_RUN_M'])
            with patch.dict(sys.modules, {'sleeve_guard_v2': module}):
                self.ns['choose_seams']({'R': p}, {'R': skin}, minimum_shift_m=.01)
            self.assertGreaterEqual(p['sleeve_end']-(p['start']+.01), .01-1e-12)
            for skin_point in skin:
                z, radial, angle = self.ns['local_skin'](skin_point, p)
                self.assertGreaterEqual(self.ns['guarded_taper_radius'](z, angle, p)-radial.length, .010)
            for angle in (0, .7, 1.4):
                stitch = self.ns['guarded_taper_radius'](p['sleeve_end'], angle, p)
                self.assertAlmostEqual(stitch-self.ns['cuff_radius'](p, angle), .0015)

    def test_disabled_guard_does_not_change_approved_profile(self):
        p = profile()
        before = dict(p)
        self.ns['prepare_guard']({'L': p}, {'L': [point(p, .12, .05)]}, False)
        self.assertEqual(p, before)

    def test_actual_tube_volume_ignores_closer_unrelated_panel(self):
        p = profile()
        skin = point(p, .05, .04)
        class Tube:
            def ray_cast(self, center, direction, maximum):
                return center+direction*.06, direction, 0, .06
        inside, _, _, _, margin = self.ns['sleeve_membership'](Tube(), p, skin)
        self.assertTrue(inside)
        self.assertAlmostEqual(margin, .02)
        # A nearby outer torso plane is not the boundary of this sleeve volume.
        unrelated = skin-p['across']*.005
        self.assertGreater((skin-unrelated).dot(p['across']), 0)
        outside = self.ns['sleeve_membership'](Tube(), p, point(p, .05, .061))[0]
        self.assertFalse(outside)
        past_seam = self.ns['sleeve_membership'](Tube(), p, point(p, p['sleeve_end']+.001, .02))[0]
        self.assertFalse(past_seam)

    def test_triangle_chord_repair_preserves_sewn_corner(self):
        p = profile()
        p.update(wrist=Vec(), axis=Vec((0, 1, 0)), across=Vec((1, 0, 0)), normal=Vec((0, 0, 1)))
        original = [Vec((.035, 0, -.02)), Vec((.035, .1, -.02)), Vec((.035, .05, .02))]
        gown = NS(matrix_world=World(Vec()), data=NS(vertices=[NS(co=v) for v in original]))
        origin, direction = Vec((0, .05, 0)), Vec((1, 0, 0))
        for _ in range(4):
            a, b, c = (v.co for v in gown.data.vertices)
            normal = (b-a).cross(c-a)
            radius = normal.dot(a-origin)/normal.dot(direction)
            if radius-.03 >= .010:
                break
            hit = origin+direction*radius
            shifts = {}
            self.ns['repair_sample'](gown, p, {0, 1, 2}, {0}, (0, 1, 2), hit, direction,
                                     .04-radius+.0005, shifts)
            self.assertNotIn(0, shifts)
            for index, (distance, envelope_normal) in shifts.items():
                gown.data.vertices[index].co += envelope_normal*distance
        self.assertGreaterEqual(radius-.03, .010)
        self.assertEqual(gown.data.vertices[0].co.xyz, original[0].xyz)


if __name__ == '__main__':
    unittest.main()
