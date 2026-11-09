"""Step-7 fitted latex: posed skin shell and a continuous smooth gauntlet."""
import math
import bmesh
import bpy
from common import LATEX
from gloves_v2 import extract_hand
from seam_boundary_v2 import nearest_boundary_loop

GLOVE_OFFSET_M = .0012
GLOVE_OVERLAP_M = .045


def latex_material():
    material = bpy.data.materials.new('v2-fitted-latex')
    material.use_nodes = True
    material.diffuse_color = LATEX
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = LATEX
    bsdf.inputs['Roughness'].default_value = .38
    bsdf.inputs['Sheen Weight'].default_value = .08
    return material


def ordered_boundary(edges):
    """Traverse the original wrist loop; preserve anatomical vertex ordering."""
    adjacent = {}
    for edge in edges:
        for vertex in edge.verts:
            adjacent.setdefault(vertex, []).append(edge)
    if any(len(items) != 2 for items in adjacent.values()):
        raise RuntimeError('Wrist boundary must be a simple closed loop')
    first = min(adjacent, key=lambda vertex: vertex.index)
    vertices, current, previous = [first], first, None
    while True:
        edge = next(edge for edge in adjacent[current] if edge is not previous)
        current = edge.other_vert(current)
        if current is first:
            break
        if current in vertices:
            raise RuntimeError('Repeated vertex in glove wrist boundary')
        vertices.append(current)
        previous = edge
    assert len(vertices) == len(adjacent)
    return vertices


def bridge_rings(bm, previous, points):
    ring = [bm.verts.new(point) for point in points]
    for i in range(len(ring)):
        j = (i+1) % len(ring)
        bm.faces.new((previous[i],previous[j],ring[j],ring[i]))
    return ring


def gauntlet_levels():
    """Smooth outer wall plus an inward rolled lip buried in the knit."""
    return ((.008,.038,.028),(.020,.0445,.0335),(.035,.0445,.0335),
            (GLOVE_OVERLAP_M,.0445,.0335),(GLOVE_OVERLAP_M-.001,.0415,.0305))


def fitted_gloves(human, rig, profiles):
    material = latex_material()
    result = []
    for side, p in profiles.items():
        glove, wrist, _ = extract_hand(human,rig,side,f'v2-fitted-glove-{side}',
                                       forearm=0,inflation=GLOVE_OFFSET_M)
        bm = bmesh.new()
        try:
            bm.from_mesh(glove.data)
            bm.verts.ensure_lookup_table()
            edges = nearest_boundary_loop(bm.edges,lambda v:v.co,wrist)
            original = ordered_boundary(edges)
            angles = [math.atan2((v.co-wrist).dot(p['normal']),
                                 (v.co-wrist).dot(p['across'])) for v in original]
            ring = original
            for depth,a,b in gauntlet_levels():
                points = [wrist-p['axis']*depth+p['across']*(a*math.cos(t))+
                          p['normal']*(b*math.sin(t)) for t in angles]
                ring = bridge_rings(bm,ring,points)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(glove.data)
        finally:
            bm.free()
        glove.data.materials.clear()
        glove.data.materials.append(material)
        glove.data.polygons.foreach_set('use_smooth',[True]*len(glove.data.polygons))
        result.append(glove)
    assert .001 <= GLOVE_OFFSET_M <= .0015
    assert .03 <= GLOVE_OVERLAP_M <= .05
    print('FITTED latex offset mm',GLOVE_OFFSET_M*1000,'knit overlap cm',GLOVE_OVERLAP_M*100,
          'colour',LATEX,'roughness',.38,'continuous wrist topology; no finger remesh')
    return result


def close_sleeve_to_knit(gown, profiles):
    """Sew actual sleeve boundary to the knit root: no annular black opening.

    Run after gown decimation. Each collar starts at the original cloth edge
    and ends 1 cm inside the knit, making an overlapping opaque cloth joint.
    """
    bm = bmesh.new()
    try:
        bm.from_mesh(gown.data)
        bm.verts.ensure_lookup_table()
        loops = {s:nearest_boundary_loop(bm.edges,lambda v:gown.matrix_world @ v.co,
                                        p['wrist']-p['axis']*.06) for s,p in profiles.items()}
        if loops['L'] & loops['R']:
            raise RuntimeError('Wrapped sleeve openings are not independent')
        inverse = gown.matrix_world.inverted()
        for side,p in profiles.items():
            ring = ordered_boundary(loops[side])
            points = []
            for vertex in ring:
                d = gown.matrix_world @ vertex.co-p['wrist']
                angle = math.atan2(d.dot(p['normal']),d.dot(p['across']))
                points.append(inverse @ (p['wrist']-p['axis']*.06+
                    p['across']*(.042*math.cos(angle))+p['normal']*(.031*math.sin(angle))))
            bridge_rings(bm,ring,points)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(gown.data)
    finally:
        bm.free()
    gown.data.update()
