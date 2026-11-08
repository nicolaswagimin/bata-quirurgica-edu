// Bata 3D procedural: geometría canónica (unidades de ancho de hombros) y esqueleto con huesos de
// ruedo y mangas. El renderer mueve los huesos con el cuerpo y los resortes de gown-motion.ts; la
// malla se deforma con skinning. Puro: sin three ni DOM, probado en node.
import type { GownMotion } from './gown-motion.ts';
import type { BodyFrame, Vec } from './posture.ts';

export const GOWN3D_BONES = [
  'root',
  'spine',
  'leftShoulder',
  'leftElbow',
  'leftWrist',
  'rightShoulder',
  'rightElbow',
  'rightWrist',
  'hemLeft',
  'hemCenter',
  'hemRight',
] as const;
export type Gown3DBone = (typeof GOWN3D_BONES)[number];
export type BonePosition = [number, number, number];

/** `?bata=3d` activa la bata 3D; sin la bandera se usa la malla 2.5D. */
export function isGown3dEnabled(search: string): boolean {
  return new URLSearchParams(search).get('bata') === '3d';
}

const BODY_SEGMENTS = 12;
const SLEEVE_SEGMENTS = 8;
/** Ruedo y cintura de referencia, en anchos de hombros. */
const BODY_RINGS = [
  { v: 0, halfWidth: 0.5, halfDepth: 0.17 },
  { v: 0.3, halfWidth: 0.46, halfDepth: 0.19 },
  { v: 0.65, halfWidth: 0.42, halfDepth: 0.2 },
  { v: 1, halfWidth: 0.45, halfDepth: 0.21 },
  { v: 1.35, halfWidth: 0.49, halfDepth: 0.23 },
  { v: 1.7, halfWidth: 0.53, halfDepth: 0.25 },
] as const;
const SLEEVE_RINGS = [
  { side: 1 as const, x: 0.5, y: 0, radius: 0.17 },
  { side: 1 as const, x: 0.62, y: 0.45, radius: 0.14 },
  { side: 1 as const, x: 0.65, y: 0.7, radius: 0.11 },
  { side: -1 as const, x: -0.5, y: 0, radius: 0.17 },
  { side: -1 as const, x: -0.62, y: 0.45, radius: 0.14 },
  { side: -1 as const, x: -0.65, y: 0.7, radius: 0.11 },
] as const;

const BIND: Record<Gown3DBone, BonePosition> = {
  root: [0, 1, 0],
  spine: [0, 0, 0],
  leftShoulder: [0.5, 0, 0],
  leftElbow: [0.62, 0.45, 0],
  leftWrist: [0.65, 0.7, 0],
  rightShoulder: [-0.5, 0, 0],
  rightElbow: [-0.62, 0.45, 0],
  rightWrist: [-0.65, 0.7, 0],
  hemLeft: [-0.5, 1.7, 0],
  hemCenter: [0, 1.7, 0],
  hemRight: [0.5, 1.7, 0],
};

export type Gown3DData = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  skinIndices: Uint16Array;
  skinWeights: Float32Array;
  /** Posiciones de bind de cada hueso, en el mismo orden que GOWN3D_BONES. */
  bind: Record<Gown3DBone, BonePosition>;
};

const boneIndex = (bone: Gown3DBone): number => GOWN3D_BONES.indexOf(bone);

function bodyWeights(ring: number, x: number): [Gown3DBone, number][] {
  if (ring === 0) return [['spine', 1]];
  if (ring === 1)
    return [
      ['spine', 0.6],
      ['root', 0.4],
    ];
  if (ring === 2 || ring === 3) return [['root', 1]];
  const hem: Gown3DBone = x < -0.2 ? 'hemLeft' : x > 0.2 ? 'hemRight' : 'hemCenter';
  if (ring === 4)
    return [
      ['root', 0.5],
      [hem, 0.5],
    ];
  return [[hem, 1]];
}

function sleeveWeights(ring: number, side: 1 | -1): [Gown3DBone, number][] {
  const shoulder: Gown3DBone = side === 1 ? 'leftShoulder' : 'rightShoulder';
  const elbow: Gown3DBone = side === 1 ? 'leftElbow' : 'rightElbow';
  const wrist: Gown3DBone = side === 1 ? 'leftWrist' : 'rightWrist';
  if (ring === 0) return [[shoulder, 1]];
  if (ring === 1)
    return [
      [shoulder, 0.5],
      [elbow, 0.5],
    ];
  return [
    [elbow, 0.35],
    [wrist, 0.65],
  ];
}

/** Construye la geometría y el esqueleto de bind. Se llama una vez por sesión. */
export function buildGown3D(): Gown3DData {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];

  const pushVertex = (
    position: BonePosition,
    uv: [number, number],
    weights: [Gown3DBone, number][],
  ) => {
    positions.push(...position);
    uvs.push(...uv);
    const slots: [number, number][] = [
      [boneIndex(weights[0]?.[0] ?? 'root'), weights[0]?.[1] ?? 1],
      [boneIndex(weights[1]?.[0] ?? 'root'), weights[1]?.[1] ?? 0],
      [0, 0],
      [0, 0],
    ];
    const total = slots.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    for (const [index, weight] of slots) {
      skinIndices.push(index);
      skinWeights.push(weight / total);
    }
  };

  // Cuerpo: un tubo elíptico de hombros a ruedo.
  const bodyBase = 0;
  for (let r = 0; r < BODY_RINGS.length; r++) {
    const ring = BODY_RINGS[r] as (typeof BODY_RINGS)[number];
    for (let s = 0; s < BODY_SEGMENTS; s++) {
      const angle = (Math.PI * 2 * s) / BODY_SEGMENTS;
      const x = ring.halfWidth * Math.cos(angle);
      pushVertex(
        [x, ring.v, ring.halfDepth * Math.sin(angle)],
        [s / BODY_SEGMENTS, ring.v / 1.7],
        bodyWeights(r, x),
      );
    }
  }
  for (let r = 0; r < BODY_RINGS.length - 1; r++) {
    for (let s = 0; s < BODY_SEGMENTS; s++) {
      const a = bodyBase + r * BODY_SEGMENTS + s;
      const b = bodyBase + r * BODY_SEGMENTS + ((s + 1) % BODY_SEGMENTS);
      const c = bodyBase + (r + 1) * BODY_SEGMENTS + s;
      const d = bodyBase + (r + 1) * BODY_SEGMENTS + ((s + 1) % BODY_SEGMENTS);
      indices.push(a, c, b, b, c, d);
    }
  }

  // Mangas: dos tubos de hombro a muñeca, con el puño en el último anillo.
  const sleeveBase = positions.length / 3;
  SLEEVE_RINGS.forEach((ring, r) => {
    const localRing = r % 3;
    for (let s = 0; s < SLEEVE_SEGMENTS; s++) {
      const angle = (Math.PI * 2 * s) / SLEEVE_SEGMENTS;
      pushVertex(
        [ring.x + ring.radius * Math.cos(angle), ring.y, ring.radius * Math.sin(angle)],
        [s / SLEEVE_SEGMENTS, localRing / 2],
        sleeveWeights(localRing, ring.side),
      );
    }
  });
  for (let group = 0; group < 2; group++) {
    for (let r = 0; r < 2; r++) {
      for (let s = 0; s < SLEEVE_SEGMENTS; s++) {
        const base = sleeveBase + group * 3 * SLEEVE_SEGMENTS;
        const a = base + r * SLEEVE_SEGMENTS + s;
        const b = base + r * SLEEVE_SEGMENTS + ((s + 1) % SLEEVE_SEGMENTS);
        const c = base + (r + 1) * SLEEVE_SEGMENTS + s;
        const d = base + (r + 1) * SLEEVE_SEGMENTS + ((s + 1) % SLEEVE_SEGMENTS);
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    skinIndices: new Uint16Array(skinIndices),
    skinWeights: new Float32Array(skinWeights),
    bind: BIND,
  };
}

/** Posiciones actuales de los huesos, en el mismo espacio canónico del bind. */
export function boneTargets(
  frame: BodyFrame,
  motion?: GownMotion | null,
): Record<Gown3DBone, BonePosition> {
  const scale = Math.max(1, frame.shoulderWidth);
  const project = (point: Vec) => {
    const dx = point.x - frame.shoulderMid.x;
    const dy = point.y - frame.shoulderMid.y;
    return {
      u: (dx * frame.across.x + dy * frame.across.y) / scale,
      v: (dx * frame.down.x + dy * frame.down.y) / scale,
    };
  };
  const arm = (side: 1 | -1, limb: BodyFrame['left']) => {
    const elbow = limb.elbow ? project(limb.elbow) : { u: side * 0.62, v: 0.45 };
    const wrist = limb.wrist ? project(limb.wrist) : { u: side * 0.65, v: 0.7 };
    return { elbow, wrist };
  };
  const left = arm(1, frame.left);
  const right = arm(-1, frame.right);
  const hipV = Math.max(0.5, frame.torsoHeight / scale);
  const knee = frame.knees.left ?? frame.knees.right;
  const ankle = frame.ankles.left ?? frame.ankles.right;
  const hem =
    knee && ankle ? project({ x: (knee.x + ankle.x) / 2, y: (knee.y + ankle.y) / 2 }) : null;
  const hemV = Math.max(hipV + 0.5, hem?.v ?? hipV + 0.8);
  const sway = motion?.hem ?? { x: 0, y: 0 };
  const leftSleeve = motion?.sleeveLeft ?? { x: 0, y: 0 };
  const rightSleeve = motion?.sleeveRight ?? { x: 0, y: 0 };

  return {
    root: [0, hipV, 0],
    spine: [0, 0, 0],
    leftShoulder: [0.5, 0, 0],
    leftElbow: [left.elbow.u + leftSleeve.x * 0.5, left.elbow.v + leftSleeve.y * 0.5, 0],
    leftWrist: [left.wrist.u + leftSleeve.x, left.wrist.v + leftSleeve.y, 0],
    rightShoulder: [-0.5, 0, 0],
    rightElbow: [right.elbow.u + rightSleeve.x * 0.5, right.elbow.v + rightSleeve.y * 0.5, 0],
    rightWrist: [right.wrist.u + rightSleeve.x, right.wrist.v + rightSleeve.y, 0],
    hemLeft: [-0.5 + sway.x, hemV + sway.y, 0],
    hemCenter: [0 + sway.x, hemV + sway.y, 0],
    hemRight: [0.5 + sway.x, hemV + sway.y, 0],
  };
}
