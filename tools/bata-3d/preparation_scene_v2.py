"""Configured preparation and wrapped scenes; world metres, Z up, front -Y."""
import math
import bpy
from mathutils import Vector
from common import build_human, clear_scene, setup_render, render_views
from gown import (FABRIC_V2, TRIM, bone_head, build_gown, evaluated_body,
                  fabric_material, landmarks, surgical_cap)
from steps_v2 import pose_step_v2
from preparation_cloth_v2 import suspended_gown, towel
from detail_v2 import reduce_cap_elastic
from budget_v2 import fit_extra_budget
from worn_gloves_v2 import fitted_gloves, close_sleeve_to_knit
from transfer_v2 import transfer_card


def wrapped(human, rig, colliders):
    """Reuse wrapped flap simulation without modifying any legacy function.

    Replaces only this new scene's legacy cuff objects with v2 rib geometry.
    Gloves are posed skin shells with a continuous smooth latex cuff.
    """
    from cuffs_v2 import build_cuffs
    from hands import hand_frame
    before=set(bpy.data.objects)
    gown,trims,marks,bows=build_gown(human,rig,colliders,'wrapped',covered=False,slim_sleeves=True)
    blue=fabric_material('v2-wrapped-fabric',FABRIC_V2,.9)
    gown.data.materials.clear()
    gown.data.materials.append(blue)
    # Legacy add_cuff names are inspected only in this isolated wrapped scene.
    for obj in list(set(bpy.data.objects)-before):
        if 'cuff' in obj.name.lower() or obj.name.startswith(('tie-neck','tie-front','tie-waist-belt')):
            bpy.data.objects.remove(obj,do_unlink=True)
    profiles={}
    for side in 'LR':
        wrist=bone_head(rig,f'wrist.{side}')
        axis=(wrist-bone_head(rig,f'lowerarm02.{side}')).normalized()
        _,across,_=hand_frame(rig,side)
        across=rig.matrix_world.to_3x3()@across
        across=(across-axis*across.dot(axis)).normalized()
        profiles[side]=dict(wrist=wrist,axis=axis,across=across,normal=axis.cross(across).normalized(),
                            start=-.07,end=0,offset=(0,0),mid=(.042,.031))
    cuffs=build_cuffs(profiles,axial_segments=6)
    from fastening_v2 import build_fastening
    build_fastening(gown,marks)
    return gown,cuffs,marks,profiles


def render_detail_view(rig, context, prefix):
    """Portrait detail framing both hands, world metres; adaptive camera distance."""
    wrists=[bone_head(rig,f'wrist.{s}') for s in 'LR']
    target=context.get('detail_target',sum(wrists,Vector())/2)
    span=max((p-target).length for p in wrists)+.24
    distance=max(.95,span*2.6)
    offset=Vector((.28,-1,.15)).normalized()*distance
    scene=bpy.context.scene
    camera=scene.camera
    camera.data.lens=45
    camera.location=target+offset
    camera.rotation_euler=(-offset).to_track_quat('-Z','Y').to_euler()
    from pathlib import Path
    path=Path(__file__).resolve().parent/'.work/out'/f'{prefix}-detail.png'
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    return str(path)


def run(step, config, args, api):
    """Build configured none/held/wrapped garment; strict export/geometry budgets."""
    api.MODELS.mkdir(parents=True,exist_ok=True)
    helpers=api.legacy_helpers()
    clear_scene()
    human,rig,clothes=build_human(gloves=config['gloves'] and step != 7)
    pose_step_v2(rig,step)
    bpy.context.view_layer.update()
    marks=landmarks(rig)
    collider=helpers['whole_body_copy'](human)
    if step == 1:
        # Keep every authored shirt sleeve face; no clothing mask may trim it.
        shirt = clothes['joepal_crude_t-shirt_female']
        for modifier in shirt.modifiers:
            if modifier.type == 'MASK':
                modifier.show_viewport = False
        # The stock shirt's body-hiding mask can expose a jagged skin cut when
        # the raised arm pulls the sleeve hem away. Keep the underlying arm too.
        for modifier in human.modifiers:
            if modifier.type == 'MASK' and 'shirt' in modifier.name.lower():
                modifier.show_viewport = False
        bpy.context.view_layer.update()
    frozen=helpers['freeze']([o for o in helpers['character_meshes'](rig) if o!=collider])
    api.check_protocol(api.measured_hands(human,collider,threshold=.01),rig,marks)
    helpers['decimate'](frozen[clothes['toigo_flats'].name],helpers['SHOES_RATIO'])
    surgical_cap(evaluated_body(human),marks,fabric_material('v2-cap',(.105,.32,.35,1)),
                 fabric_material('v2-cap-trim',TRIM))
    reduce_cap_elastic(helpers,config['cap_elastic_triangles'])
    cuffs=[]
    context={}
    if config['garment']=='none':
        towel(rig)
    elif config['garment'] in ('folded','unfolded'):
        _,cuffs=suspended_gown(rig,config['garment']=='folded')
    elif config['garment']=='wrapped':
        api.trim_scrub_shirt(frozen[clothes['joepal_crude_t-shirt_female'].name],marks)
        gown,cuffs,marks,profiles=wrapped(human,rig,[collider,frozen[clothes['toigo_wool_pants'].name]])
        count=helpers['triangles'](gown)
        if count>helpers['GOWN_TRIANGLES']:
            helpers['decimate'](gown,helpers['GOWN_TRIANGLES']/count)
        close_sleeve_to_knit(gown,profiles)
        fitted_gloves(human,rig,profiles)
        context=transfer_card(human,rig,marks)
    else:
        raise ValueError(f"Unsupported garment {config['garment']}")
    fit_extra_budget(helpers,context,cuffs,limit=80000,cuff_floor=3000)
    counts={o.name:helpers['triangles'](o) for o in helpers['visible_objects']()}
    total=sum(counts.values())
    print('TRIANGLES',total,dict(sorted(counts.items(),key=lambda p:-p[1])))
    assert total<=80000,f'OVER BUDGET: {total} triangles'
    paths=[]
    if 'export' in args:
        helpers['export_glb'](step)
        path=api.MODELS/f'paso-{step}.glb'
        if path.stat().st_size>helpers['MAX_GLB_BYTES']:
            path.unlink()
            raise RuntimeError('GLB OVER BUDGET: above 3 MB')
        paths.append(str(path))
    setup_render(samples=64,res=(620,930))
    prefix=f'v2-paso{step}'
    paths+=render_views(prefix,config['views'])
    paths.append(render_detail_view(rig,context,prefix))
    print('PATHS',paths)
