"""Step 6: draped torso plus independent posed cloth sleeves, world metres.

Voxel-union of close hands merges their open cuffs before the simulation.
Keep each sleeve as a labelled mesh island from construction through export;
shoulder roots overlap inside the torso, and only the torso needs cloth sim.
No changes to the legacy builder or the approved step-4/5 pipeline.
"""
import math
import bmesh
import bpy

from gown import (FABRIC_V2, TRIM, evaluated_body, fabric_material, landmarks,
                  neckline, open_garment, ribbon, sleeve_shell_v2, torso_shell, unify)
from back_closure_v2 import simulate_closed_back
from sleeve_clearance_v2 import enforce_hand_clearance, smooth_hand_sleeves
from seam_boundary_v2 import restore_owned_rims


def island_normals(obj):
    """Recalculate normals without welding touching left/right cloth islands."""
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
    finally:
        bm.free()
    obj.data.update()


def open_authored_tip(sleeve):
    """Remove only the loft's terminal cap, never a proximity-selected surface."""
    bm = bmesh.new()
    try:
        bm.from_mesh(sleeve.data)
        bm.faces.ensure_lookup_table()
        # loft appends root cap, then tip cap after the side quads.
        tip = bm.faces[-1]
        assert len(tip.verts) == 48, 'Unexpected authored sleeve tip topology'
        bmesh.ops.delete(bm, geom=[tip], context='FACES_ONLY')
        bm.to_mesh(sleeve.data)
    finally:
        bm.free()
    sleeve.data.update()


def build_gloving_gown(human, rig, colliders, profiles):
    marks = landmarks(rig)
    torso, center = torso_shell(evaluated_body(human), marks)
    torso = unify([torso])
    open_garment(torso, rig, marks, center, 'tied')
    simulate_closed_back(torso, rig, colliders, marks, center)
    material = fabric_material('v2-gloving-fabric', FABRIC_V2, .9)
    torso.data.materials.append(material)
    pieces = [torso]
    for side, profile in profiles.items():
        sleeve = sleeve_shell_v2(rig, side, profile)
        open_authored_tip(sleeve)
        # Ownership survives join and decimation through deform weights.
        name = f'v2-owned-sleeve-{side}'
        group = sleeve.vertex_groups.new(name=name)
        group.add(list(range(len(sleeve.data.vertices))), 1, 'REPLACE')
        profile['seam_group'] = name
        for vertex in sleeve.data.vertices:
            delta = vertex.co-profile['wrist']
            z = delta.dot(profile['axis'])
            radial = delta-profile['axis']*z
            # Small irregular elbow compression, away from hand envelope/rim.
            if -.22 < z < profile['hand_start']-.035 and radial.length > .001:
                wave = .0025*math.sin(z*61+radial.dot(profile['across'])*17)
                vertex.co += radial.normalized()*wave*math.sin(math.pi*(z+.22)/.22)**2
        smooth_hand_sleeves(sleeve, {side: profile})
        enforce_hand_clearance(sleeve, {side: profile}, 'independent-sleeve')
        restore_owned_rims(sleeve, {side: profile})
        sleeve.data.materials.append(material)
        pieces.append(sleeve)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = torso
    bpy.ops.object.join()  # Deliberately no voxel remesh/weld after this join.
    torso.name = 'v2-gown'
    island_normals(torso)
    torso.data.polygons.foreach_set('use_smooth', [True]*len(torso.data.polygons))
    ring = neckline(torso, marks)
    if ring:
        ribbon('v2-neck-binding', ring[::max(1,len(ring)//44)],
               fabric_material('v2-binding',TRIM), width=0, thickness=.0042)
    print('GLOVING independent sleeve islands; torso simulated, cuff topology preserved')
    return torso, marks
