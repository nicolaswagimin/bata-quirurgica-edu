"""Front ties and transfer card with one circulating hand; world metres, Z up."""
import bpy
from mathutils import Vector
from gown import TRIM, bone_head, bone_tail, fabric_material, ribbon
from hands import pose_hand
from poses import orient_hand, _aim
from gloves_v2 import extract_hand
from circulator_v2 import copy_source
from transfer_sleeve_v2 import transfer_sleeve
from circulator_trim_v2 import cut_skin


def transfer_card(human, rig, marks):
    """White 10x7 cm card; circulator touches only its outer tip at +X (left)."""
    material=fabric_material('v2-tie-trim',TRIM,.94)
    left=bone_head(rig,'finger2-3.L')
    right=bone_tail(rig,'finger2-3.R')
    tip=Vector((.52,-.34,1.18))
    center=tip-Vector((.05,0,0))
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    card=bpy.context.object
    card.name='v2-transfer-card-no-text'
    card.scale=(.10,.0015,.07)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    card.data.materials.append(fabric_material('v2-card-white',(.9,.9,.87,1),.9))
    for name,points in (
        ('left',[(.16,-.19,marks['waist']+.04),tuple(left),(.05,-.29,marks['waist']+.015)]),
        ('right',[(-.15,-.18,marks['waist']+.04),tuple(right),(.42,-.34,1.18)])):
        ribbon('v2-front-tie-'+name,points,material,width=.006,thickness=.0008)
    source,other=copy_source(human,rig,{'waist':Vector((0,0,1))})
    # Retain a single genuinely posed pinch hand; rigid placement puts pad on card tip.
    # Align the retained forearm before turning the wrist: measuring an oblique
    # rest-pose forearm against the hand axis inflated the old cap into a disk.
    elbow = other.pose.bones['lowerarm01.R'].head.copy()
    wrist_local = other.pose.bones['wrist.R'].head.copy()
    _aim(other, 'lowerarm01.R', elbow, wrist_local-elbow, Vector((-1,0,0)))
    orient_hand(other,'R',Vector((-1,0,0)),Vector((0,0,1)))
    pose_hand(other,'R','pinch')
    bpy.context.view_layer.update()
    hand,wrist,axis=extract_hand(source,other,'R','v2-card-circulator-hand',forearm=.075,inflation=0)
    pad=(bone_tail(other,'finger1-3.R')+bone_tail(other,'finger2-3.R'))/2
    delta=tip-pad
    for v in hand.data.vertices:
        v.co+=delta
    wrist+=delta
    cut_skin(hand.data,wrist,axis,.075)
    clothing=transfer_sleeve(wrist,axis,hand)
    bpy.data.objects.remove(source,do_unlink=True)
    bpy.data.objects.remove(other,do_unlink=True)
    # Every circulating skin vertex must be clear of the sterile main hands.
    main_points=[bone_tail(rig,f'finger{i}-3.{s}') for s in 'LR' for i in range(1,6)]
    clearance=min((v.co-p).length for v in hand.data.vertices for p in main_points)
    print('CARD transfer tip',tuple(tip),'circulator/main fingertip clearance cm',round(clearance*100,2))
    assert clearance>.05,'Transfer hand too close to sterile gloves'
    assert (tip-right).length>.08,'Main hand must grip tie away from card'
    return dict(detail_target=(left+tip)/2, circulator_hands=[hand],circulator_clothing=clothing)
