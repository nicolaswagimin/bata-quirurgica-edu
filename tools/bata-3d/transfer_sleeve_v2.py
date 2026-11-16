"""Small closed ten-centimetre transfer forearm; isolated from step 5."""
import math

TRANSFER_SLEEVE_RADIUS_M = .045
TRANSFER_SLEEVE_LENGTH_M = .10


def cap_profile(radius=TRANSFER_SLEEVE_RADIUS_M):
    """Rounded proximal cap reaches sleeve radius without a flared disk."""
    return [(-.10+.022*(1-math.cos(a)), radius*math.sin(a))
            for a in (math.pi/2*i/8 for i in range(9))]+[(-.04,radius),(-.035,radius)]


def assert_cap_radius(points, wrist, axis, radius):
    cap = []
    for point in points:
        delta = point-wrist
        z = delta.dot(axis)
        if z <= -.078+1e-8:
            cap.append((delta-axis*z).length)
    assert cap, 'Missing rounded transfer sleeve cap'
    maximum = max(cap)
    assert maximum <= 1.2*radius, 'Transfer sleeve cap exceeds 1.2 x sleeve radius'
    return maximum


def transfer_sleeve(wrist, axis, skin):
    """Fixed anatomical sleeve; fail on bad forearm extraction instead of inflating."""
    import bmesh
    from common import SCRUBS
    from gown import fabric_material, loft
    u = axis.orthogonal().normalized()
    v = axis.cross(u).normalized()
    radius = TRANSFER_SLEEVE_RADIUS_M
    for vertex in skin.data.vertices:
        delta = vertex.co-wrist
        z = delta.dot(axis)
        if -.075 <= z <= -.035:
            assert (delta-axis*z).length < radius-.002, 'Transfer forearm not aligned with sleeve'
    rings = [[wrist+axis*z+(u*math.cos(a)+v*math.sin(a))*max(r,.0001)
              for a in (2*math.pi*j/32 for j in range(32))] for z,r in cap_profile()]
    sleeve = loft('v2-card-circulator-short-sleeve', rings, cap=False)
    bm = bmesh.new()
    bm.from_mesh(sleeve.data)
    bm.verts.ensure_lookup_table()
    bm.faces.new([bm.verts[i] for i in range(31,-1,-1)])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(sleeve.data)
    bm.free()
    sleeve.data.materials.append(fabric_material('v2-card-circulator-scrub',SCRUBS,.85))
    sleeve.data.polygons.foreach_set('use_smooth',[True]*len(sleeve.data.polygons))
    maximum = assert_cap_radius([v.co for v in sleeve.data.vertices],wrist,axis,radius)
    print('TRANSFER sleeve length cm',10,'radius cm',radius*100,'cap radius cm',maximum*100)
    return [sleeve]
