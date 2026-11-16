// Deformable gown for the AR mirror, built from the body frame of posture.ts. Pure geometry in canvas
// pixels: the torso is a grid whose edges follow shoulders → waist → hips → mid-calf, sleeves are
// strips along shoulder → elbow → wrist, and cuffs, ties and neckline are trim pieces. The renderer
// (gown-render.ts) maps the fabric texture onto every cell, so the cloth bends with the body.
import type { GownMotion } from './gown-motion.ts';
import type { BodyFrame, Vec } from './posture.ts';

export interface Quad {
  /** Corners in order: top-left, top-right, bottom-right, bottom-left. */
  p: [Vec, Vec, Vec, Vec];
  /** Texture coordinates of the same corners, in fabric pixels. */
  uv: [Vec, Vec, Vec, Vec];
  /** 0 at the centre line, 1 at the side seams: drives the volume shading. */
  edge: number;
}

export interface GownMesh {
  body: Quad[];
  sleeves: Quad[];
  cuffs: Quad[];
  ties: Vec[][];
  neckline: Vec[];
  hotspots: {
    id: 'cuello' | 'punos' | 'zona-esteril' | 'mangas' | 'cierre-posterior';
    x: number;
    y: number;
  }[];
}

const COLUMNS = 6;
/** Fabric pixels per shoulder width: the weave keeps its scale as the person moves closer. */
const TEXELS_PER_SHOULDER = 256;

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });

/** Mid-calf hem for one side: halfway knee → ankle, or extrapolated when the legs are cut off. */
function hemPoint(frame: BodyFrame, hip: Vec, knee: Vec | null, ankle: Vec | null): Vec {
  if (knee && ankle) return lerp(knee, ankle, 0.5);
  if (knee) return add(knee, scale({ x: knee.x - hip.x, y: knee.y - hip.y }, 0.5));
  return add(hip, scale(frame.down, frame.torsoHeight * 1.55));
}

export function gownMesh(frame: BodyFrame, motion?: GownMotion): GownMesh {
  const { across, down, shoulderWidth: sw, torsoHeight: th } = frame;
  const texel = TEXELS_PER_SHOULDER / sw;
  const L = frame.left.shoulder;
  const R = frame.right.shoulder;
  const hipHalf = scale(across, sw * 0.42);
  const hipL = add(frame.hipMid, hipHalf);
  const hipR = add(frame.hipMid, scale(hipHalf, -1));

  // Side seams: rows from the shoulder line to the hem. The cloth stands off the body a little.
  const ease = (t: number) => sw * (0.06 + 0.04 * t);
  const sideL = [
    add(L, scale(across, sw * 0.08)),
    add(lerp(L, hipL, 0.45), scale(across, ease(0.4))),
    add(lerp(L, hipL, 0.75), scale(across, ease(0.6))),
    add(hipL, scale(across, ease(0.9))),
  ];
  const sideR = [
    add(R, scale(across, -sw * 0.08)),
    add(lerp(R, hipR, 0.45), scale(across, -ease(0.4))),
    add(lerp(R, hipR, 0.75), scale(across, -ease(0.6))),
    add(hipR, scale(across, -ease(0.9))),
  ];
  const hemL = add(
    hemPoint(frame, hipL, frame.knees.left, frame.ankles.left),
    scale(across, sw * 0.2),
  );
  const hemR = add(
    hemPoint(frame, hipR, frame.knees.right, frame.ankles.right),
    scale(across, -sw * 0.2),
  );
  // Two extra rows between the hips and the hem so the skirt swings with each leg.
  sideL.push(lerp(sideL[3] as Vec, hemL, 0.5), hemL);
  sideR.push(lerp(sideR[3] as Vec, hemR, 0.5), hemR);

  const body: Quad[] = [];
  let vTop = 0;
  for (let r = 0; r < sideL.length - 1; r++) {
    const tl = sideR[r] as Vec;
    const tr = sideL[r] as Vec;
    const bl = sideR[r + 1] as Vec;
    const br = sideL[r + 1] as Vec;
    const rowHeight =
      (len({ x: bl.x - tl.x, y: bl.y - tl.y }) + len({ x: br.x - tr.x, y: br.y - tr.y })) / 2;
    const vBottom = vTop + rowHeight * texel;
    for (let c = 0; c < COLUMNS; c++) {
      const a = c / COLUMNS;
      const b = (c + 1) / COLUMNS;
      const uA = a * TEXELS_PER_SHOULDER * 1.3;
      const uB = b * TEXELS_PER_SHOULDER * 1.3;
      body.push({
        p: [lerp(tl, tr, a), lerp(tl, tr, b), lerp(bl, br, b), lerp(bl, br, a)],
        uv: [
          { x: uA, y: vTop },
          { x: uB, y: vTop },
          { x: uB, y: vBottom },
          { x: uA, y: vBottom },
        ],
        edge: Math.abs((a + b) / 2 - 0.5) * 2,
      });
    }
    vTop = vBottom;
  }

  const sleeves: Quad[] = [];
  const cuffs: Quad[] = [];
  const cuffCenters: Vec[] = [];
  const mangaCenters: Vec[] = [];
  for (const [limb, side] of [
    [frame.left, 1],
    [frame.right, -1],
  ] as const) {
    const shoulder = add(limb.shoulder, scale(across, side * sw * 0.04));
    // Without a visible arm the sleeve hangs along the side of the body.
    const elbow =
      limb.elbow ?? add(shoulder, add(scale(down, th * 0.45), scale(across, side * sw * 0.12)));
    const wrist =
      limb.wrist ?? add(elbow, add(scale(down, th * 0.42), scale(across, side * sw * 0.04)));
    const chain = [shoulder, elbow, wrist];
    const widths = [sw * 0.34, sw * 0.27, sw * 0.22];
    let v = 0;
    // Joint normals: the elbow uses the mitre of both segments so the sleeve bends without a gap.
    const segNormal = (from: Vec, to: Vec) => perp(norm({ x: to.x - from.x, y: to.y - from.y }));
    const n0 = segNormal(shoulder, elbow);
    const n2 = segNormal(elbow, wrist);
    const n1 = norm(add(n0, n2));
    const joints = [n0, n1, n2];
    for (let i = 0; i < 2; i++) {
      const a = chain[i] as Vec;
      const b = chain[i + 1] as Vec;
      const n = n2;
      const na = joints[i] as Vec;
      const nb = i === 0 ? n1 : n2;
      // Stop the loose sleeve short of the wrist: the knit cuff covers the last stretch.
      const end = i === 1 ? lerp(a, b, 0.86) : b;
      const wa = (widths[i] as number) / 2;
      const wb = (widths[i + 1] as number) / 2;
      const segLen = len({ x: end.x - a.x, y: end.y - a.y });
      const v2 = v + segLen * texel;
      sleeves.push({
        p: [
          add(a, scale(na, -wa)),
          add(a, scale(na, wa)),
          add(end, scale(nb, wb)),
          add(end, scale(nb, -wb)),
        ],
        uv: [
          { x: 0, y: v },
          { x: 90, y: v },
          { x: 90, y: v2 },
          { x: 0, y: v2 },
        ],
        edge: 0.5,
      });
      v = v2;
      if (i === 0) mangaCenters.push(lerp(a, b, 0.55));
      if (i === 1) {
        const cuffW = (widths[2] as number) * 0.42;
        cuffs.push({
          p: [
            add(end, scale(n, -cuffW)),
            add(end, scale(n, cuffW)),
            add(b, scale(n, cuffW * 0.9)),
            add(b, scale(n, -cuffW * 0.9)),
          ],
          uv: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 24 },
            { x: 0, y: 24 },
          ],
          edge: 0.3,
        });
        cuffCenters.push(lerp(end, b, 0.5));
      }
    }
  }

  // Waist ties on the wearer's left side seam, hanging from a small knot.
  const waistL = sideL[2] as Vec;
  const knot = add(waistL, scale(across, -sw * 0.05));
  const ties = [
    [knot, add(knot, add(scale(down, th * 0.32), scale(across, sw * 0.08)))],
    [knot, add(knot, add(scale(down, th * 0.28), scale(across, -sw * 0.04)))],
    [knot, add(knot, scale(across, -sw * 0.35))],
  ];

  // Round neckline just below the base of the neck.
  const neckC = add(frame.shoulderMid, scale(down, th * 0.02));
  const neckline: Vec[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = Math.PI * (i / 8);
    neckline.push(
      add(neckC, add(scale(across, Math.cos(t) * sw * 0.2), scale(down, Math.sin(t) * th * 0.09))),
    );
  }

  const at = (p: Vec) => ({ x: p.x, y: p.y });
  const mesh: GownMesh = {
    body,
    sleeves,
    cuffs,
    ties,
    neckline,
    hotspots: [
      { id: 'cuello', ...at(add(neckC, scale(down, -th * 0.02))) },
      { id: 'zona-esteril', ...at(add(frame.shoulderMid, scale(down, th * 0.4))) },
      { id: 'mangas', ...at(mangaCenters[0] ?? L) },
      { id: 'punos', ...at(cuffCenters[0] ?? L) },
      { id: 'cierre-posterior', ...at(add(sideL[3] as Vec, scale(across, -sw * 0.04))) },
    ],
  };
  return motion ? withSecondaryMotion(mesh, frame, motion) : mesh;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Offsets the skirt and sleeves by the spring motion. The falloff starts at the hips so the torso
 * stays put, and the lower sleeve/cuff take the full lag while the shoulder end stays anchored.
 */
function withSecondaryMotion(mesh: GownMesh, frame: BodyFrame, motion: GownMotion): GownMesh {
  const scale = frame.shoulderWidth;
  const top = frame.hipMid.y;
  const bottom = mesh.body.reduce((max, quad) => Math.max(max, ...quad.p.map((p) => p.y)), top);
  const span = Math.max(1, bottom - top);
  const falloff = (p: Vec) => clamp01((p.y - top) / span);
  const move = (
    quads: Quad[],
    offset: Vec,
    factor: (quad: Quad, index: number) => number,
    withFalloff: boolean,
  ) =>
    quads.map((quad, index) => ({
      ...quad,
      p: quad.p.map((p) => {
        const k = factor(quad, index) * (withFalloff ? falloff(p) : 1);
        return { x: p.x + offset.x * scale * k, y: p.y + offset.y * scale * k };
      }) as Quad['p'],
    }));

  const sleeveFactors = (_q: Quad, i: number) => (i === 0 ? 0.35 : 1);
  const leftSleeves = move(mesh.sleeves.slice(0, 2), motion.sleeveLeft, sleeveFactors, false);
  const rightSleeves = move(mesh.sleeves.slice(2), motion.sleeveRight, sleeveFactors, false);
  const cuffs = mesh.cuffs.map((quad, index) =>
    move([quad], index === 0 ? motion.sleeveLeft : motion.sleeveRight, () => 1, false),
  );

  return {
    ...mesh,
    body: move(mesh.body, motion.hem, () => 1, true),
    sleeves: [...leftSleeves, ...rightSleeves],
    cuffs: cuffs.flat(),
  };
}
