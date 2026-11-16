import { describe, expect, it } from 'vitest';
import {
  approxWorldFromImage,
  estimateFocal,
  FovCalibrator,
  type FovSample,
  projectionCheck,
  solveTranslation,
  type WorldPoint,
} from '../../src/ar/camera-fov.ts';

const size = { width: 1280, height: 720 };
const indices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const skeleton = [
  [-0.19, -0.52, 0.03],
  [0.19, -0.52, -0.03],
  [-0.29, -0.27, -0.13],
  [0.29, -0.27, 0.12],
  [-0.3, -0.03, -0.25],
  [0.3, -0.03, 0.18],
  [-0.14, 0, 0],
  [0.14, 0, 0],
  [-0.15, 0.43, -0.08],
  [0.15, 0.43, 0.1],
  [-0.16, 0.85, 0.04],
  [0.16, 0.85, -0.04],
];
function frame(
  degrees: number,
  n: number,
  noise = true,
): FovSample & { t: [number, number, number]; f: number } {
  const f = size.width / (2 * Math.tan((degrees * Math.PI) / 360));
  const t: [number, number, number] = [
    0.18 * Math.sin(n * 0.8),
    0.04 * Math.cos(n),
    2.2 + 0.35 * Math.sin(n * 0.6),
  ];
  const world: WorldPoint[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  indices.forEach((index, j) => {
    const [x = 0, y = 0, z = 0] = skeleton[j] ?? [];
    world[index] = { x, y, z: z + (j < 6 ? 0.1 * Math.sin(n * 0.7 + j) : 0), visibility: 1 };
  });
  const image = world.map((w, j) => ({
    x:
      ((f * (w.x + t[0])) / (w.z + t[2]) +
        size.width / 2 +
        (noise ? 1.5 * Math.sin(n * 13.7 + j * 8.3) : 0)) /
      size.width,
    y:
      ((f * (w.y + t[1])) / (w.z + t[2]) +
        size.height / 2 +
        (noise ? 1.5 * Math.cos(n * 7.1 + j * 3.7) : 0)) /
      size.height,
    visibility: w.visibility,
  }));
  return { world, image, f, t };
}
function samples(degrees: number) {
  const frames = Array.from({ length: 35 }, (_, i) => frame(degrees, i));
  const outlier = frame(95, 5);
  outlier.image = outlier.image.map((p, i) => ({
    ...p,
    x: p.x + 0.05 * Math.sin(i),
    y: p.y + 0.05 * Math.cos(i),
  }));
  frames[5] = outlier;
  return frames;
}

describe('metric camera calibration', () => {
  it.each([55, 63, 78])('recovers a %s degree lens with noise and one outlier', (degrees) => {
    const frames = samples(degrees);
    const estimate = estimateFocal(frames, size);
    expect(estimate).not.toBeNull();
    if (!estimate) return;
    const error = Math.abs((estimate.fovX * 180) / Math.PI - degrees);
    let translationError = 0;
    frames.forEach((sample, i) => {
      if (i === 5) return;
      const solved = solveTranslation(sample.world, sample.image, size, estimate.f);
      expect(solved).not.toBeNull();
      if (solved)
        translationError = Math.max(
          translationError,
          Math.hypot(...solved.t.map((v, axis) => v - (sample.t[axis] ?? 0))),
        );
    });
    console.info(
      `FOV ${degrees}: error=${error.toFixed(4)} deg; max translation=${(translationError * 100).toFixed(3)} cm`,
    );
    expect(error).toBeLessThan(3);
    expect(translationError).toBeLessThan(0.05);
    expect(estimate.fovY).toBeCloseTo(2 * Math.atan(size.height / (2 * estimate.f)), 10);
  });

  it('solves exact translation and checks projection in pixels', () => {
    const s = frame(63, 2, false);
    const solved = solveTranslation(s.world, s.image, size, s.f);
    expect(solved?.t[2]).toBeCloseTo(s.t[2], 10);
    expect(projectionCheck(s.world, s.image, size, s.f, s.t)).toBeLessThan(1e-10);
    const shifted = s.image.map((p) => ({
      ...p,
      x: p.x + 3 / size.width,
      y: p.y + 4 / size.height,
    }));
    expect(projectionCheck(s.world, shifted, size, s.f, s.t)).toBeCloseTo(5, 10);
  });

  it('rejects missing, invisible, singular, invalid and behind-camera inputs', () => {
    const s = frame(63, 0);
    expect(solveTranslation([], [], size, s.f)).toBeNull();
    expect(
      solveTranslation(
        s.world.map((w) => ({ ...w, visibility: 0.1 })),
        s.image,
        size,
        s.f,
      ),
    ).toBeNull();
    expect(
      solveTranslation(
        s.world,
        s.image.map((p) => ({ ...p, x: 0.5, y: 0.5 })),
        size,
        s.f,
      ),
    ).toBeNull();
    expect(solveTranslation(s.world, s.image, size, Number.NaN)).toBeNull();
    expect(solveTranslation(s.world, s.image, { width: 0, height: 720 }, s.f)).toBeNull();
    expect(
      solveTranslation(
        s.world.map((w) => ({ ...w, x: -w.x, y: -w.y, z: -w.z })),
        s.image,
        size,
        s.f,
      ),
    ).toBeNull();
    expect(estimateFocal([], size)).toBeNull();
    expect(
      estimateFocal(
        Array.from({ length: 5 }, () => ({ ...s, world: s.world.map((w) => ({ ...w, z: 0 })) })),
        size,
      ),
    ).toBeNull();
  });

  it('keeps diverse snapshots, converges, bounds the buffer and resets on resize', () => {
    const calibrator = new FovCalibrator({ capacity: 25 });
    expect((calibrator.result.fovX * 180) / Math.PI).toBeCloseTo(63);
    const first = frame(78, 0);
    for (let i = 0; i < 30; i++) calibrator.add(first.world, first.image, size, i * 100);
    expect(calibrator.result.frames).toBe(1);
    expect(calibrator.ready).toBe(false);
    samples(78).forEach((s, i) => {
      calibrator.add(s.world, s.image, size, 4000 + i * 100);
    });
    expect(calibrator.ready).toBe(true);
    expect(calibrator.result.frames).toBe(25);
    expect((calibrator.result.fovX * 180) / Math.PI).toBeCloseTo(78, 0);
    expect(calibrator.result.confidence).toBeGreaterThan(0.4);
    calibrator.add(first.world, first.image, { width: 640, height: 480 }, 9000);
    expect(calibrator.ready).toBe(false);
  });

  it('makes a hip-centred flat fallback with metric shoulder width', () => {
    const s = frame(63, 0, false);
    const world = approxWorldFromImage(s.image, size);
    const a = world[11];
    const b = world[12];
    const l = world[23];
    const r = world[24];
    expect(a && b && Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(0.38, 10);
    expect(l && r && l.x + r.x).toBeCloseTo(0, 10);
    expect(l && r && l.y + r.y).toBeCloseTo(0, 10);
    expect(world.every((p) => p.z === 0)).toBe(true);
    expect(approxWorldFromImage([], size)).toEqual([]);
    expect(
      approxWorldFromImage(
        s.image.map((p) => ({ ...p, x: 0, y: 0 })),
        size,
      ),
    ).toEqual([]);
  });
});
