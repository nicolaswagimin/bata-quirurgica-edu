"""Configured low-impact detail reduction. Mesh units metres, Z up, -Y front."""
import bpy


def reduce_cap_elastic(helpers, target):
    """Keep cap silhouette, reduce the tiny elastic trim only when configured."""
    if target is None:
        return
    for obj in list(bpy.data.objects):
        if not obj.name.startswith('cap-elastic') or obj.hide_render:
            continue
        before = helpers['triangles'](obj)
        if before <= target:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if obj.type != 'MESH':
            bpy.ops.object.convert(target='MESH')
            obj = bpy.context.object
        helpers['decimate'](obj, target/before)
        print('DETAIL cap-elastic triangles', before, '->', helpers['triangles'](obj))
