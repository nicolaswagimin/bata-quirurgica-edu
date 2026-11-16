"""Back fastening in progress. World metres, Z up, main figure faces -Y."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from gown import TRIM, fabric_material, neckline, ribbon

BOW_HOLD_HALFSPAN_M = 0.035


def back_surface(gown, x, z):
    """Find actual draped back along -Y, world metres (no front-side anchors)."""
    vertices = [gown.matrix_world @ v.co for v in gown.data.vertices]
    tree = BVHTree.FromPolygons(vertices, [tuple(f.vertices) for f in gown.data.polygons])
    point, _, _, _ = tree.ray_cast(Vector((x, 1, z)), Vector((0, -1, 0)))
    if point is None:
        raise RuntimeError('Cannot locate draped back for inner tie anchor')
    return point


def build_fastening(gown, marks):
    """Fastened 3x6 cm flat tab and two 12 mm inner tapes, one bow loop.

    No exterior belt, second bow loop or wrapped flap. Roots sit on the back
    panels' inner side; the circulating nurse handles the external free tape.
    """
    trim = fabric_material('v2-fastening-trim', TRIM, 0.94)
    ring = neckline(gown, marks)
    if not ring:
        raise RuntimeError('No neckline for Velcro fastening')
    rear = [Vector(p) for p in ring if p[1] > 0 and abs(p[0]) < 0.065]
    if not rear:
        raise RuntimeError('No rear neckline edge for Velcro')
    binding_top = max(p.z for p in rear)
    tab_top = binding_top-0.0075
    neck = Vector((0, max(p.y for p in rear if p.z > binding_top-0.025), tab_top-0.015))
    bpy.ops.mesh.primitive_cube_add(size=1, location=neck+Vector((0, 0.004, 0)))
    tab = bpy.context.object
    tab.name = 'v2-neck-velcro'
    tab.scale = (0.06, 0.003, 0.03)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    tab.data.materials.append(trim)
    # Probe either panel, away from the split centre seam.
    left, right = [back_surface(gown, x, marks['waist']) for x in (0.075, -0.075)]
    waist = (left+right)/2+Vector((0, 0.025, 0))
    waist.x = 0
    objects = [tab]
    for side, root in (('L', left), ('R', right)):
        root.y -= 0.003  # inner face, invisible entry into the panel
        objects.append(ribbon(f'v2-inner-tie-root-{side}', [tuple(root),
            tuple(root+Vector((0, 0.011, -0.005))), tuple(waist)], trim,
            width=0.006, thickness=0.0008))
    hold_l = waist+Vector((BOW_HOLD_HALFSPAN_M, 0.018, 0.021))
    hold_r = waist+Vector((-BOW_HOLD_HALFSPAN_M, 0.028, -0.045))
    loop = [waist, waist+Vector((0.020, 0.012, 0.026)), hold_l,
            waist+Vector((0.040, 0.015, -0.006)), waist+Vector((0.020, 0.009, -0.012)), waist]
    objects.append(ribbon('v2-inner-tie-one-loop', [tuple(p) for p in loop], trim, width=0.006, thickness=0.0008))
    for name, points in (
        ('held-tail', [waist, waist+Vector((-0.020, 0.02, -0.02)), hold_r,
                       hold_r+Vector((-0.005, 0.004, -0.055))]),
        ('free-tail', [waist, waist+Vector((0.018, 0.012, -0.05)),
                       waist+Vector((0.028, 0.014, -0.12))])):
        objects.append(ribbon(f'v2-inner-tie-{name}', [tuple(p) for p in points], trim,
                              width=0.006, thickness=0.0008))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=waist)
    knot = bpy.context.object
    knot.name = 'v2-half-knot'
    knot.scale = (0.013, 0.008, 0.010)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    knot.data.materials.append(trim)
    objects.append(knot)
    print('NECK Velcro', 'binding top z', round(binding_top, 4), 'tab top z', round(tab_top, 4),
          'offset mm', round((binding_top-tab_top)*1000, 3))
    assert 0.005 <= binding_top-tab_top <= 0.010
    print('BOW centred targets x cm', round(hold_l.x*100, 3), round(hold_r.x*100, 3))
    assert waist.x == 0 and max(abs(hold_l.x), abs(hold_r.x)) <= 0.06
    print('FASTENING flat Velcro cm', (6, 3), 'inner tie width mm', 12, 'bow loops', 1,
          'waist', tuple(round(c, 3) for c in waist))
    return dict(marks=marks, neck=neck, waist=waist, holds={'L': hold_l, 'R': hold_r}, fastening=objects)
