"""Construction-based hand clearance, in any pose. World metres, Z up, -Y front."""
import math

import bmesh
import bpy
from mathutils.bvhtree import BVHTree
from cuffs_v2 import inside_cuff
from hand_coverage_v2 import coverage_failures, describe_leak, local_skin, mesh_tree
from sleeve_clearance_v2 import HAND_CLEARANCE_M
from sleeve_seam_v2 import TAPER_LENGTH_M, SEAM_ALLOWANCE_M, cuff_radius, taper_radius

CHORD_RESERVE_M = 0.002
MIN_TAPER_RUN_M = 0.012
MAX_REPAIR_PASSES = 8


def prepare_guard(layouts, hands, enabled):
    """Build a smooth envelope for skin needing loose sleeve, not knit coverage.

    A finger already inside the knit must not inflate the sewn lip. All other
    hand points get 10 mm normal clearance plus 2 mm face-chord reserve.
    """
    if not enabled:
        return
    for side, p in layouts.items():
        skin = [point for point in hands[side] if not inside_cuff(p, point)]
        local = [local_skin(point, p) for point in skin]
        if not local:
            raise RuntimeError(f'{side}: no loose-sleeve hand skin to protect')
        p['coverage_guard'] = True
        p['guard_last_skin'] = max(z for z, _, _ in local)
        p['guard_skin_radius'] = max(radial.length for _, radial, _ in local)
        p['hand_envelope_radius'] = max(p['hand_envelope_radius'],
                                       p['guard_skin_radius']+HAND_CLEARANCE_M+CHORD_RESERVE_M)
        p['palm_radius'] = max(p['palm_radius'], p['hand_envelope_radius'])
        print('HAND envelope guard', side, 'last loose skin axial cm', round(p['guard_last_skin']*100, 4),
              'skin margin mm', HAND_CLEARANCE_M*1000, 'chord reserve mm', CHORD_RESERVE_M*1000)


def guarded_taper_radius(z, angle, p):
    """Keep full hand clearance until skin enters knit, then taper to sewn lip.

    The stitch radius stays exactly cuff +1.5 mm. Distal seam placement provides
    room for this taper instead of flaring it or accepting exposed skin.
    """
    start = max(p['sleeve_end']-TAPER_LENGTH_M, p['guard_last_skin']+CHORD_RESERVE_M)
    if p['sleeve_end']-start < MIN_TAPER_RUN_M-CHORD_RESERVE_M:
        raise RuntimeError('Guarded taper needs a more distal seam')
    t = max(0, min(1, (z-start)/(p['sleeve_end']-start)))
    blend = t*t*(3-2*t)
    stitch = cuff_radius(p, angle)+SEAM_ALLOWANCE_M
    radius = p['palm_radius']*(1-blend)+stitch*blend
    # Retain the existing gather waves, fading their onset after the plateau.
    original_t = max(0, min(1, (z-(p['sleeve_end']-TAPER_LENGTH_M))/TAPER_LENGTH_M))
    q = original_t*original_t*(3-2*original_t)
    old_baseline = p['palm_radius']*(1-q)+stitch*q
    return radius+(taper_radius(z, angle, p)-old_baseline)*blend


def sleeve_vertices(gown, p):
    """Flood the real sleeve from its rim; never grab a nearby torso surface."""
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    bm.verts.ensure_lookup_table()
    allowed = set()
    for v in bm.verts:
        z, radial, _ = local_skin(gown.matrix_world @ v.co, p)
        if p['hand_start']-0.035 < z <= p['sleeve_end']+0.0001 and radial.length < 0.15:
            allowed.add(v.index)
    seeds = {v.index for e in bm.edges if e.is_boundary for v in e.verts
             if v.index in allowed and (gown.matrix_world @ v.co-p['rim']).length < 0.08}
    if p.get('owned_seam', False):
        from seam_boundary_v2 import sleeve_boundary
        seeds = {v.index for edge in sleeve_boundary(gown, bm, p) for v in edge.verts}
    result, todo = set(seeds), list(seeds)
    while todo:
        vertex = bm.verts[todo.pop()]
        for edge in vertex.link_edges:
            other = edge.other_vert(vertex).index
            if other in allowed and other not in result:
                result.add(other)
                todo.append(other)
    bm.free()
    if not result:
        raise RuntimeError('No connected hand sleeve region after decimation')
    return result, seeds


def project_envelope(gown, layouts):
    """Move EVERY connected hand-sleeve vertex along its envelope normal."""
    inverse = gown.matrix_world.inverted()
    regions = {}
    for side, p in layouts.items():
        selected, sewn = sleeve_vertices(gown, p)
        regions[side] = (selected, sewn)
        p['guard_vertices'] = selected
        moved = 0
        for index in selected:
            vertex = gown.data.vertices[index]
            point = gown.matrix_world @ vertex.co
            z, radial, angle = local_skin(point, p)
            if radial.length == 0:
                raise RuntimeError('Collapsed sleeve vertex on hand axis')
            if index in sewn:
                continue
            if z >= p['sleeve_end']-TAPER_LENGTH_M:
                radius = guarded_taper_radius(z, angle, p)
            else:
                radius = max(radial.length, p['hand_envelope_radius'])
            if abs(radius-radial.length) > 1e-9:
                vertex.co = inverse @ (point+radial.normalized()*(radius-radial.length))
                moved += 1
        print('HAND post-decimate envelope', side, 'connected vertices', len(selected),
              'moved', moved, 'sewn fixed', len(sewn))
    gown.data.update()
    bpy.context.view_layer.update()
    return regions


def barycentric(point, a, b, c):
    """Triangle weights at a ray hit, dimensionless; used only for mesh repair."""
    u, v, w = b-a, c-a, point-a
    uu, uv, vv = u.dot(u), u.dot(v), v.dot(v)
    denominator = uu*vv-uv*uv
    if abs(denominator) < 1e-18:
        return None
    second = (vv*w.dot(u)-uv*w.dot(v))/denominator
    third = (uu*w.dot(v)-uv*w.dot(u))/denominator
    return (1-second-third, second, third)


def repair_sample(gown, p, selected, sewn, face, point, direction, deficit, shifts):
    """Offset movable face corners along envelope normals; preserve sewing pins."""
    vertices = [gown.matrix_world @ gown.data.vertices[i].co for i in face]
    triangles = [(0, j, j+1) for j in range(1, len(face)-1)]
    candidates = []
    for tri in triangles:
        weights = barycentric(point, *(vertices[i] for i in tri))
        if weights is not None:
            candidates.append((min(weights), tri, weights))
    if not candidates:
        raise RuntimeError('Degenerate sleeve face at a leaking hand point')
    _, triangle, weights = max(candidates, key=lambda item: item[0])
    entries = []
    for corner, weight in zip(triangle, weights):
        index = face[corner]
        if index not in selected or index in sewn or weight <= 0:
            continue
        _, radial, _ = local_skin(vertices[corner], p)
        normal = radial.normalized()
        influence = weight*normal.dot(direction)
        if influence > 0:
            entries.append((index, normal, influence))
    denominator = sum(weight*weight for _, _, weight in entries)
    if not denominator:
        raise RuntimeError('Skin reaches sewn rim: move the seam distally; do not flare it')
    for index, normal, influence in entries:
        distance = min(0.02, deficit*influence/denominator)
        previous = shifts.get(index)
        if previous is None or distance > previous[0]:
            shifts[index] = (distance, normal)


def finalize_coverage(gown, layouts, hands, enabled):
    """Enforce actual face clearance AFTER all decimation, then require zero leaks.

    Vertex-radius bounds alone miss chords across a taper. Ray-test the actual
    sleeve faces at every uncovered skin vertex and offset their movable corners
    until the envelope-normal clearance is >=10 mm. No count/sign tolerance.
    """
    if not enabled:
        return
    coverage_failures(gown, layouts, hands, 'before-envelope-global-nearest', use_guard=False)
    regions = project_envelope(gown, layouts)
    inverse = gown.matrix_world.inverted()
    for attempt in range(1, MAX_REPAIR_PASSES+1):
        _, vertices, faces = mesh_tree(gown)
        shifts, pending = {}, 0
        for side, p in layouts.items():
            selected, sewn = regions[side]
            face_ids = [i for i, face in enumerate(faces) if any(v in selected for v in face)]
            sleeve_tree = BVHTree.FromPolygons(vertices, [faces[i] for i in face_ids])
            for index, point in enumerate(hands[side]):
                if inside_cuff(p, point):
                    continue
                z, radial, _ = local_skin(point, p)
                direction = radial.normalized() if radial.length else p['normal']
                center = point-radial
                hit, hit_normal, face_index, distance = sleeve_tree.ray_cast(center, direction, 0.2)
                if hit is None or z > p['sleeve_end']:
                    coverage_failures(gown, layouts, hands, f'axial-gap-pass-{attempt}')
                    raise RuntimeError('Missing sleeve ray surface: check seam axial position')
                deficit = radial.length+HAND_CLEARANCE_M-distance
                if deficit > 0:
                    pending += 1
                    if attempt == MAX_REPAIR_PASSES:
                        describe_leak(side, p, index, point, hit, hit_normal, 'margin-shortfall')
                        print('HAND margin below 10 mm', side, index, 'clearance mm',
                              round((distance-radial.length)*1000, 5))
                    try:
                        repair_sample(gown, p, selected, sewn, faces[face_ids[face_index]],
                                      hit, direction, deficit+0.0005, shifts)
                    except RuntimeError:
                        describe_leak(side, p, index, point, hit, hit_normal, 'blocked-repair')
                        raise
        print('HAND face clearance pass', attempt, 'samples below 10 mm', pending,
              'vertices to move', len(shifts))
        if not pending:
            failures = coverage_failures(gown, layouts, hands, 'final-envelope')
            assert not any(failures.values()), 'Hand outside sleeve U cuff after geometric repair'
            return
        if not shifts:
            break
        for index, (distance, normal) in shifts.items():
            vertex = gown.data.vertices[index]
            vertex.co = inverse @ (gown.matrix_world @ vertex.co+normal*distance)
        gown.data.update()
        bpy.context.view_layer.update()
    coverage_failures(gown, layouts, hands, 'repair-exhausted')
    raise RuntimeError('Hand sleeve cannot satisfy strict 10 mm face clearance; inspect HAND LEAK coordinates')
