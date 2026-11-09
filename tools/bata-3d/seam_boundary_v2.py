"""Step-6 sleeve boundary ownership; world metres, no glove/skin meshes.

Close hands put both sleeve openings inside the old 8 cm search sphere.
Select a whole closed boundary by topology before moving any vertices.
"""
import math
from contextlib import contextmanager


def nearest_boundary_loop(edges, position, rim):
    """Return the closed boundary loop whose centroid is nearest this cuff.

    Never filter individual edges by radius: doing so admits fragments of the
    opposite sleeve and can hide a genuinely displaced section of this seam.
    """
    adjacent = {}
    for edge in edges:
        if edge.is_boundary:
            for vertex in edge.verts:
                adjacent.setdefault(vertex, []).append(edge)
    remaining = set(adjacent)
    candidates = []
    while remaining:
        seed = remaining.pop()
        vertices, component, todo = {seed}, set(), [seed]
        while todo:
            vertex = todo.pop()
            for edge in adjacent[vertex]:
                component.add(edge)
                for other in edge.verts:
                    if other not in vertices:
                        vertices.add(other)
                        remaining.discard(other)
                        todo.append(other)
        if len(vertices) < 12 or any(len(adjacent[v]) != 2 for v in vertices):
            continue
        points = [position(v) for v in vertices]
        center = points[0]*0
        for point in points:
            center = center+point
        center = center/len(points)
        candidates.append(((center-rim).length, component))
    if not candidates:
        raise RuntimeError('No closed sleeve boundary loop')
    distance, selected = min(candidates, key=lambda item: item[0])
    if distance >= 0.08:
        raise RuntimeError('No sleeve boundary centered near cuff')
    return selected


def sleeve_boundary(gown, bm, profile):
    edges = bm.edges
    if profile.get('seam_group'):
        group = gown.vertex_groups.get(profile['seam_group'])
        layer = bm.verts.layers.deform.active
        if group is None or layer is None:
            raise RuntimeError('Sleeve ownership lost during mesh processing')
        edges = [edge for edge in edges if all(v[layer].get(group.index, 0) > .5 for v in edge.verts)]
    return nearest_boundary_loop(edges, lambda v: gown.matrix_world @ v.co, profile['rim'])


def restore_owned_rims(gown, profiles):
    """Restore both complete loops simultaneously; never project a rim twice."""
    import bmesh
    from sleeve_seam_v2 import SEAM_ALLOWANCE_M, cuff_radius
    bm = bmesh.new()
    try:
        bm.from_mesh(gown.data)
        loops = {side: sleeve_boundary(gown, bm, p) for side, p in profiles.items()}
        if len(loops) == 2 and loops['L'] & loops['R']:
            raise RuntimeError('Sleeve openings merged or ambiguous; cannot restore seams')
        inverse = gown.matrix_world.inverted()
        for side, p in profiles.items():
            vertices = {v for edge in loops[side] for v in edge.verts}
            for vertex in vertices:
                delta = gown.matrix_world @ vertex.co-p['rim']
                radial = delta-p['axis']*delta.dot(p['axis'])
                if radial.length < 1e-9:
                    raise RuntimeError('Collapsed sleeve rim on cuff axis')
                angle = math.atan2(radial.dot(p['normal']), radial.dot(p['across']))
                vertex.co = inverse @ (p['rim']+radial.normalized()*(cuff_radius(p, angle)+SEAM_ALLOWANCE_M))
            print('SLEEVE owned rim', side, 'vertices', len(vertices))
        bm.to_mesh(gown.data)
    finally:
        bm.free()
    gown.data.update()


@contextmanager
def owned_rim_restoration(enabled):
    """Override only the step-6 call, restoring the frozen module even on error."""
    if not enabled:
        yield
        return
    import gown
    original = gown.restore_sleeve_rims_v2
    gown.restore_sleeve_rims_v2 = restore_owned_rims
    try:
        yield
    finally:
        gown.restore_sleeve_rims_v2 = original
