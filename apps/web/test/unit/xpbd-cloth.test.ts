// biome-ignore-all lint/style/noNonNullAssertion: Validated mesh dimensions and bounded numeric loops guarantee indices.
import { describe, expect, it } from 'vitest';
import {
  type Capsule,
  clothFromMesh,
  createClothGrid,
  measureBudget,
  XpbdCloth,
} from '../../src/ar/xpbd-cloth.ts';

const options = { compliance: 1e-9, bendCompliance: 1e-6, damping: 4, gravity: 9.81 };
const grid = (rows = 12, cols = 10) =>
  createClothGrid({
    rows,
    cols,
    width: 0.6,
    height: 0.8,
    origin: { x: 0, y: 0, z: 1 },
  });
const distance = (p: Float32Array, a: number, b: number) =>
  Math.hypot(p[a * 3]! - p[b * 3]!, p[a * 3 + 1]! - p[b * 3 + 1]!, p[a * 3 + 2]! - p[b * 3 + 2]!);

describe('small-step XPBD cloth', () => {
  it('hangs for ten seconds with finite positions, bounded energy and stiff edges', () => {
    const mesh = grid();
    const cloth = new XpbdCloth(mesh, options);
    const previous = cloth.positions.slice();
    let earlyMotion = 0,
      lateMotion = 0,
      maxStrain = 0;
    for (let frame = 0; frame < 300; frame++) {
      previous.set(cloth.positions);
      cloth.step(1 / 30, []);
      let motion = 0;
      for (let k = 0; k < previous.length; k++) {
        const value = cloth.positions[k]!;
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThan(3);
        motion += (value - previous[k]!) ** 2 * 900;
      }
      if (frame < 60) earlyMotion += motion;
      if (frame >= 240) lateMotion += motion;
      for (let t = 0; t < mesh.indices.length; t += 3) {
        for (let j = 0; j < 3; j++) {
          const a = mesh.indices[t + j]!,
            b = mesh.indices[t + ((j + 1) % 3)]!;
          maxStrain = Math.max(
            maxStrain,
            Math.abs(distance(cloth.positions, a, b) / distance(mesh.positions, a, b) - 1),
          );
        }
      }
    }
    expect(lateMotion).toBeLessThan(earlyMotion * 0.1);
    expect(maxStrain).toBeLessThan(0.03);
    expect(cloth.positions.at(-2)).toBeGreaterThan(mesh.positions.at(-2)!);
  });

  it('projects movable vertices out of capsules, including the axis and spherical case', () => {
    for (const capsule of [
      { a: { x: 0, y: 0.2, z: 1 }, b: { x: 0, y: 0.6, z: 1 }, radius: 0.2 },
      { a: { x: 0, y: 0.4, z: 1 }, b: { x: 0, y: 0.4, z: 1 }, radius: 0.2 },
    ] satisfies Capsule[]) {
      const mesh = grid(11, 11);
      const cloth = new XpbdCloth(mesh, options);
      for (let f = 0; f < 30; f++) {
        cloth.step(1 / 30, [capsule]);
        for (let i = 0; i < mesh.pinned.length; i++) {
          const p = cloth.positions;
          const y = Math.max(capsule.a.y, Math.min(capsule.b.y, p[i * 3 + 1]!));
          expect(
            Math.hypot(p[i * 3]!, p[i * 3 + 1]! - y, p[i * 3 + 2]! - 1),
          ).toBeGreaterThanOrEqual(capsule.radius - 1e-6);
        }
      }
    }
  });

  it('follows animated pins exactly and resets momentum after a teleport', () => {
    const mesh = grid();
    const cloth = new XpbdCloth(mesh, options);
    const targets = mesh.positions.slice();
    for (let k = 0; k < targets.length; k += 3) targets[k] = targets[k]! + 0.1;
    cloth.setPinned(targets);
    cloth.step(1 / 30, []);
    for (let i = 0; i < mesh.pinned.length; i++) {
      if (mesh.pinned[i])
        expect(cloth.positions.slice(i * 3, i * 3 + 3)).toEqual(targets.slice(i * 3, i * 3 + 3));
    }
    const before = cloth.positions.slice();
    for (let k = 0; k < targets.length; k += 3) targets[k] = targets[k]! + 2;
    cloth.setPinned(targets);
    expect(cloth.positions.at(-3)).toBeCloseTo(before.at(-3)! + 2, 5);
    const stopped = new XpbdCloth(mesh, options);
    stopped.reset(cloth.positions);
    cloth.step(1 / 30, []);
    stopped.step(1 / 30, []);
    expect(cloth.positions).toEqual(stopped.positions);
    cloth.reset();
    expect(cloth.positions).toEqual(mesh.positions);
    const fresh = new XpbdCloth(mesh, options);
    cloth.step(1 / 30, []);
    fresh.step(1 / 30, []);
    expect(cloth.positions).toEqual(fresh.positions);
    cloth.reset(targets);
    expect(cloth.positions).toEqual(targets);
  });

  it('copies arbitrary mesh buffers and clamps elapsed time', () => {
    const mesh = grid(2, 2);
    const copy = clothFromMesh(mesh.positions, mesh.indices, mesh.pinned);
    expect(copy.positions).not.toBe(mesh.positions);
    expect(copy.indices).not.toBe(mesh.indices);
    expect(copy.pinned).not.toBe(mesh.pinned);
    const a = new XpbdCloth(copy, options),
      b = new XpbdCloth(copy, options);
    a.step(10, []);
    b.step(1 / 30, []);
    expect(a.positions).toEqual(b.positions);
    const before = a.positions.slice();
    a.step(Number.NaN, []);
    a.step(-1, []);
    expect(a.positions).toEqual(before);
    expect(() =>
      createClothGrid({ rows: 1, cols: 2, width: 1, height: 1, origin: { x: 0, y: 0, z: 0 } }),
    ).toThrow(RangeError);
    expect(() =>
      clothFromMesh(new Float32Array(3), new Uint32Array([0, 1, 2]), new Uint8Array(1)),
    ).toThrow(RangeError);
  });

  it('fits the optional simulation budget with 600 vertices and eight substeps', () => {
    const cloth = new XpbdCloth(grid(25, 24), options);
    // Measured locally: avg 0.428 ms, p95 0.434 ms/step (600 vertices, 8 substeps, no contacts).
    measureBudget(cloth, 30); // Warm up JIT before sampling.
    const result = measureBudget(cloth, 120);
    console.info('XPBD 600 vertices, 8 substeps (ms/step):', result);
    expect(result.avgMs).toBeLessThan(4);
    expect(result.p95Ms).toBeGreaterThan(0);
    expect(() => measureBudget(cloth, 0)).toThrow(RangeError);
  });
});
