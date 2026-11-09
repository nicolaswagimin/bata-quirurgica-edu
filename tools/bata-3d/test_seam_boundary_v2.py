"""Close-cuff seam regressions: stdlib only, no Blender execution."""
import math
import sys
import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

from seam_boundary_v2 import nearest_boundary_loop, restore_owned_rims, owned_rim_restoration, sleeve_boundary
from test_circulator_ik_v2 import Vec, World, load_functions


class Vertex:
    def __init__(self, co):
        self.co = co
        self.weights = {}

    def __getitem__(self, layer):
        return self.weights


class Edge:
    is_boundary = True

    def __init__(self, a, b):
        self.verts = (a, b)


def ring(center, radius=.03, count=32):
    vertices = [Vertex(center+Vec((radius*math.cos(2*math.pi*i/count),
                                  radius*math.sin(2*math.pi*i/count), 0)))
                for i in range(count)]
    return vertices, [Edge(v, vertices[(i+1) % count]) for i, v in enumerate(vertices)]


def mesh(edges):
    return NS(edges=edges, from_mesh=lambda data: None, to_mesh=lambda data: None,
              free=lambda: None)


def profile(center):
    return dict(rim=center, wrist=center, axis=Vec((0, 0, 1)), across=Vec((1, 0, 0)),
                normal=Vec((0, 1, 0)), offset=(0, 0), sleeve_end=0, owned_seam=True)


class SeamBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.left, self.right = Vec(), Vec((.055, 0, .01))
        self.lv, self.le = ring(self.left)
        self.rv, self.re = ring(self.right)
        self.edges = self.le+self.re
        self.gown = NS(matrix_world=World(Vec()), data=NS(update=lambda: None))
        self.layouts = {'L': profile(self.left), 'R': profile(self.right)}

    def test_close_opposite_rim_is_excluded_as_a_whole(self):
        # The old 8 cm sphere admits part of R into L.
        old = [e for e in self.re if all((v.co-self.left).length < .08 for v in e.verts)]
        self.assertTrue(old)
        for center, expected in ((self.left, self.le), (self.right, self.re)):
            self.assertEqual(nearest_boundary_loop(self.edges, lambda v: v.co, center), set(expected))

    def test_coincident_cuffs_keep_distinct_authored_islands(self):
        # Even exactly coincident openings retain their separate sleeve identity.
        left, le = ring(Vec())
        right, re = ring(Vec())
        for v in left:
            v.weights = {0: 1}
        for v in right:
            v.weights = {1: 1}
        bm = mesh(le+re)
        bm.verts = NS(layers=NS(deform=NS(active=object())))
        self.gown.vertex_groups = NS(get=lambda name: NS(index={'left':0,'right':1}[name]))
        for name, expected in (('left',le),('right',re)):
            p = profile(Vec())
            p['seam_group'] = name
            self.assertEqual(sleeve_boundary(self.gown,bm,p),set(expected))

    def test_displaced_section_is_retained_for_validation(self):
        self.lv[0].co = Vec((.09, 0, 0))
        self.assertEqual(nearest_boundary_loop(self.edges, lambda v: v.co, self.left), set(self.le))

    def test_open_fragment_is_not_accepted_as_a_seam(self):
        with self.assertRaisesRegex(RuntimeError, 'No closed'):
            nearest_boundary_loop(self.le[:-1], lambda v: v.co, self.left)

    def test_restore_keeps_each_loop_in_its_own_plane(self):
        bm = mesh(self.edges)
        with patch.dict(sys.modules, {
            'bmesh': NS(new=lambda: bm),
            'sleeve_seam_v2': NS(SEAM_ALLOWANCE_M=.0015, cuff_radius=lambda p, a: .03),
        }):
            restore_owned_rims(self.gown, self.layouts)
        for center, vertices in ((self.left, self.lv), (self.right, self.rv)):
            for vertex in vertices:
                self.assertAlmostEqual((vertex.co-center).length, .0315)
                self.assertAlmostEqual(vertex.co.z, center.z)

    def test_real_gap_assertion_still_rejects_displaced_owned_edge(self):
        ns = dict(math=math, cuff_radius=lambda p, a: .03)
        load_functions('sleeve_seam_v2.py', ns, {'assert_seam_gap'})
        with patch.dict(sys.modules, {'bmesh': NS(new=lambda: mesh(self.edges))}):
            ns['assert_seam_gap'](self.gown, self.layouts)
            self.lv[0].co = Vec((.04, 0, 0))
            with self.assertRaisesRegex(AssertionError, '4.5 mm'):
                ns['assert_seam_gap'](self.gown, self.layouts)

    def test_legacy_restorer_untouched_when_disabled_and_restored_on_error(self):
        original = object()
        module = NS(restore_sleeve_rims_v2=original)
        with patch.dict(sys.modules, {'gown': module}):
            with owned_rim_restoration(False):
                self.assertIs(module.restore_sleeve_rims_v2, original)
            with self.assertRaisesRegex(RuntimeError, 'abort'):
                with owned_rim_restoration(True):
                    self.assertIs(module.restore_sleeve_rims_v2, restore_owned_rims)
                    raise RuntimeError('abort')
            self.assertIs(module.restore_sleeve_rims_v2, original)


if __name__ == '__main__':
    unittest.main()
