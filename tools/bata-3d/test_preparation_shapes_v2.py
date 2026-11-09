"""Numerical/dispatch regressions for reviewed preparation renders; no Blender."""
import ast
import math
from pathlib import Path
import unittest
from types import SimpleNamespace as NS

from cloth_shape_v2 import held_fold, towel_section, shoulder_radius
from transfer_sleeve_v2 import cap_profile, assert_cap_radius, TRANSFER_SLEEVE_RADIUS_M
from test_circulator_ik_v2 import Vec, load_functions

HERE = Path(__file__).resolve().parent


class PreparationShapesTests(unittest.TestCase):
    def test_small_rounded_cap_in_rotated_world_frame(self):
        radius = TRANSFER_SLEEVE_RADIUS_M
        axis = Vec((.6,.8,0))
        u, v = Vec((-.8,.6,0)), Vec((0,0,1))
        wrist = Vec((.52,-.34,1.18))
        points = [wrist+axis*z+(u*math.cos(t)+v*math.sin(t))*r
                  for z,r in cap_profile() for t in (2*math.pi*j/32 for j in range(32))]
        self.assertAlmostEqual(min((p-wrist).dot(axis) for p in points),-.10)
        self.assertAlmostEqual(assert_cap_radius(points,wrist,axis,radius),radius)
        with self.assertRaisesRegex(AssertionError,'1.2'):
            assert_cap_radius(points+[wrist-axis*.09+u*.175],wrist,axis,radius)

    def test_towel_contact_wrap_and_unequal_gravity_tails(self):
        radius = .046
        for t in (.25,.30,.475,.60,.70):
            x,z,fall = towel_section(t,radius)
            self.assertAlmostEqual(math.hypot(x,z),radius)
            self.assertEqual(fall,0)
        self.assertLess(towel_section(.25,radius)[1],0)
        self.assertLess(towel_section(.70,radius)[1],0)
        self.assertGreater(towel_section(0,radius)[2],.15)
        self.assertGreater(towel_section(1,radius)[2],.14)
        self.assertNotEqual(towel_section(0,radius)[2],towel_section(1,radius)[2])

    def test_three_broad_irregular_folds_not_repeated_flutes(self):
        for t in (0,.5,1):
            values = [held_fold(i/200*2-1,t) for i in range(201)]
            extrema = [i for i in range(1,200)
                       if (values[i]-values[i-1])*(values[i+1]-values[i]) < 0]
            self.assertEqual(len(extrema),3)
            self.assertGreater(max(values)-min(values),.02)
            self.assertNotAlmostEqual(extrema[1]-extrema[0],extrema[2]-extrema[1])
        self.assertNotAlmostEqual(held_fold(-.6,0),held_fold(-.6,1))

    def test_soft_shoulder_stays_rounded(self):
        for t in (0,.25,.5,.75,1):
            radii = [shoulder_radius(t,i*math.pi/24) for i in range(48)]
            self.assertGreater(min(radii),.035)
            self.assertLess(max(radii),.075)
            self.assertLess(max(radii)-min(radii),.008)

    def test_glove_thickness_and_overlap_are_physical_not_pleated(self):
        ns = {}
        load_functions('worn_gloves_v2.py',ns,{'gauntlet_levels'})
        self.assertTrue(.001 <= ns['GLOVE_OFFSET_M'] <= .0015)
        self.assertTrue(.03 <= ns['GLOVE_OVERLAP_M'] <= .05)
        levels = ns['gauntlet_levels']()
        self.assertEqual(levels[1][1:],levels[2][1:])
        self.assertEqual(levels[2][1:],levels[3][1:])
        self.assertLess(levels[-1][1],levels[-2][1])
        self.assertLess(levels[-1][2],levels[-2][2])

    def test_latex_material_uses_exact_shared_colour(self):
        tree = ast.parse((HERE/'common.py').read_text())
        latex = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign)
                     and any(isinstance(t,ast.Name) and t.id=='LATEX' for t in n.targets))
        inputs = {key:NS(default_value=None) for key in ('Base Color','Roughness','Sheen Weight')}
        material = NS(node_tree=NS(nodes={'Principled BSDF':NS(inputs=inputs)}))
        ns = dict(LATEX=latex,bpy=NS(data=NS(materials=NS(new=lambda name:material))))
        load_functions('worn_gloves_v2.py',ns,{'latex_material'})
        self.assertIs(ns['latex_material'](),material)
        self.assertEqual(inputs['Base Color'].default_value,latex)
        self.assertEqual(inputs['Roughness'].default_value,.38)
        self.assertEqual(inputs['Sheen Weight'].default_value,.08)

    def test_step6_no_longer_voxel_unions_close_sleeves(self):
        tree = ast.parse((HERE/'gloving_gown_v2.py').read_text())
        calls = [n for n in ast.walk(tree) if isinstance(n,ast.Call)
                 and isinstance(n.func,ast.Name) and n.func.id=='unify']
        self.assertEqual(len(calls),1)
        self.assertEqual(ast.unparse(calls[0].args[0]),'[torso]')
        self.assertNotIn('remove_doubles',(HERE/'gloving_gown_v2.py').read_text())


if __name__ == '__main__':
    unittest.main()
