"""Select a real forearm cut for visibility; world metres, Z up, -Y front."""
import bmesh
import bpy

from circulator_v2 import scrub_sleeve
from circulator_visibility_v2 import visibility_counts

FORCE_SHORT_FOREARM = True
FOREARM_LENGTHS_M = (0.10, 0.085, 0.07)
SKIN_BURIAL_M = 0.025
VISIBILITY_MARGIN_M = 0.005  # positive headroom for subsequent skin decimation


def cut_skin(mesh, wrist, axis, length):
    """Planar forearm truncation. Retained hand vertices are never displaced."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                          plane_co=wrist-axis*length, plane_no=-axis, clear_outer=True)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def shorten(context, length):
    """Rebuild shorter skin/sleeves from originals; no X clamp or mesh squashing."""
    cut = length-SKIN_BURIAL_M
    if any(cut < limit for limit in context['circulator_min_cut_m'].values()):
        print('CIRCULATOR cut rejected', length*100, 'cm; would trim hand skin')
        return False
    frames = {side: context['circulator_frames'][f'v2-circulator-sleeve-{side}'] for side in ('L', 'R')}
    for obj in context['circulator_clothing']:
        bpy.data.objects.remove(obj, do_unlink=True)
    clothing, new_frames = [], {}
    for hand in context['circulator_hands']:
        side = hand.name[-1]
        wrist, axis = frames[side]
        old = hand.data
        hand.data = context['circulator_sources'][side].copy()
        cut_skin(hand.data, wrist, axis, cut)
        if old.users == 0:
            bpy.data.meshes.remove(old)
        # Only length matters here; provide the actual centreline direction.
        sleeve_objects = scrub_sleeve(side, wrist, axis, wrist-axis*length, hand,
                                      length_m=length, skin_cut_m=cut)
        clothing.extend(sleeve_objects)
        for obj in sleeve_objects:
            new_frames[obj.name] = (wrist, axis)
    context['circulator_clothing'] = clothing
    context['circulator_frames'] = new_frames
    context['circulator_cut_length_m'] = length
    bpy.context.view_layer.update()
    return True


def choose_forearm_length(gown, context):
    """Keep the longest real cut whose vertices fit the accepted front view; require zero.

    Starts at 10 cm when the elbow-length version is visible, then tries shorter
    closed ends. No vertex is shifted to hide it; visibility is read-only.
    """
    if context.get('circulator_length_finalized'):
        return
    chosen = None
    counts, behind, total = visibility_counts(gown, context, margin=VISIBILITY_MARGIN_M,
                                              stage='elbow-length')
    if not FORCE_SHORT_FOREARM and total and not any(counts.values()):
        chosen = 'elbow-length'
    else:
        for length in FOREARM_LENGTHS_M:
            if not shorten(context, length):
                continue
            counts, behind, total = visibility_counts(gown, context, margin=VISIBILITY_MARGIN_M,
                                                      stage=f'cut-{length*100:g}cm')
            if total and not any(counts.values()):
                chosen = length
                break
    if chosen is None:
        raise RuntimeError('No forearm cut preserves the hands and hides the front view; geometry was not squashed')
    for mesh in context.pop('circulator_sources').values():
        bpy.data.meshes.remove(mesh)
    context['circulator_length_finalized'] = True
    print('CIRCULATOR selected forearm length', chosen, 'm' if isinstance(chosen, float) else '',
          'X deformation', 'none')
