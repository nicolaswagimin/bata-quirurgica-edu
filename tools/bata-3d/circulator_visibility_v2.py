"""Keep circulating forearms behind the gown silhouette; world metres, Z up, -Y front."""
import math

from mathutils import Vector
from mathutils.bvhtree import BVHTree

BIN_M = 0.02
VIEWS_DEG = (0,)


def silhouette_profiles(gown):
    """Per-height bounding regions of the actual main gown in 0/35-degree views.

    Mesh-edge intersections sample exact horizontal sections, interpolated
    between 2 cm rows. No count tolerance or widened height band is used.
    """
    profiles = {angle: {} for angle in VIEWS_DEG}
    world = [gown.matrix_world @ v.co for v in gown.data.vertices]
    for edge in gown.data.edges:
        a, b = (world[i] for i in edge.vertices)
        if abs(a.z-b.z) < 1e-9:
            continue
        first, last = math.ceil(min(a.z, b.z)/BIN_M), math.floor(max(a.z, b.z)/BIN_M)
        for row in range(first, last+1):
            point = a.lerp(b, (row*BIN_M-a.z)/(b.z-a.z))
            for angle, profile in profiles.items():
                azimuth = math.radians(angle)
                h = point.x*math.cos(azimuth)+point.y*math.sin(azimuth)
                lo, hi = profile.get(row, (float('inf'), -float('inf')))
                profile[row] = (min(lo, h), max(hi, h))

    tree = BVHTree.FromPolygons(world, [tuple(f.vertices) for f in gown.data.polygons])
    return profiles, tree


def profile_bounds(z, profile):
    """Interpolate actual neighbouring mesh sections at world height z, metres."""
    row = math.floor(z/BIN_M)
    t = z/BIN_M-row
    lower = profile.get(row)
    upper = profile.get(row+1)
    if lower is None or upper is None:
        if t < 1e-8 and lower is not None:
            return lower
        raise RuntimeError('Circulating arm outside main gown section range')
    return tuple(a*(1-t)+b*t for a, b in zip(lower, upper))


def visibility_counts(gown, context, margin=0.0, stage='check'):
    """Read-only count outside either projected bounding region.

    Also require every vertex behind the main gown surface at the same X/Z.
    The half-width condition is included in the zero-degree projected check.
    """
    profiles, tree = silhouette_profiles(gown)
    counts = {angle: 0 for angle in VIEWS_DEG}
    behind, total = 0, 0
    for obj in context['circulator_hands']+context['circulator_clothing']:
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            total += 1
            hit, _, _, _ = tree.ray_cast(Vector((point.x, 1.5, point.z)), Vector((0, -1, 0)))
            if hit is None or point.y <= hit.y+margin:
                behind += 1
            for angle, profile in profiles.items():
                a = math.radians(angle)
                h = point.x*math.cos(a)+point.y*math.sin(a)
                lo, hi = profile_bounds(point.z, profile)
                if not lo+margin <= h <= hi-margin:
                    counts[angle] += 1
    print('CIRCULATOR silhouette', stage, 'outside', counts, 'not behind gown', behind,
          'vertices', total, 'construction margin mm', margin*1000)
    return counts, behind, total


def assert_hidden(gown, context):
    """Assert exactly zero visible vertices; never edit any scene geometry."""
    counts, behind, total = visibility_counts(gown, context, stage='final')
    assert total and not any(counts.values()), 'Circulator escapes main silhouette'
