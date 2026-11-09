"""Procedurally draped towel and suspended gown; world metres, Z up, -Y front."""
import math
import bpy
from mathutils import Vector
from gown import FABRIC_V2, TRIM, fabric_material, loft, ribbon, bone_head
from cuffs_v2 import build_cuffs
from cloth_shape_v2 import held_fold, towel_section, shoulder_radius


def surface(name, rows, material, thickness=.001):
    """Quad cloth grid with soft normals and physical double-sided thickness."""
    width = len(rows[0])
    verts = [tuple(v) for row in rows for v in row]
    faces = [(i*width+j, i*width+j+1, (i+1)*width+j+1, (i+1)*width+j)
             for i in range(len(rows)-1) for j in range(width-1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    for p in mesh.polygons:
        p.use_smooth = True
    solid = obj.modifiers.new('cloth thickness', 'SOLIDIFY')
    solid.thickness = thickness
    return obj


def towel(rig):
    """Drape across right palm and around the midpoint of the left forearm."""
    wrist = bone_head(rig, 'wrist.L')
    elbow = bone_head(rig, 'lowerarm01.L')
    center = (wrist+elbow)/2
    axis = (wrist-elbow).normalized()
    palm = (bone_head(rig, 'wrist.R')+bone_head(rig, 'finger3-1.R'))/2
    across = palm-center
    across = (across-axis*across.dot(axis)).normalized()
    up = axis.cross(across).normalized()
    if up.z < 0:
        up = -up
    rows = []
    for i in range(49):
        t = i/48
        x, z, tail = towel_section(t, .046)
        row = []
        for j in range(25):
            u = j/24*2-1
            point = center+axis*(u*.12)+across*x+up*(z+tail)+Vector((0,0,-tail))
            # Support the near flap on the right palm, then let its edge fall.
            support = math.exp(-((t-.18)/.12)**2-(u/.48)**2)*min(1,max(0,(.25-t)/.07))**2
            ax, az, fall = towel_section(.18,.046)
            anchor = center+across*ax+up*(az+fall)+Vector((0,0,-fall))
            point += (palm+Vector((0,0,.012))-anchor)*support
            weight = min(1, tail/.10)
            point += across*(held_fold(u, t)*weight)
            point += Vector((0,0,-.022*(1-u*u)*weight))
            row.append(point)
        rows.append(row)
    material = fabric_material('v2-towel-off-white', (.82,.81,.76,1), .98, weave=1400)
    for node in material.node_tree.nodes:
        if node.type == 'BUMP':
            node.inputs['Distance'].default_value = .00035
    obj = surface('v2-sterile-towel', rows, material, thickness=.0014)
    print('TOWEL forearm midpoint', tuple(center), 'wrap degrees', 210,
          'right palm support', tuple(palm), 'unequal gravity tails')
    return [obj]


def suspended_gown(rig, folded):
    """Vertical gravity drape, inner +Y toward wearer; no body-worn garment."""
    blue = fabric_material('v2-held-fabric', FABRIC_V2, .9)
    trim = fabric_material('v2-held-binding', TRIM, .94)
    wrists = [bone_head(rig, f'wrist.{s}') for s in 'LR']
    grips = [bone_head(rig, f'finger2-2.{s}') for s in 'LR']
    top = sum(grips, Vector())/2+Vector((0,-.010,.065))
    length, half = (.68,.15) if folded else (1.00,.32)
    rows = []
    for i in range(35):
        t = i/34
        row = []
        for j in range(33):
            u = j/32*2-1
            # Vertically coherent folds: no shaking, hem remains level.
            x = half*u*(.80+.20*t)
            y = -.015+held_fold(u,t)
            z = -length*t+(.013*u-.009*math.cos(u*2.2))*t*t
            if i == 0 and not folded:
                z -= .055*math.exp(-(u/.25)**2)
            row.append(top+Vector((x,y,z)))
        rows.append(row)
    objects = [surface('v2-gown-folded' if folded else 'v2-gown-unfolded', rows, blue)]
    ribbon('v2-held-neck-binding', [tuple(p) for p in rows[0]], trim, width=.004, thickness=.001)
    cuffs = []
    if folded:
        back = [[p+Vector((0,.012,0)) for p in row] for row in rows]
        objects.append(surface('v2-gown-book-inner-fold', back, blue))
        # Rounded return connects both layers, rather than a cardboard edge.
        for edge in (0, -1):
            turn = []
            for row in rows:
                turn.append([row[edge]+Vector((.006*math.sin(a), .006*(1-math.cos(a)), 0))
                             for a in (math.pi*k/8 for k in range(9))])
            objects.append(surface(f'v2-folded-soft-return-{edge}', turn, blue))
        ribbon('v2-folded-hem-return', [tuple(p+Vector((0,.006,.01))) for p in rows[-1]], trim,
               width=.003, thickness=.001)
    else:
        profiles = {}
        for side, sign in (('L',1),('R',-1)):
            grip = grips[0 if side == 'L' else 1]
            shoulder = grip+Vector((0, 0, .055))
            end = shoulder+Vector((sign*.11, -.005, -.49))
            axis = (end-shoulder).normalized()
            across = Vector((0,1,0))
            normal = axis.cross(across).normalized()
            rings = []
            for i in range(25):
                t = i/24
                center = shoulder.lerp(end,t)
                rings.append([center+(across*math.cos(a)+normal*math.sin(a))*shoulder_radius(t,a)
                              for a in (2*math.pi*j/48 for j in range(48))])
            sleeve = loft(f'v2-hanging-sleeve-{side}', rings, cap=False)
            sleeve.data.materials.append(blue)
            sleeve.data.polygons.foreach_set('use_smooth',[True]*len(sleeve.data.polygons))
            objects.append(sleeve)
            # Rounded cloth shoulder shares the sleeve's root circle. The hand
            # enters from the wearer side; fingers remain inside the soft hood.
            hood_rings = []
            for k in range(13):
                a = math.pi/2*k/12
                center = shoulder-axis*(.052*math.cos(a))
                hood_rings.append([center+(across*math.cos(t)+normal*math.sin(t))*
                                   max(.0005,.068*math.sin(a))
                                   for t in (2*math.pi*j/48 for j in range(48))])
            hood = loft(f'v2-draped-shoulder-{side}',hood_rings,cap=True)
            hood.data.materials.append(blue)
            hood.data.polygons.foreach_set('use_smooth',[True]*len(hood.data.polygons))
            objects.append(hood)
            profiles[side] = dict(wrist=end, axis=axis, across=across, normal=normal,
                start=-.01,end=.06,offset=(0,0),mid=(.040,.031))
        cuffs = build_cuffs(profiles, axial_segments=6)
    lowest = min(v.co.z for o in objects for v in o.data.vertices)
    print('HELD gown', 'folded' if folded else 'unfolded', 'hem z m', round(lowest,3),
          'inner face +Y; floor clearance m', round(lowest,3))
    assert lowest > .08, 'Suspended gown touches floor'
    return objects, cuffs
