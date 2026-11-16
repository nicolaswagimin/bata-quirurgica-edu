# AR gown rig contract

Run from the repository root (isolated MPFB profile):

```bash
# env.sh needs bash (it uses BASH_SOURCE); from zsh it does not load the MPFB profile.
cd tools/bata-3d && bash -c 'source ./env.sh && blender --background --python export_ar_gown.py' > .work/ar_rig.log 2>&1
```

Generic closed wrapped gown, cuffs, bindings and bows only. Rest pose is baked from `pose_relaxed`: upper arms rotated 21° down from the MPFB default, elbows softened by 14°. This is the neutral bind pose; drive rotations relative to it. Units are metres, glTF Y-up, facing +Z (Blender faces -Y). No animations or morphs. Materials and UVs are preserved; procedural weave is not baked into textures. Draco decoding is required.

Bones and parents:

| Bone | Parent |
|---|---|
| root | — |
| spine | root |
| chest | spine |
| neck | chest |
| shoulder.L | chest |
| upperarm.L | shoulder.L |
| forearm.L | upperarm.L |
| hand.L | forearm.L |
| sleeve.L | forearm.L |
| shoulder.R | chest |
| upperarm.R | shoulder.R |
| forearm.R | upperarm.R |
| hand.R | forearm.R |
| sleeve.R | forearm.R |
| hem.F.1 | root |
| hem.F.2 | hem.F.1 |
| hem.B.1 | root |
| hem.B.2 | hem.B.1 |
| hem.L.1 | root |
| hem.L.2 | hem.L.1 |
| hem.R.1 | root |
| hem.R.2 | hem.R.1 |
| tie.L | root |
| tie.R | root |

Hem chains start at the waist, midpoint at half skirt height, and end at the hem. L/R are wearer sides. Sleeve bones share the distal 35% of the forearm region; front bow tails reach 100% tie weight after 6.5 cm. Top four influences are normalized. Shoulder width (upperarm heads): 0.328486 m.

Verified by reimporting the exported GLB; coordinates below are world glTF coordinates.

```json
{
  "bones": [
    "root",
    "spine",
    "chest",
    "neck",
    "shoulder.L",
    "upperarm.L",
    "forearm.L",
    "hand.L",
    "sleeve.L",
    "shoulder.R",
    "upperarm.R",
    "forearm.R",
    "hand.R",
    "sleeve.R",
    "hem.F.1",
    "hem.F.2",
    "hem.B.1",
    "hem.B.2",
    "hem.L.1",
    "hem.L.2",
    "hem.R.1",
    "hem.R.2",
    "tie.L",
    "tie.R"
  ],
  "triangles": 24500,
  "bytes": 150120,
  "max_influences": 4,
  "shoulder_width_m": 0.328486,
  "world_gltf_m": {
    "root": [
      0.0,
      0.87134,
      0.014629
    ],
    "shoulder.L": [
      0.023576,
      1.35541,
      0.027172
    ],
    "shoulder.R": [
      -0.023576,
      1.35541,
      0.027172
    ],
    "hand.L": [
      0.319256,
      0.918738,
      0.137556
    ],
    "hand.R": [
      -0.319256,
      0.918738,
      0.137556
    ],
    "hem.F.end": [
      0.0,
      0.271657,
      0.280628
    ],
    "hem.B.end": [
      0.0,
      0.271657,
      -0.251371
    ],
    "hem.L.end": [
      0.28,
      0.271657,
      0.014629
    ],
    "hem.R.end": [
      -0.28,
      0.271657,
      0.014629
    ]
  }
}
```
