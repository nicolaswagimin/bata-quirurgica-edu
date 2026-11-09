// biome-ignore-all lint/style/noNonNullAssertion: Indices are bounded by matching chain lengths or explicit test fixtures.
import { describe, expect, it } from 'vitest';
import {
  type Capsule,
  capsulesFromLandmarks,
  SpringBones,
  type SpringChainSpec,
  segmentRotations,
  type Vec3,
} from '../../src/ar/spring-bones.ts';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const spec: SpringChainSpec = {
  id: 'hem',
  restLengths: [0.2, 0.2],
  stiffness: 0.025,
  damping: 0.12,
  gravity: 9.81,
  radius: 0.01,
};
const down = { x: 0, y: 1, z: 0 };
const pose = (x = 0, dt = 1 / 60, capsules: Capsule[] = []) => ({
  dt,
  roots: { hem: { x, y: 0, z: 0 } },
  restDirections: { hem: [down, down] },
  capsules,
});
const checkLengths = (points: Vec3[]) => {
  for (let i = 1; i < points.length; i++)
    expect(Math.abs(distance(points[i]!, points[i - 1]!) - 0.2)).toBeLessThan(0.004);
};

describe('SpringBones', () => {
  it('hangs without drifting under gravity for ten seconds', () => {
    const solver = new SpringBones([spec]);
    let points: Vec3[] = [];
    for (let i = 0; i < 600; i++) {
      points = solver.update(pose()).hem!;
      checkLengths(points);
    }
    expect(points[2]).toEqual({ x: 0, y: 0.4, z: 0 });
  });
  it('lags opposite root acceleration, then damps without exploding', () => {
    const solver = new SpringBones([spec]);
    solver.update(pose());
    const first = solver.update(pose(0.15)).hem!;
    expect(first[1]!.x).toBeLessThan(0.15);
    const lag = Math.abs(first[2]!.x - 0.15);
    let points = first;
    for (let i = 0; i < 600; i++) {
      points = solver.update(pose(0.15)).hem!;
      checkLengths(points);
      for (const p of points) expect(distance(p, { x: 0.15, y: 0, z: 0 })).toBeLessThan(0.401);
    }
    expect(Math.abs(points[2]!.x - 0.15)).toBeLessThan(lag * 0.01);
  });
  it('keeps moving joints outside random moving torso capsules and preserves lengths', () => {
    let seed = 8472;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const solver = new SpringBones([spec]);
    for (let i = 0; i < 1000; i++) {
      const c: Capsule = {
        a: { x: -0.2 + random() * 0.02, y: -0.1, z: 0 },
        b: { x: -0.2 + random() * 0.02, y: 0.5, z: 0 },
        radius: 0.13,
      };
      const points = solver.update(pose(-0.04 + random() * 0.08, 1 / 60, [c])).hem!;
      checkLengths(points);
      for (const p of points.slice(1)) {
        const ab = { x: c.b.x - c.a.x, y: c.b.y - c.a.y, z: 0 };
        const t = Math.max(
          0,
          Math.min(1, ((p.x - c.a.x) * ab.x + (p.y - c.a.y) * ab.y) / (ab.x ** 2 + ab.y ** 2)),
        );
        expect(
          distance(p, { x: c.a.x + t * ab.x, y: c.a.y + t * ab.y, z: 0 }),
        ).toBeGreaterThanOrEqual(0.14 - 1e-8);
      }
    }
  });
  it('returns exact animated rest in reduced motion, with collision correction', () => {
    const solver = new SpringBones([spec]);
    solver.update(pose());
    solver.update(pose(0.1));
    expect(solver.update({ ...pose(0.1), reducedMotion: true }).hem).toEqual([
      { x: 0.1, y: 0, z: 0 },
      { x: 0.1, y: 0.2, z: 0 },
      { x: 0.1, y: 0.4, z: 0 },
    ]);
    const center = { x: 0, y: 0.2, z: 0 };
    const points = solver.update({
      ...pose(0, 0, [{ a: center, b: center, radius: 0.05 }]),
      reducedMotion: true,
    }).hem!;
    expect(distance(points[1]!, center)).toBeGreaterThanOrEqual(0.06);
  });
  it('resets on dt spikes, teleports and explicit reset', () => {
    const solver = new SpringBones([spec]);
    solver.update(pose());
    solver.update(pose(0.2));
    expect(solver.update(pose(0.2, 0.2)).hem![2]).toEqual({ x: 0.2, y: 0.4, z: 0 });
    expect(solver.update(pose(1)).hem![2]).toEqual({ x: 1, y: 0.4, z: 0 });
    solver.reset();
    expect(solver.update(pose()).hem![2]).toEqual({ x: 0, y: 0.4, z: 0 });
  });
  it('accumulates fractional timesteps and returns independent snapshots', () => {
    const solver = new SpringBones([spec]);
    const original = solver.update(pose()).hem!;
    solver.update(pose(0.1, 1 / 240));
    const result = solver.update(pose(0.1, 1 / 240)).hem!;
    expect(result[1]!.x).toBeLessThan(0.1);
    expect(original[0]!.x).toBe(0);
  });
  it('builds nine scaled capsules, skipping invisible and missing joints', () => {
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    world[12]!.x = 0.76;
    const all = capsulesFromLandmarks(world);
    expect(all).toHaveLength(9);
    expect(all[0]!.radius).toBeCloseTo(0.26);
    world[13]!.visibility = 0.49;
    expect(capsulesFromLandmarks(world)).toHaveLength(7);
    expect(capsulesFromLandmarks([])).toEqual([]);
  });
  it('produces identity, perpendicular and opposite shortest arcs', () => {
    const origin = { x: 0, y: 0, z: 0 };
    expect(segmentRotations([origin, down], [origin, down])).toEqual([{ x: 0, y: 0, z: 0, w: 1 }]);
    const q = segmentRotations([origin, down], [origin, { x: 1, y: 0, z: 0 }])[0]!;
    expect(q.z).toBeCloseTo(-Math.SQRT1_2);
    expect(q.w).toBeCloseTo(Math.SQRT1_2);
    const opposite = segmentRotations([origin, down], [origin, { x: 0, y: -1, z: 0 }])[0]!;
    expect(opposite.w).toBe(0);
    expect(Math.hypot(opposite.x, opposite.y, opposite.z)).toBeCloseTo(1);
  });
  it('benchmarks four three-joint chains and nine capsules', () => {
    const chains = Array.from({ length: 4 }, (_, i) => ({ ...spec, id: `chain${i}` }));
    const solver = new SpringBones(chains);
    const capsules = Array.from({ length: 9 }, (_, i) => ({
      a: { x: -0.15, y: i * 0.05, z: 0 },
      b: { x: -0.15, y: i * 0.05 + 0.05, z: 0 },
      radius: 0.13,
    }));
    const input = {
      dt: 1 / 60,
      roots: Object.fromEntries(chains.map((c) => [c.id, { x: 0, y: 0, z: 0 }])),
      restDirections: Object.fromEntries(chains.map((c) => [c.id, [down, down]])),
      capsules,
    };
    for (let i = 0; i < 200; i++) solver.update(input);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) solver.update(input);
    const average = (performance.now() - start) / 1000;
    console.info(`SpringBones: ${average.toFixed(4)} ms/update (1000 updates; target <0.2 ms)`);
    expect(average).toBeLessThan(0.5); // Allow noisy shared CI runners.
  });
});
