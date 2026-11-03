// Test-only poses (e2e builds with `?simularPose=…`): a person standing ~2 m away. The variant can
// change live through `window.__arSimPose` so e2e runs and screenshots can walk the game without a
// person in front of the fake camera. Never used in production builds.
import { hangingFrame, sleeveOpenings } from './hanging-gown.ts';
import type { Landmark } from './overlay-math.ts';
import { bodyFrame } from './posture.ts';

/** Normalized [x, y] of the standing pose in the camera frame (not mirrored). */
export const SYNTHETIC_POSE: Record<number, [number, number]> = {
  0: [0.5, 0.17],
  2: [0.512, 0.155],
  5: [0.488, 0.155],
  7: [0.527, 0.165],
  8: [0.473, 0.165],
  9: [0.508, 0.195],
  10: [0.492, 0.195],
  11: [0.565, 0.29],
  12: [0.435, 0.29],
  13: [0.6, 0.41],
  14: [0.4, 0.41],
  15: [0.535, 0.43],
  16: [0.465, 0.43],
  19: [0.528, 0.45],
  20: [0.472, 0.45],
  23: [0.547, 0.55],
  24: [0.453, 0.55],
  25: [0.55, 0.71],
  26: [0.45, 0.71],
  27: [0.552, 0.87],
  28: [0.448, 0.87],
};

type Over = Record<number, [number, number, number?]>;

function sleevesVariant(): Over {
  const base = build({});
  const body = bodyFrame(base, { width: 640, height: 480 });
  if (!body) return {};
  const [l, r] = sleeveOpenings(hangingFrame(body));
  return { 15: [l.x / 640, l.y / 480, -0.3], 16: [r.x / 640, r.y / 480, -0.3] };
}

const VARIANTS: Record<string, () => Over> = {
  '1': () => ({}),
  bajo: () => ({ 16: [0.43, 0.6], 20: [0.43, 0.62] }),
  cara: () => ({
    15: [0.515, 0.19, -0.2],
    16: [0.485, 0.19, -0.2],
    19: [0.51, 0.18],
    20: [0.49, 0.18],
  }),
  mangas: sleevesVariant,
  adelante: () => ({
    13: [0.585, 0.33, -0.3],
    14: [0.415, 0.33, -0.3],
    15: [0.56, 0.3, -0.6],
    16: [0.44, 0.3, -0.6],
  }),
};

function build(over: Over, breathe = 0): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const [i, [x, y]] of Object.entries(SYNTHETIC_POSE)) {
    out[Number(i)] = { x, y: y + (Number(i) < 23 ? breathe : 0), z: -0.1, visibility: 0.95 };
  }
  for (const [i, [x, y, z]] of Object.entries(over)) {
    out[Number(i)] = { x, y, z: z ?? -0.1, visibility: 0.95 };
  }
  return out;
}

export function syntheticPose(nowMs: number, variant = '1'): Landmark[] {
  const w = window as { __arSimPose?: string; __arSimLandmarks?: Landmark[] };
  const live = w.__arSimPose ?? variant;
  const pose = build(
    (VARIANTS[live] ?? VARIANTS['1'] ?? (() => ({})))(),
    Math.sin(nowMs / 900) * 0.002,
  );
  w.__arSimLandmarks = pose; // lets a test's fake camera draw the same person
  return pose;
}
