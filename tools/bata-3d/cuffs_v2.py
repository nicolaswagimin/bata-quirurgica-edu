"""Closed-technique sleeve/cuff assembly. World metres, Z up, figure faces -Y."""
import math

from mathutils.bvhtree import BVHTree
from gown import FABRIC_V2, bone_head, bone_tail, fabric_material, loft
from hands import hand_frame

CUFF_LENGTH_M = 0.07
CUFF_INSET_M = 0.025
CUFF_OVERLAP_M = 0.01
CUFF_CLEARANCE_M = 0.003
CUFF_LIMITS_M = (0.056, 0.042)
CUFF_RIDGES = 28
CUFF_RIB_M = 0.001


def cuff_axes(t, mid):
    """Semi-axes, metres: smooth gathering in distal 35%, ending at 85%."""
    q = max(0, min(1, (t - 0.65) / 0.35))
    scale = 1 - 0.15 * q * q * (3 - 2 * q)
    return tuple(r * scale for r in mid)


def coordinates(profile, point):
    """Project a world point into wrist-based longitudinal/palm coordinates."""
    delta = point - profile['wrist']
    return tuple(delta.dot(profile[key]) for key in ('axis', 'across', 'normal'))


def fit_cuff(coords, start, offset):
    """Fit ONLY finger vertices within the seven-centimetre cuff, metres.

    Proximal finger skin belongs to the sleeve. Reserve 3 mm to the inside
    envelope, including ridges/lining, and fail instead of increasing the caps.
    """
    selected = [(z, x-offset[0], y-offset[1]) for z, x, y in coords if z >= start]
    if not selected:
        raise RuntimeError('No distal finger vertices for cuff fit')
    mid = [min(limit, max(0.008, max(abs(p[i+1]) for p in selected) + CUFF_CLEARANCE_M))
           for i, limit in enumerate(CUFF_LIMITS_M)]
    for _ in range(100):
        worst = 1.0
        for z, x, y in selected:
            a, b = cuff_axes((z-start) / CUFF_LENGTH_M, mid)
            worst = max(worst, math.hypot(x / (a-CUFF_CLEARANCE_M), y / (b-CUFF_CLEARANCE_M)))
        if worst <= 1.00001:
            return tuple(mid)
        updated = [min(limit, r * min(worst, 1.025)) for r, limit in zip(mid, CUFF_LIMITS_M)]
        if updated == mid:
            break
        mid = updated
    raise RuntimeError(f'Distal fingers exceed capped cuff ellipse: {mid}')


def cuff_layouts(rig, hands, fingers):
    """Shared real sleeve rim, pin and cuff coordinates; world metres.

    Sleeve rim is 1 cm distal to the cuff root, so the knit slips underneath
    the sleeve with overlap. Palm/thumb sizing never inflates the rib cuff.
    """
    layouts = {}
    for side in ('L', 'R'):
        wrist = bone_head(rig, f'wrist.{side}')
        axis = (bone_head(rig, f'finger3-1.{side}') - wrist).normalized()
        _, across, _ = hand_frame(rig, side)
        across = rig.matrix_world.to_3x3() @ across
        across = (across - axis * across.dot(axis)).normalized()
        normal = axis.cross(across).normalized()
        p = dict(wrist=wrist, axis=axis, across=across, normal=normal)
        tips = [coordinates(p, bone_tail(rig, f'finger{i}-3.{side}'))[0] for i in range(1, 6)]
        end = max(tips) + CUFF_INSET_M
        start = end - CUFF_LENGTH_M
        p.update(start=start, end=end, sleeve_end=start + CUFF_OVERLAP_M)
        coords = [coordinates(p, point) for point in fingers[side]]
        distal = [c for c in coords if c[0] >= start]
        if not distal:
            raise RuntimeError('No finger skin inside cuff interval')
        offset = tuple((max(c[i] for c in distal) + min(c[i] for c in distal))/2 for i in (1, 2))
        p['offset'] = offset
        p['mid'] = fit_cuff(coords, start, offset)
        palm = [coordinates(p, point) for point in hands[side]
                if coordinates(p, point)[0] <= p['sleeve_end']]
        p['palm_radius'] = max(0.05, max((math.hypot(x-offset[0], y-offset[1])
                                         for _, x, y in palm), default=0.044) + 0.006)
        p['rim'] = wrist + axis*p['sleeve_end'] + across*offset[0] + normal*offset[1]
        insets = [end-z for z in tips]
        print('CUFF fingertip inset', side, {i+1: round(d*100, 2) for i, d in enumerate(insets)}, 'cm')
        assert 0.020 <= min(insets) <= 0.030, 'Distal fingertip inset must be 2.0-3.0 cm'
        print('CUFF layout', side, 'length cm', CUFF_LENGTH_M*100, 'overlap cm', CUFF_OVERLAP_M*100,
              'mid semi-axes cm', tuple(round(r*100, 2) for r in p['mid']),
              'sleeve palm radius cm', round(p['palm_radius']*100, 2))
        layouts[side] = p
    return layouts


def cuff_materials():
    """Blue rib exterior and darker knit lining, with an exportable base tint."""
    outer = fabric_material('v2-knit', tuple(c*0.83 for c in FABRIC_V2[:3]) + (1,), 0.94)
    nodes, links = outer.node_tree.nodes, outer.node_tree.links
    tex = nodes.new('ShaderNodeTexCoord')
    wave = nodes.new('ShaderNodeTexWave')
    wave.wave_type, wave.bands_direction = 'BANDS', 'X'
    wave.inputs['Scale'].default_value = 80
    links.new(tex.outputs['Generated'], wave.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    bump.inputs['Distance'].default_value = 0.0003
    links.new(wave.outputs['Color'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], nodes['Principled BSDF'].inputs['Normal'])
    inner = outer.copy()
    inner.name = 'v2-knit-inner'
    inner.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = tuple(c*0.83*0.35 for c in FABRIC_V2[:3]) + (1,)
    print('CUFF colours', 'outer linear RGB', tuple(round(c*0.83, 6) for c in FABRIC_V2[:3]),
          'inner fraction of knit', 0.35, 'roughness', 0.94)
    return outer, inner


def build_cuffs(layouts, axial_segments=12):
    """Seven-centimetre rib tubes with rolled open lips and inward dark lining.

    Rings return along the inside wall, never across the opening. No cap and
    no deletion of hand skin. Mesh winding points lining normals into the tube.
    """
    materials = cuff_materials()
    if axial_segments != 12:
        print('DETAIL cuff axial segments', axial_segments, 'circumference samples', 112, 'ridges', CUFF_RIDGES)
    objects = []
    for side, p in layouts.items():
        rings = []
        def ring(t, inset=0, backward=0, ribs=False):
            a, b = cuff_axes(t, p['mid'])
            center = p['wrist'] + p['axis']*(p['start'] + CUFF_LENGTH_M*t - backward)
            center += p['across']*p['offset'][0] + p['normal']*p['offset'][1]
            result = []
            for j in range(112):
                angle = 2*math.pi*j/112
                rib = CUFF_RIB_M*math.cos(CUFF_RIDGES*angle) if ribs else 0
                result.append(center + p['across']*((a-inset+rib)*math.cos(angle))
                              + p['normal']*((b-inset+rib)*math.sin(angle)))
            return result
        rings.extend(ring(i/axial_segments, ribs=True) for i in range(axial_segments+1))
        rings.extend((ring(1, 0.0004, 0.0004), ring(1, 0.0012, 0.001), ring(1, 0.0018, 0.002)))
        rings.extend(ring(i/axial_segments, inset=0.0018) for i in range(axial_segments-1, -1, -1))
        obj = loft(f'v2-cuff-{side}', rings, cap=False)
        for material in materials:
            obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
            polygon.material_index = int(polygon.index // 112 >= axial_segments+1)
        objects.append(obj)
    return objects


def inside_cuff(p, point):
    """Conservative inner cuff volume, including lining/ribs, world metres."""
    z, x, y = coordinates(p, point)
    if not p['start'] <= z <= p['end'] - 0.003:
        return False
    a, b = cuff_axes((z-p['start']) / CUFF_LENGTH_M, p['mid'])
    return math.hypot((x-p['offset'][0])/(a-0.003), (y-p['offset'][1])/(b-0.003)) <= 1.0001


def assert_hand_coverage(gown, layouts, hands):
    """Require hand skin within actual simulated sleeve OR cuff, world metres.

    Sleeve membership uses nearest outward-facing surface on the final gown,
    clipped at its real cuff plane. It therefore checks cloth after simulation,
    folds and decimation rather than assuming the source cylinder survived.
    """
    import bpy
    evaluated = gown.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertices = [gown.matrix_world @ v.co for v in mesh.vertices]
    tree = BVHTree.FromPolygons(vertices, [tuple(f.vertices) for f in mesh.polygons])
    evaluated.to_mesh_clear()
    for side, p in layouts.items():
        guarded = p.get('coverage_guard', False)
        if guarded:
            from hand_coverage_v2 import sleeve_membership, sleeve_tree
            local_tree = sleeve_tree(gown, p)[0]
        outside, sleeve_count, cuff_count = 0, 0, 0
        leaks = []
        for index, point in enumerate(hands[side]):
            if inside_cuff(p, point):
                cuff_count += 1
                continue
            z, _, _ = coordinates(p, point)
            if guarded:
                in_sleeve, nearest, normal, _, _ = sleeve_membership(local_tree, p, point)
            else:
                nearest, normal, _, _ = tree.find_nearest(point)
                in_sleeve = (z <= p['sleeve_end'] and nearest is not None
                             and (point-nearest).dot(normal) <= 0.0)
            if in_sleeve:
                sleeve_count += 1
            else:
                outside += 1
                leaks.append((index, point, nearest, normal))
        if leaks:
            from hand_coverage_v2 import describe_leak
            for index, point, nearest, normal in leaks:
                describe_leak(side, p, index, point, nearest, normal, 'assert')
        print('HAND sleeve U cuff outside', side, outside, 'of', len(hands[side]),
              'sleeve', sleeve_count, 'cuff', cuff_count)
        assert outside == 0, f'{side}: {outside} hand vertices outside sleeve U cuff'
