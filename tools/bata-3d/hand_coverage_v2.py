"""Exact sleeve/cuff coverage diagnostics. World metres, Z up, -Y front."""
import math

import bpy
from mathutils.bvhtree import BVHTree
from cuffs_v2 import inside_cuff
from sleeve_seam_v2 import TAPER_LENGTH_M


def mesh_tree(gown):
    """BVH and polygon mapping from the current evaluated gown, world metres."""
    evaluated = gown.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertices = [gown.matrix_world @ v.co for v in mesh.vertices]
    faces = [tuple(p.vertices) for p in mesh.polygons]
    tree = BVHTree.FromPolygons(vertices, faces)
    evaluated.to_mesh_clear()
    return tree, vertices, faces


def local_skin(point, profile):
    """Axial/radial coordinates about the actual palm centre, metres/radians."""
    p = profile
    offset = p['across']*p['offset'][0]+p['normal']*p['offset'][1]
    delta = point-p['wrist']-offset
    z = delta.dot(p['axis'])
    radial = delta-p['axis']*z
    angle = math.atan2(radial.dot(p['normal']), radial.dot(p['across']))
    return z, radial, angle


def describe_leak(side, profile, index, point, nearest, normal, stage):
    """Print every failing skin vertex; this does not change classification."""
    z, radial, angle = local_skin(point, profile)
    seam = profile['sleeve_end']
    region = 'past-seam' if z > seam else 'taper' if z >= seam-TAPER_LENGTH_M else 'body'
    signed = (point-nearest).dot(normal)*1000 if nearest is not None else None
    print('HAND LEAK', stage, side, 'vertex', index, 'region', region,
          'axial cm from wrist', round(z*100, 5), 'angle deg', round(math.degrees(angle), 4),
          'radius cm', round(radial.length*100, 5), 'to seam cm', round((seam-z)*100, 5),
          'signed outside mm', None if signed is None else round(signed, 5),
          'world m', tuple(round(c, 6) for c in point))


def sleeve_tree(gown, profile, vertices=None, faces=None):
    """Only the connected hand-sleeve surface, not a nearby torso/back panel."""
    selected = profile.get('guard_vertices')
    if selected is None:
        raise RuntimeError('Guarded sleeve must be finalized after decimation')
    if vertices is None:
        _, vertices, faces = mesh_tree(gown)
    ids = [i for i, face in enumerate(faces) if any(v in selected for v in face)]
    return BVHTree.FromPolygons(vertices, [faces[i] for i in ids]), ids


def sleeve_membership(tree, profile, point):
    """Actual open-tube volume, clipped axially; zero skin/count tolerance.

    Inside means the hand axis is inside and an outward exit along the envelope
    normal is farther than the skin. Global nearest-surface normals alone are
    not a containment test when the torso is closer than the hand's own sleeve.
    """
    z, radial, _ = local_skin(point, profile)
    direction = radial.normalized() if radial.length else profile['normal']
    hit, normal, face, distance = tree.ray_cast(point-radial, direction, 0.2)
    inside = (z <= profile['sleeve_end'] and hit is not None
              and normal.dot(direction) > 0 and distance >= radial.length)
    clearance = None if hit is None else distance-radial.length
    return inside, hit, normal, face, clearance


def coverage_failures(gown, layouts, hands, stage, verbose=True, use_guard=True):
    """Check strict physical volume; preserve the legacy check when unguarded."""
    tree, vertices, faces = mesh_tree(gown)
    failures = {}
    for side, p in layouts.items():
        guarded = use_guard and p.get('coverage_guard', False)
        local_tree = sleeve_tree(gown, p, vertices, faces)[0] if guarded else None
        bad = []
        for index, point in enumerate(hands[side]):
            if inside_cuff(p, point):
                continue
            if guarded:
                inside, nearest, normal, face, clearance = sleeve_membership(local_tree, p, point)
            else:
                z, _, _ = local_skin(point, p)
                nearest, normal, face, _ = tree.find_nearest(point)
                inside = z <= p['sleeve_end'] and nearest is not None and (point-nearest).dot(normal) <= 0.0
                clearance = None
            if inside:
                continue
            bad.append((index, point, nearest, normal, face))
            if verbose:
                describe_leak(side, p, index, point, nearest, normal, stage)
                if clearance is not None:
                    print('HAND LEAK radial clearance mm', side, index, round(clearance*1000, 5))
        failures[side] = bad
        print('HAND strict guard', stage, side, 'outside', len(bad), 'of', len(hands[side]))
    return failures
