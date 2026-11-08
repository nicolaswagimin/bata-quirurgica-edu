import { describe, expect, it } from 'vitest';
import { boneTargets, buildGown3D, isGown3dEnabled } from '../../src/ar/gown-3d-mesh.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import { bodyFrame, LM } from '../../src/ar/posture.ts';

const SIZE = { width: 1000, height: 1000 };

function pose(over: Partial<Record<keyof typeof LM, [number, number] | null>> = {}): Landmark[] {
  const base: Record<keyof typeof LM, [number, number]> = {
    nose: [0.5, 0.18],
    leftShoulder: [0.6, 0.3],
    rightShoulder: [0.4, 0.3],
    leftElbow: [0.66, 0.45],
    rightElbow: [0.34, 0.45],
    leftWrist: [0.68, 0.58],
    rightWrist: [0.32, 0.58],
    leftHip: [0.58, 0.6],
    rightHip: [0.42, 0.6],
    leftKnee: [0.58, 0.78],
    rightKnee: [0.42, 0.78],
    leftAnkle: [0.58, 0.96],
    rightAnkle: [0.42, 0.96],
  };
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const key of Object.keys(base) as (keyof typeof LM)[]) {
    const p = key in over ? over[key] : base[key];
    out[LM[key]] = p ? { x: p[0], y: p[1], z: 0, visibility: 0.95 } : { x: 0, y: 0, visibility: 0 };
  }
  return out;
}

function frame(over?: Partial<Record<keyof typeof LM, [number, number] | null>>) {
  const body = bodyFrame(pose(over), SIZE);
  if (!body) throw new Error('no frame');
  return body;
}

describe('buildGown3D', () => {
  it('genera cuerpo y dos mangas con pesos normalizados', () => {
    const data = buildGown3D();
    const vertices = data.positions.length / 3;
    expect(vertices).toBe(6 * 12 + 6 * 8);
    expect(data.indices.length).toBe(5 * 12 * 6 + 2 * 2 * 8 * 6);
    expect(data.skinIndices.length).toBe(vertices * 4);
    for (let i = 0; i < vertices; i++) {
      const sum =
        (data.skinWeights[i * 4] ?? 0) +
        (data.skinWeights[i * 4 + 1] ?? 0) +
        (data.skinWeights[i * 4 + 2] ?? 0) +
        (data.skinWeights[i * 4 + 3] ?? 0);
      expect(sum).toBeCloseTo(1, 5);
    }
    for (const index of data.indices) expect(index).toBeLessThan(vertices);
  });

  it('fija el bind del ruedo por debajo de la cadera', () => {
    const data = buildGown3D();
    expect(data.bind.root[1]).toBe(1);
    expect(data.bind.hemCenter[1]).toBeGreaterThan(data.bind.root[1]);
    expect(data.bind.leftShoulder[0]).toBeCloseTo(0.5);
  });
});

describe('boneTargets', () => {
  it('sigue la cadera y el ruedo reales', () => {
    const targets = boneTargets(frame());
    expect(targets.root[1]).toBeGreaterThan(0.5);
    expect(targets.hemCenter[1]).toBeGreaterThan(targets.root[1]);
    expect(targets.leftShoulder).toEqual([0.5, 0, 0]);
  });

  it('aplica el movimiento del ruedo y las mangas', () => {
    const still = boneTargets(frame());
    const moving = boneTargets(frame(), {
      hem: { x: 0.1, y: -0.05 },
      sleeveLeft: { x: 0.1, y: 0 },
      sleeveRight: { x: -0.1, y: 0 },
    });
    expect(moving.hemCenter[0] - still.hemCenter[0]).toBeCloseTo(0.1);
    expect(moving.hemCenter[1] - still.hemCenter[1]).toBeCloseTo(-0.05);
    expect(moving.leftWrist[0] - still.leftWrist[0]).toBeCloseTo(0.1);
    expect(moving.rightWrist[0] - still.rightWrist[0]).toBeCloseTo(-0.1);
  });
});

describe('isGown3dEnabled', () => {
  it('solo se activa con ?bata=3d', () => {
    expect(isGown3dEnabled('?bata=3d')).toBe(true);
    expect(isGown3dEnabled('?bata=vivo')).toBe(false);
    expect(isGown3dEnabled('')).toBe(false);
  });
});
