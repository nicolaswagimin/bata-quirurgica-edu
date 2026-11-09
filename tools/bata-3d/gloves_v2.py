"""Open latex shells derived from MPFB hands; world metres, Z up, front -Y."""
import math
import bmesh
import bpy
from mathutils import Vector
from common import LATEX
from gown import bone_head, fabric_material, loft
from hands import hand_frame, pose_hand
from poses import orient_hand


def extract_hand(human, rig, side, name, forearm=.0, inflation=.0015):
    """Bake unmasked skin, keep one weighted hand and optional forearm; metres."""
    masks = [m for m in human.modifiers if m.type == 'MASK' and m.name != 'Hide helpers']
    flags = [m.show_viewport for m in masks]
    for m in masks:
        m.show_viewport = False
    bpy.context.view_layer.update()
    try:
        mesh = bpy.data.meshes.new_from_object(human.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    finally:
        for m, flag in zip(masks, flags):
            m.show_viewport = flag
        bpy.context.view_layer.update()
    mesh.transform(human.matrix_world)
    names = {g.index:g.name for g in human.vertex_groups}
    wrist = bone_head(rig, f'wrist.{side}')
    axis = (bone_head(rig,f'finger3-1.{side}')-wrist).normalized()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    layer = bm.verts.layers.deform.verify()
    doomed = []
    for v in bm.verts:
        weight = sum(w for g,w in v[layer].items() if names.get(g,'').endswith('.'+side)
                     and names.get(g,'').startswith(('wrist','finger','metacarpal','lowerarm')))
        if weight < .2 or (v.co-wrist).dot(axis) < -forearm or (v.co-wrist).length > .32:
            doomed.append(v)
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                          plane_co=wrist-axis*forearm, plane_no=-axis, clear_outer=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal*inflation
    bm.to_mesh(mesh)
    bm.free()
    assert len(mesh.vertices)>100, f'{side}: no usable hand skin for shell'
    obj = bpy.data.objects.new(name,mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, wrist, axis


def loose_glove(human, rig):
    """Glove_flat hand copy, palm down, fingers toward left elbow, open 7cm cuff."""
    from circulator_v2 import copy_source
    source, copy_rig = copy_source(human,rig,{'waist':Vector((0,0,1))})
    copy_rig.matrix_world = rig.matrix_world.copy()
    for a,b in zip(copy_rig.pose.bones,rig.pose.bones):
        a.matrix_basis = b.matrix_basis.copy()
    orient_hand(copy_rig,'L',Vector((0,-1,0)),Vector((1,0,0)))
    pose_hand(copy_rig,'L','glove_flat')
    bpy.context.view_layer.update()
    obj,wrist,axis = extract_hand(source,copy_rig,'L','v2-loose-latex-glove')
    _,across,_ = hand_frame(copy_rig,'L')
    across = copy_rig.matrix_world.to_3x3()@across
    normal = axis.cross(across).normalized()
    left = bone_head(rig,'wrist.L')
    hand_axis = (bone_head(rig,'finger3-1.L')-left).normalized()
    # Glove fingers reverse toward elbow; palm normal points down.
    target_axis = -hand_axis
    target_across = Vector((1,0,0))
    target_across = (target_across-target_axis*target_across.dot(target_axis)).normalized()
    target_normal = target_axis.cross(target_across).normalized()
    if target_normal.z > 0:
        target_across = -target_across
        target_normal = -target_normal
    origin = left+hand_axis*.15+Vector((0,0,.057))
    for v in obj.data.vertices:
        d=v.co-wrist
        v.co=origin+target_axis*d.dot(axis)+target_across*d.dot(across)+target_normal*d.dot(normal)
    material = fabric_material('v2-latex', LATEX,.38)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    rings = [[origin+target_axis*z+target_across*(.045*math.cos(a))+target_normal*(.027*math.sin(a))
              for a in (2*math.pi*j/48 for j in range(48))] for z in (-.07,-.065,-.035,0)]
    cuff=loft('v2-loose-glove-open-cuff',rings,cap=False)
    cuff.data.materials.append(material)
    print('GLOVE loose palm down; fingers toward elbow; open cuff cm',7,'shell offset mm',1.5)
    bpy.data.objects.remove(source,do_unlink=True)
    bpy.data.objects.remove(copy_rig,do_unlink=True)
    return [obj,cuff]


def glove_gauntlets(rig):
    """Latex extension over wrist rib cuffs, 4 cm overlap; open proximal edge."""
    material=fabric_material('v2-glove-gauntlet',LATEX,.38)
    result=[]
    for side in 'LR':
        wrist=bone_head(rig,f'wrist.{side}')
        axis=(bone_head(rig,f'finger3-1.{side}')-wrist).normalized()
        _,across,_=hand_frame(rig,side)
        across=rig.matrix_world.to_3x3()@across
        normal=axis.cross(across).normalized()
        rings=[[wrist+axis*z+across*(a*math.cos(t))+normal*(b*math.sin(t))
                for t in (2*math.pi*j/64 for j in range(64))]
               for z,a,b in ((-.075,.047,.036),(-.07,.046,.035),(-.04,.043,.032),(0,.034,.024),(.025,.034,.024))]
        obj=loft(f'v2-latex-gauntlet-{side}',rings,cap=False)
        obj.data.materials.append(material)
        result.append(obj)
    print('GLOVE cuff overlap cm',4,'LATEX',LATEX)
    return result
