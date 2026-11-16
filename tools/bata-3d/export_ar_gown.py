"""Standalone AR garment exporter; run with the isolated env.sh Blender profile."""
import ast
import json
import math
import os
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
from common import build_human, clear_scene, pose_relaxed
from gown import bone_head, bone_tail, build_gown

# build_step has an unconditional CLI main(). Load its definitions without invoking it.
source = ast.parse((HERE / 'build_step.py').read_text())
source.body = [n for n in source.body if not (
    isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)
    and isinstance(n.value.func, ast.Name) and n.value.func.id == 'main')]
step = {'__file__': str(HERE / 'build_step.py')}
exec(compile(source, str(HERE / 'build_step.py'), 'exec'), step)
OUTPUT = HERE.parent.parent / 'apps/web/public/models/bata-ar-rig.glb'


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def make_rig(old, marks, objects):
    data = bpy.data.armatures.new('ar_rig')
    rig = bpy.data.objects.new('ar_rig', data)
    bpy.context.scene.collection.objects.link(rig)
    active(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    contract = {}

    def add(name, head, tail, parent=None):
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = data.edit_bones[parent]
        contract[name] = parent

    hip = (bone_head(old, 'upperleg01.L') + bone_head(old, 'upperleg01.R')) / 2
    mid = bone_head(old, 'spine03')
    neck = bone_head(old, 'neck01')
    add('root', hip, bone_head(old, 'spine04'))
    add('spine', bone_head(old, 'spine04'), mid, 'root')
    add('chest', mid, neck, 'spine')
    add('neck', neck, bone_tail(old, 'neck02'), 'chest')
    for side in ('L', 'R'):
        shoulder = bone_head(old, f'upperarm01.{side}')
        elbow = bone_head(old, f'lowerarm01.{side}')
        wrist = bone_head(old, f'wrist.{side}')
        add(f'shoulder.{side}', bone_head(old, f'clavicle.{side}'), shoulder, 'chest')
        add(f'upperarm.{side}', shoulder, elbow, f'shoulder.{side}')
        add(f'forearm.{side}', elbow, wrist, f'upperarm.{side}')
        add(f'hand.{side}', wrist, bone_tail(old, f'wrist.{side}'), f'forearm.{side}')
        add(f'sleeve.{side}', elbow.lerp(wrist, .65), wrist, f'forearm.{side}')
    for label, x, y in [('F', 0, -.19), ('B', 0, .19), ('L', .20, 0), ('R', -.20, 0)]:
        top = Vector((x, hip.y + y, marks['waist']))
        end = Vector((x * 1.4, hip.y + y * 1.4, marks['hem']))
        middle = top.lerp(end, .5)
        add(f'hem.{label}.1', top, middle, 'root')
        add(f'hem.{label}.2', middle, end, f'hem.{label}.1')
    knot = next(o for o in objects if o.name.startswith('tie-front-knot'))
    # Transforms were applied before rigging, so the object origin is the floor: use the
    # geometry centre of the knot instead.
    verts = [knot.matrix_world @ v.co for v in knot.data.vertices]
    origin = sum(verts, Vector()) / max(1, len(verts))
    for side, sign in [('L', 1), ('R', -1)]:
        add(f'tie.{side}', origin, origin + Vector((sign * .05, -.008, -.20)), 'root')
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig, contract


def skin(obj, body, rig, marks):
    active(obj)
    for group in body.vertex_groups:
        obj.vertex_groups.new(name=group.name)
    transfer = obj.modifiers.new('MPFB nearest face interpolated', 'DATA_TRANSFER')
    transfer.object = body
    transfer.use_vert_data = True
    transfer.data_types_verts = {'VGROUP_WEIGHTS'}
    transfer.vert_mapping = 'POLYINTERP_NEAREST'
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    names = {g.index: g.name for g in obj.vertex_groups}
    weights = []
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        w = {}
        for g in v.groups:
            name = names[g.group]
            side = 'L' if name.endswith('.L') else 'R'
            target = None
            for prefix, dest in [('clavicle', 'shoulder'), ('upperarm', 'upperarm'), ('lowerarm', 'forearm'), ('wrist', 'hand'), ('hand', 'hand'), ('finger', 'hand'), ('metacarpal', 'hand')]:
                if name.startswith(prefix):
                    target = f'{dest}.{side}'
                    break
            if name.startswith('neck'):
                target = 'neck'
            if name.startswith(('spine', 'pelvis', 'root')):
                target = 'root' if p.z < marks['waist'] + .05 else ('spine' if p.z < rig.data.bones['chest'].head_local.z else 'chest')
            if target:
                w[target] = w.get(target, 0) + g.weight
        w = {k: value for k, value in w.items() if value > 1e-6}
        if not w:
            w = {'root': 1.0}
        total = sum(w.values())
        w = {k: value / total for k, value in w.items()}
        arm = sum(value for k, value in w.items() if k.startswith(('upperarm.', 'forearm.', 'hand.')))
        if p.z < marks['waist'] and arm < .35:
            t = min(1, max(0, (marks['waist'] - p.z) / (marks['waist'] - marks['hem'])))
            angle = math.atan2(p.y - rig.data.bones['root'].head_local.y, p.x)
            sector = (angle / (math.pi / 2)) % 4
            i, fraction = int(sector), sector % 1
            labels = ['L', 'B', 'R', 'F']
            w = {'root': 1 - min(1, t * 2)}
            for label, amount in [(labels[i], 1 - fraction), (labels[(i + 1) % 4], fraction)]:
                w[f'hem.{label}.1'] = amount * (min(1, t * 2) - max(0, t * 2 - 1))
                w[f'hem.{label}.2'] = amount * max(0, t * 2 - 1)
        for side in ('L', 'R'):
            bone = rig.data.bones[f'forearm.{side}']
            axis = bone.tail_local - bone.head_local
            along = (p - bone.head_local).dot(axis) / axis.length_squared
            if p.x * (1 if side == 'L' else -1) > .18 and arm > .4:
                blend = min(1, max(0, (along - .65) / .35)) * .75
                w = {k: value * (1 - blend) for k, value in w.items()}
                w[f'sleeve.{side}'] = blend
        if obj.name.startswith('tie-front'):
            origin = rig.data.bones['tie.L'].head_local
            blend = min(1, max(0, (origin.z - p.z) / .065))
            w = {'root': 1 - blend, f"tie.{'L' if p.x >= origin.x else 'R'}": blend}
        w = dict(sorted(((k, value) for k, value in w.items() if value > 1e-7), key=lambda kv: -kv[1])[:4])
        total = sum(w.values())
        weights.append({k: value / total for k, value in w.items()})
    obj.vertex_groups.clear()
    groups = {b.name: obj.vertex_groups.new(name=b.name) for b in rig.data.bones}
    for index, w in enumerate(weights):
        for name, value in w.items():
            groups[name].add([index], value, 'REPLACE')
    modifier = obj.modifiers.new('ar_rig', 'ARMATURE')
    modifier.object = rig
    obj.parent = rig


def verify(contract):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(OUTPUT))
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(rigs) == 1
    rig = rigs[0]
    assert set(contract) == set(rig.data.bones.keys())
    for name, parent in contract.items():
        assert (rig.data.bones[name].parent.name if rig.data.bones[name].parent else None) == parent
    # Only the GLB's meshes (children of the rig): the importer adds an Icosphere bone-shape helper.
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == rig]
    count = sum(step['triangles'](o) for o in meshes)
    maximum = 0
    for obj in meshes:
        # Blender 5's glTF importer may parent skinned meshes to the armature instead of adding a modifier.
        assert any(m.type == 'ARMATURE' for m in obj.modifiers) or (obj.parent and obj.parent.type == 'ARMATURE'), obj.name
        assert not obj.data.shape_keys
        for vertex in obj.data.vertices:
            values = [g.weight for g in vertex.groups if g.weight > 1e-6]
            maximum = max(maximum, len(values))
            assert values and abs(sum(values) - 1) < .001
    assert maximum <= 4 and count <= 25000 and OUTPUT.stat().st_size <= 1500000
    assert not bpy.data.actions
    def position(name, tail=False):
        bone = rig.data.bones[name]
        p = rig.matrix_world @ (bone.tail_local if tail else bone.head_local)
        return [round(p.x, 6), round(p.z, 6), round(-p.y, 6)]
    report = {'bones': list(contract), 'triangles': count, 'bytes': OUTPUT.stat().st_size,
              'max_influences': maximum,
              'shoulder_width_m': round((rig.data.bones['upperarm.L'].head_local - rig.data.bones['upperarm.R'].head_local).length, 6),
              'world_gltf_m': {name: position(name) for name in ['root', 'shoulder.L', 'shoulder.R', 'hand.L', 'hand.R']}}
    report['world_gltf_m'].update({f'hem.{s}.end': position(f'hem.{s}.2', True) for s in 'FBLR'})
    print('AR_VERIFICATION ' + json.dumps(report, indent=2), flush=True)
    return report


def main():
    clear_scene()
    human, old, clothes = build_human()
    pose_relaxed(old)
    bpy.context.view_layer.update()
    body = step['whole_body_copy'](human)
    # Evaluated mesh carries deform indices; copy their matching group definitions.
    for group in human.vertex_groups:
        body.vertex_groups.new(name=group.name)
    frozen = step['freeze']([clothes['toigo_wool_pants']])
    gown, trims, marks, _ = build_gown(human, old, [body, frozen[clothes['toigo_wool_pants'].name]], step['CLOSURE'][6], covered=False, slim_sleeves=True)
    objects = [gown, *trims]
    for obj in objects:
        active(obj)
        if obj.type == 'CURVE':
            bpy.ops.object.convert(target='MESH')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    other = sum(step['triangles'](o) for o in trims)
    count = step['triangles'](gown)
    if count + other > 24500:
        step['decimate'](gown, (24500 - other) / count)
    rig, contract = make_rig(old, marks, objects)
    for obj in objects:
        skin(obj, body, rig, marks)
    for obj in list(bpy.data.objects):
        if obj not in objects and obj != rig:
            bpy.data.objects.remove(obj, do_unlink=True)
    for image in bpy.data.images:
        if max(image.size) > 1024:
            factor = 1024 / max(image.size)
            image.scale(max(1, int(image.size[0] * factor)), max(1, int(image.size[1] * factor)))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True,
        export_skins=True, export_animations=False, export_morph=False, export_apply=False,
        export_image_format='WEBP', export_image_quality=90,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12)
    report = verify(contract)
    # env.sh needs bash (BASH_SOURCE); from zsh it does not load the MPFB profile.
    command = "cd tools/bata-3d && bash -c 'source ./env.sh && blender --background --python export_ar_gown.py' > .work/ar_rig.log 2>&1"
    doc = '# AR gown rig contract\n\nRun from the repository root (isolated MPFB profile):\n\n```bash\n' + command + '\n```\n\nGeneric closed wrapped gown, cuffs, bindings and bows only. Rest pose is baked from `pose_relaxed`: upper arms rotated 21° down from the MPFB default, elbows softened by 14°. This is the neutral bind pose; drive rotations relative to it. Units are metres, glTF Y-up, facing +Z (Blender faces -Y). No animations or morphs. Materials and UVs are preserved; procedural weave is not baked into textures. Draco decoding is required.\n\nBones and parents:\n\n| Bone | Parent |\n|---|---|\n'
    doc += ''.join(f'| {name} | {parent or "—"} |\n' for name, parent in contract.items())
    doc += '\nHem chains start at the waist, midpoint at half skirt height, and end at the hem. L/R are wearer sides. Sleeve bones share the distal 35% of the forearm region; front bow tails reach 100% tie weight after 6.5 cm. Top four influences are normalized. Shoulder width (upperarm heads): ' + str(report['shoulder_width_m']) + ' m.\n\nVerified by reimporting the exported GLB; coordinates below are world glTF coordinates.\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n'
    (HERE / 'AR_RIG.md').write_text(doc)


if __name__ == '__main__':
    main()
