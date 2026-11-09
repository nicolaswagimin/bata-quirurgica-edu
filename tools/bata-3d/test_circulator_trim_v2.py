"""Read-only visibility / real-cut regressions; stdlib only, no Blender.

Run python3 test_circulator_trim_v2.py. World metres, Z up, -Y front.
"""
import ast
import contextlib
import io
import math
from pathlib import Path
from types import SimpleNamespace as NS
import unittest

from test_circulator_ik_v2 import Vec, World, load_functions

HERE = Path(__file__).resolve().parent


def scene():
    vertices = [NS(co=Vec((.24*math.cos(2*math.pi*j/32), .16*math.sin(2*math.pi*j/32), z)))
                for z in (.7, 1.0, 1.2) for j in range(32)]
    edges = [NS(vertices=(j+row*32, j+(row+1)*32)) for row in (0, 1) for j in range(32)]
    gown = NS(matrix_world=World(Vec()), data=NS(vertices=vertices, edges=edges, polygons=[]))
    class BackTree:
        def ray_cast(self, point, direction):
            return Vec((point.x, .15, point.z)), Vec((0, 1, 0)), 0, 1.35
    namespace = dict(math=math, Vector=Vec,
                     BVHTree=NS(FromPolygons=lambda *args: BackTree()))
    load_functions('circulator_visibility_v2.py', namespace)
    return gown, namespace


class CirculatorTrimTests(unittest.TestCase):
    def test_visibility_assertion_does_not_mutate_outside_geometry(self):
        gown, ns = scene()
        point = Vec((.30, .50, .95))
        actor = NS(matrix_world=World(Vec()), data=NS(vertices=[NS(co=point)]))
        context = dict(circulator_hands=[actor], circulator_clothing=[])
        original = point.xyz
        with contextlib.redirect_stdout(io.StringIO()):
            counts, behind, _ = ns['visibility_counts'](gown, context)
            with self.assertRaisesRegex(AssertionError, 'silhouette'):
                ns['assert_hidden'](gown, context)
        self.assertEqual(counts, {0: 1})
        self.assertEqual(behind, 0)
        self.assertEqual(point.xyz, original)
        names = {n.name for n in ast.parse((HERE/'circulator_visibility_v2.py').read_text()).body
                 if isinstance(n, ast.FunctionDef)}
        self.assertNotIn('fit_hidden_caps', names)
        self.assertNotIn('hidden_x_interval', names)

    def test_front_view_accepts_a_hidden_vertex_with_zero_counts(self):
        gown, ns = scene()
        actor = NS(matrix_world=World(Vec()), data=NS(vertices=[NS(co=Vec((.03, .27, .95)))]))
        context = dict(circulator_hands=[actor], circulator_clothing=[])
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            ns['assert_hidden'](gown, context)
        self.assertIn('outside {0: 0}', output.getvalue())
        self.assertIn('not behind gown 0', output.getvalue())

    def test_selector_chooses_longest_actual_cut_without_xy_editing(self):
        removed, cuts = [], []
        context = dict(circulator_sources={'L': 'left-source', 'R': 'right-source'})
        ns = dict(bpy=NS(data=NS(meshes=NS(remove=removed.append))))
        load_functions('circulator_trim_v2.py', ns, {'choose_forearm_length'})
        def counts(gown, context, **kwargs):
            hidden = context.get('length') == .085
            return {0: 0 if hidden else 5}, 7, 200
        def shorten(context, length):
            cuts.append(length)
            context['length'] = length
            return True
        ns.update(visibility_counts=counts, shorten=shorten)
        with contextlib.redirect_stdout(io.StringIO()):
            ns['choose_forearm_length'](None, context)
        self.assertEqual(cuts, [.10, .085])
        self.assertTrue(context['circulator_length_finalized'])
        self.assertEqual(removed, ['left-source', 'right-source'])

    def test_front_view_ignores_behind_diagnostic(self):
        gown, ns = scene()
        point = Vec((.03, .10, .95))
        actor = NS(matrix_world=World(Vec()), data=NS(vertices=[NS(co=point)]))
        context = dict(circulator_hands=[actor], circulator_clothing=[])
        with contextlib.redirect_stdout(io.StringIO()):
            counts, behind, _ = ns['visibility_counts'](gown, context)
            ns['assert_hidden'](gown, context)
        self.assertEqual(counts, {0: 0})
        self.assertEqual(behind, 1)

    def test_accepted_long_forearm_still_gets_shortened(self):
        cuts = []
        context = dict(circulator_sources={})
        ns = dict(bpy=NS(data=NS(meshes=NS(remove=lambda mesh: None))))
        load_functions('circulator_trim_v2.py', ns, {'choose_forearm_length'})
        ns.update(visibility_counts=lambda *args, **kwargs: ({0: 0}, 8, 200),
                  shorten=lambda context, length: cuts.append(length) or True)
        self.assertTrue(ns['FORCE_SHORT_FOREARM'])
        with contextlib.redirect_stdout(io.StringIO()):
            ns['choose_forearm_length'](None, context)
        self.assertEqual(cuts, [.10])

    def test_cut_that_would_remove_hand_skin_is_rejected(self):
        ns = {}
        load_functions('circulator_trim_v2.py', ns, {'shorten'})
        context = {'circulator_min_cut_m': {'L': .08, 'R': .08}}
        original = dict(context)
        with contextlib.redirect_stdout(io.StringIO()):
            result = ns['shorten'](context, .10)
        self.assertFalse(result)
        self.assertEqual(context, original)


if __name__ == '__main__':
    unittest.main()
