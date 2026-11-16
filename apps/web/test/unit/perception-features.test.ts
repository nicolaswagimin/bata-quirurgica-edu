import { BODY_POINTS, type FeatureFrame } from '@bata/shared/perception';
import { describe, expect, it } from 'vitest';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import { extractFeatures } from '../../src/ar/perception/features.ts';

const SIZE = { width: 1000, height: 1000 };

const BASE: Record<number, [number, number]> = {
  0: [0.5, 0.17],
  11: [0.6, 0.3],
  12: [0.4, 0.3],
  13: [0.64, 0.45],
  14: [0.36, 0.45],
  15: [0.6, 0.42],
  16: [0.4, 0.42],
  23: [0.58, 0.6],
  24: [0.42, 0.6],
  25: [0.58, 0.78],
  26: [0.42, 0.78],
  27: [0.58, 0.95],
  28: [0.42, 0.95],
};

function pose(over: Record<number, [number, number]> = {}, hidden: number[] = []): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  for (const [i, [x, y]] of Object.entries({ ...BASE, ...over })) {
    out[Number(i)] = { x, y, z: -0.1, visibility: hidden.includes(Number(i)) ? 0.1 : 0.95 };
  }
  return out;
}

const index = (name: (typeof BODY_POINTS)[number]) => BODY_POINTS.indexOf(name);

function extract(landmarks: Landmark[], over: Partial<Parameters<typeof extractFeatures>[0]> = {}) {
  const frame = extractFeatures({ landmarks, size: SIZE, t: 0, ...over });
  if (!frame) throw new Error('Se esperaba un frame');
  return frame;
}

function transformed(
  landmarks: Landmark[],
  angle: number,
  factor: number,
  dx: number,
  dy: number,
): Landmark[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return landmarks.map((lm) => {
    const x = (lm.x - 0.5) * factor;
    const y = (lm.y - 0.5) * factor;
    return {
      ...lm,
      x: 0.5 + x * cos - y * sin + dx,
      y: 0.5 + x * sin + y * cos + dy,
    };
  });
}

describe('extractFeatures', () => {
  it('normaliza al torso: hombros a ±0.5 y caderas hacia abajo', () => {
    const frame = extract(pose());
    expect(frame.points).toHaveLength(BODY_POINTS.length);
    expect(frame.points[index('leftShoulder')]?.x).toBeCloseTo(0.5, 6);
    expect(frame.points[index('leftShoulder')]?.y).toBeCloseTo(0, 6);
    expect(frame.points[index('rightShoulder')]?.x).toBeCloseTo(-0.5, 6);
    expect(frame.points[index('leftHip')]?.y).toBeGreaterThan(0);
    expect(frame.points[index('nose')]?.y).toBeLessThan(0);
    expect(frame.hands).toEqual([]);
  });

  it('es invariante a traslación, escala y rotación', () => {
    const original = extract(pose());
    const moved = extract(transformed(pose(), Math.PI / 6, 1.35, 0.1, -0.05));
    framePoints(original).forEach((point, i) => {
      expect(point.x).toBeCloseTo(framePoints(moved)[i]?.x ?? Number.NaN, 6);
      expect(point.y).toBeCloseTo(framePoints(moved)[i]?.y ?? Number.NaN, 6);
    });
  });

  it('devuelve null sin hombros o caderas visibles', () => {
    expect(extractFeatures({ landmarks: pose({}, [23]), size: SIZE, t: 0 })).toBeNull();
    expect(extractFeatures({ landmarks: pose({}, [12]), size: SIZE, t: 0 })).toBeNull();
  });

  it('mide el ángulo del codo: recto y en 90 grados', () => {
    const straight = extract(pose({ 13: [0.7, 0.3], 15: [0.8, 0.3] }));
    expect(straight.angles.leftElbow).toBeCloseTo(Math.PI, 5);

    const bent = extract(pose({ 13: [0.7, 0.3], 15: [0.7, 0.4] }));
    expect(bent.angles.leftElbow).toBeCloseTo(Math.PI / 2, 5);
  });

  it('marca -1 cuando falta un punto para el ángulo', () => {
    const frame = extract(pose({}, [15]));
    expect(frame.angles.leftElbow).toBe(-1);
    expect(frame.points[index('leftWrist')]?.visibility).toBe(0);
  });

  it('calcula velocidades en anchos de hombros por segundo', () => {
    const before = extract(pose());
    const after = extract(pose({ 15: [0.65, 0.42] }), {
      t: 100,
      dtMs: 100,
      previous: before,
    });
    const wrist = index('leftWrist');
    const expected = ((after.points[wrist]?.x ?? 0) - (before.points[wrist]?.x ?? 0)) / 0.1;
    expect(after.velocities[wrist]?.x).toBeCloseTo(expected, 5);
  });

  it('limita el dt para que una pausa no invente velocidades', () => {
    const before = extract(pose());
    const after = extract(pose({ 15: [0.65, 0.42] }), {
      t: 2000,
      dtMs: 2000,
      previous: before,
    });
    const wrist = index('leftWrist');
    const expected = ((after.points[wrist]?.x ?? 0) - (before.points[wrist]?.x ?? 0)) / 0.5;
    expect(after.velocities[wrist]?.x).toBeCloseTo(expected, 5);
  });

  it('conserva el marco del torso en píxeles para diagnóstico', () => {
    const frame = extract(pose());
    expect(frame.torso.shoulderWidth).toBeCloseTo(200, 4);
    expect(frame.torso.centerX).toBeCloseTo(500, 4);
    expect(frame.torso.centerY).toBeCloseTo(450, 4);
    expect(frame.torso.angleRad).toBeCloseTo(0, 6);
  });
});

function framePoints(frame: FeatureFrame) {
  return frame.points;
}
