// Single source for the procedural mannequin's body, in metres (feet at y ≈ 0, ~1.78 m tall).
// mannequin.tsx renders it with R3F and bata-model.ts rebuilds it with plain three.js for the GLB.

export type Vec3 = [number, number, number];

export type BodyPart =
  | { kind: 'sphere'; position: Vec3; radius: number }
  | { kind: 'capsule'; position: Vec3; rotationZ: number; radius: number; length: number };

export const HEAD: BodyPart = { kind: 'sphere', position: [0, 1.66, 0], radius: 0.12 };
export const TORSO: BodyPart = {
  kind: 'capsule',
  position: [0, 1.15, 0],
  rotationZ: 0,
  radius: 0.17,
  length: 0.5,
};

export const ARM_RADIUS = 0.05;
export const ARM_LENGTH = 0.55;
export const ARM_TILT = 0.12;

/** side = -1 (right of the figure, viewer's left) or 1. */
export function armPart(side: -1 | 1): BodyPart {
  return {
    kind: 'capsule',
    position: [side * 0.3, 1.12, 0],
    rotationZ: side * ARM_TILT,
    radius: ARM_RADIUS,
    length: ARM_LENGTH,
  };
}

export function legPart(side: -1 | 1): BodyPart {
  return {
    kind: 'capsule',
    position: [side * 0.1, 0.45, 0],
    rotationZ: 0,
    radius: 0.07,
    length: 0.75,
  };
}

export const SIDES = [-1, 1] as const;

export const MANNEQUIN_PARTS: BodyPart[] = [
  HEAD,
  TORSO,
  ...SIDES.flatMap((side) => [armPart(side), legPart(side)]),
];
