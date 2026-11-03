// Test-only pose (e2e builds with `?simularPose=1`): a person standing ~2 m away with the hands in
// front of the chest, breathing slightly. Lets e2e runs and screenshots exercise the game without a
// person in front of the fake camera. Never used in production builds.
import type { Landmark } from './overlay-math.ts';

/** Normalized [x, y] of the standing pose in the camera frame (not mirrored). */
export const SYNTHETIC_POSE: Record<number, [number, number]> = {
  0: [0.5, 0.17],
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

/** `bajo`: the right wrist drops below the waist (to exercise the warning). */
export function syntheticPose(nowMs: number, variant = '1'): Landmark[] {
  const breathe = Math.sin(nowMs / 900) * 0.002;
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const [i, [x, y]] of Object.entries(SYNTHETIC_POSE)) {
    out[Number(i)] = { x, y: y + (Number(i) < 23 ? breathe : 0), z: -0.1, visibility: 0.95 };
  }
  if (variant === 'bajo') {
    out[16] = { x: 0.43, y: 0.6, z: -0.1, visibility: 0.95 };
    out[20] = { x: 0.43, y: 0.62, z: -0.1, visibility: 0.95 };
  }
  return out;
}
