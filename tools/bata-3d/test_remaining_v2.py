"""Configuration/dispatch regression checks; standard Python, never Blender."""
import ast
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent


def table():
    """Execute only literal config declarations, without Blender imports."""
    tree=ast.parse((HERE/'steps_v2.py').read_text())
    statements=[]
    for node in tree.body:
        if isinstance(node,ast.Assign) and any(isinstance(n,ast.Name) and n.id=='STEPS' for n in node.targets):
            statements.append(node)
        elif isinstance(node,ast.For):
            statements.append(node)
        elif isinstance(node,ast.Expr) and isinstance(node.value,ast.Call):
            statements.append(node)
    scope={}
    exec(compile(ast.Module(body=statements,type_ignores=[]),'config','exec'),scope)
    return scope['STEPS']


class RemainingSteps(unittest.TestCase):
    def test_all_seven_have_runnable_configuration(self):
        steps=table()
        self.assertEqual(set(steps),set(range(1,8)))
        for n,c in steps.items():
            self.assertIsNotNone(c['pose'],n)
            self.assertIn('views',c)
            self.assertLessEqual(c['triangle_target'],80000)
        self.assertEqual(steps[6]['hand'],'tucked')
        self.assertTrue(steps[7]['gloves'])
        self.assertEqual(steps[7]['closure'],'wrapped')

    def test_approved_entries_are_not_reconfigured(self):
        steps=table()
        self.assertEqual(steps[4]['pose'],'forward')
        self.assertEqual(steps[4]['detail'],'hands')
        self.assertFalse(steps[4]['hand_clearance_guard'])
        self.assertEqual(steps[5]['pose'],'waiting')
        self.assertEqual(steps[5]['extras'],('back_fastening','circulator'))
        self.assertEqual(steps[5]['detail'],'back')
        self.assertEqual(steps[5]['triangle_target'],76000)

    def test_detail_names_and_held_states(self):
        steps=table()
        for n in (1,2,3,6,7):
            self.assertEqual(steps[n]['detail'],'detail')
            self.assertEqual(steps[n]['views'],(('front',0),('three',35)))
        self.assertEqual([steps[n]['garment'] for n in (1,2,3)],['none','folded','unfolded'])

    def test_no_blender_import_in_sheet(self):
        tree=ast.parse((HERE/'render_sheet_v2.py').read_text())
        imports=[n.module for n in ast.walk(tree) if isinstance(n,ast.ImportFrom)]
        self.assertNotIn('bpy',imports)
        self.assertNotIn('common',imports)


if __name__=='__main__':
    unittest.main()
