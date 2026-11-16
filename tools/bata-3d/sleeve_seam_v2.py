"""Gathered sleeve-to-knit seam. World metres, Z up, figure faces -Y."""
import bisect
import math

from cuffs_v2 import CUFF_LENGTH_M, CUFF_OVERLAP_M, CUFF_RIB_M, CUFF_RIDGES, cuff_axes, inside_cuff

TAPER_LENGTH_M = 0.04
SEAM_ALLOWANCE_M = 0.0015
GATHER_COUNT = 7
GATHER_AMPLITUDE_M = 0.0025
GATHER_LENGTH_M = 0.012


def seam_polygon(p):
    """Exact 112-sided cuff outer section at the sewing plane, radial metres.

    The seam stays in the cuff's untapered proximal half. Thus these points
    match the actual loft faces, including their 28 one-millimetre ribs.
    """
    t = (p['sleeve_end']-p['start'])/CUFF_LENGTH_M
    assert 0 <= t <= 0.5, 'Seam must stay in the proximal half of the cuff'
    a, b = cuff_axes(t, p['mid'])
    polygon, angles = [], []
    for j in range(112):
        theta = 2*math.pi*j/112
        rib = CUFF_RIB_M*math.cos(CUFF_RIDGES*theta)
        x, y = (a+rib)*math.cos(theta), (b+rib)*math.sin(theta)
        polygon.append((x, y))
        angles.append(math.atan2(y, x) % (2*math.pi))
    p['seam_polygon'], p['seam_angles'] = polygon, angles
    p['seam_axes'] = (a, b)


def cuff_radius(p, angle):
    """Ray intersection with the actual polygonal knit wall, metres."""
    angle %= 2*math.pi
    index = (bisect.bisect_right(p['seam_angles'], angle)-1) % 112
    x, y = p['seam_polygon'][index]
    bx, by = p['seam_polygon'][(index+1) % 112]
    ux, uy = math.cos(angle), math.sin(angle)
    vx, vy = bx-x, by-y
    return (x*vy-y*vx)/(ux*vy-uy*vx)


def taper_radius(z, angle, p):
    """Four-centimetre smooth taper to the cuff +1.5 mm, radial metres.

    Seven 2.5 mm gather pleats peak 6 mm upstream of the stitching and vanish
    at the exact sewing line. This retains the requested <=3 mm seam gap.
    """
    t = max(0, min(1, (z-(p['sleeve_end']-TAPER_LENGTH_M))/TAPER_LENGTH_M))
    blend = t*t*(3-2*t)
    seam = cuff_radius(p, angle)+SEAM_ALLOWANCE_M
    radius = p['palm_radius']*(1-blend)+seam*blend
    distance = p['sleeve_end']-z
    if 0 < distance < GATHER_LENGTH_M:
        envelope = math.sin(math.pi*distance/GATHER_LENGTH_M)**2
        radius += GATHER_AMPLITUDE_M*envelope*math.cos(GATHER_COUNT*angle+distance*25)
    return radius


def choose_seams(layouts, hands, minimum_shift_m=0.0):
    """Move an obstructed sewing plane 1–2 cm distal, never flare the rim.

    Keep cuff length and fingertip inset fixed. A distal sewing plane hides a
    little more proximal knit inside the sleeve; print its actual overlap.
    Clearance in the taper is checked against every posed hand vertex.
    """
    for side, p in layouts.items():
        guard = p.get('coverage_guard', False)
        if guard:
            from sleeve_guard_v2 import guarded_taper_radius, MIN_TAPER_RUN_M
        base = p['start']+CUFF_OVERLAP_M
        offset = p['across']*p['offset'][0]+p['normal']*p['offset'][1]
        for shift in (0.0, 0.01, 0.02):
            if shift < minimum_shift_m:
                continue
            p['sleeve_end'] = base+shift
            seam_polygon(p)
            p['rim'] = p['wrist']+p['axis']*p['sleeve_end']+offset
            blocked = 0
            if guard and p['sleeve_end']-p['guard_last_skin'] < MIN_TAPER_RUN_M:
                continue
            for point in hands[side]:
                if guard and inside_cuff(p, point):
                    continue
                delta = point-p['wrist']-offset
                z = delta.dot(p['axis'])
                if z > p['sleeve_end']:
                    blocked += not inside_cuff(p, point)
                    continue
                if z < p['sleeve_end']-TAPER_LENGTH_M:
                    continue
                x, y = delta.dot(p['across']), delta.dot(p['normal'])
                if guard:
                    blocked += math.hypot(x, y)+0.010 > guarded_taper_radius(z, math.atan2(y, x), p)
                else:
                    blocked += math.hypot(x, y)+0.003 > taper_radius(z, math.atan2(y, x), p)
            if not blocked:
                break
        else:
            raise RuntimeError(f'{side}: knuckles obstruct taper even with seam 2 cm distal')
        print('SLEEVE sewn seam', side, 'distal shift cm', shift*100,
              'overlap cm', round((p['sleeve_end']-p['start'])*100, 2),
              'taper cm', TAPER_LENGTH_M*100,
              'cuff semi-axes cm', tuple(round(r*100, 3) for r in p['seam_axes']),
              'allowance mm', SEAM_ALLOWANCE_M*1000,
              'gather pleats', GATHER_COUNT, 'amplitude mm', GATHER_AMPLITUDE_M*1000)


def assert_seam_gap(gown, layouts):
    """Measure final boundary vertices AND edge interiors against the knit.

    World metres, actual gown mesh after decimation and seam restoration.
    Knit radius is the exact loft polygon section (not an ideal ellipse).
    """
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(gown.data)
    for side, p in layouts.items():
        gaps, axial = [], []
        offset = p['across']*p['offset'][0]+p['normal']*p['offset'][1]
        edges = [e for e in bm.edges if e.is_boundary and all(
            (gown.matrix_world @ v.co-p['rim']).length < 0.08 for v in e.verts)]
        if p.get('owned_seam', False):
            from seam_boundary_v2 import sleeve_boundary
            edges = sleeve_boundary(gown, bm, p)
        if not edges:
            bm.free()
            raise RuntimeError(f'{side}: no sewn sleeve boundary')
        for edge in edges:
            a, b = (gown.matrix_world @ v.co for v in edge.verts)
            for j in range(9):
                delta = a.lerp(b, j/8)-p['wrist']-offset
                x, y = delta.dot(p['across']), delta.dot(p['normal'])
                gaps.append(math.hypot(x, y)-cuff_radius(p, math.atan2(y, x)))
                axial.append(abs(delta.dot(p['axis'])-p['sleeve_end']))
        maximum = max(abs(gap) for gap in gaps)
        print('SEAM max radial gap', side, round(max(gaps)*1000, 4), 'mm',
              'max absolute gap mm', round(maximum*1000, 4), 'samples', len(gaps))
        assert maximum <= 0.0045, f'{side}: seam radial gap exceeds 4.5 mm'
        assert max(axial) <= 0.0005, f'{side}: sleeve seam left sewing plane'
    bm.free()
