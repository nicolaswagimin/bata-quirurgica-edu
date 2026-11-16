import { describe, expect, it } from 'vitest';
import {
  BODY_POINT_COUNT,
  CaptureTakeSchema,
  FeatureFrameSchema,
  PERCEPTION_VERSION,
} from '../src/perception.ts';

function point(x = 0, y = 0) {
  return { x, y, z: 0, visibility: 0.9 };
}

function frame(t = 0) {
  return {
    t,
    points: Array.from({ length: BODY_POINT_COUNT }, () => point()),
    velocities: Array.from({ length: BODY_POINT_COUNT }, () => ({ x: 0, y: 0 })),
    angles: { leftElbow: 3, rightElbow: 3, leftShoulder: 1.5, rightShoulder: 1.5, torsoTilt: 0 },
    torso: { centerX: 500, centerY: 400, shoulderWidth: 200, torsoHeight: 180, angleRad: 0 },
    hands: [],
  };
}

function take(over: Record<string, unknown> = {}) {
  return {
    version: PERCEPTION_VERSION,
    label: 'g3-bata',
    source: 'ar-espejo',
    capturedAt: '2026-11-07T20:00:00.000Z',
    durationMs: 2000,
    sampleHz: 15,
    frames: [frame(0), frame(66)],
    ...over,
  };
}

describe('FeatureFrameSchema', () => {
  it('acepta un frame completo con las dos manos reservadas', () => {
    expect(FeatureFrameSchema.safeParse(frame()).success).toBe(true);
    const hands = Array.from({ length: BODY_POINT_COUNT }).map(() => point());
    const withHands = {
      ...frame(),
      hands: [
        { side: 'left', points: Array.from({ length: 21 }, () => point()) },
        { side: 'right', points: Array.from({ length: 21 }, () => point()) },
      ],
    };
    expect(FeatureFrameSchema.safeParse(withHands).success).toBe(true);
    expect(hands).toHaveLength(BODY_POINT_COUNT);
  });

  it('exige los 13 puntos del cuerpo', () => {
    const short = { ...frame(), points: frame().points.slice(0, -1) };
    expect(FeatureFrameSchema.safeParse(short).success).toBe(false);
  });

  it('rechaza visibilidad fuera de rango y números no finitos', () => {
    const badVisibility = {
      ...frame(),
      points: frame().points.map((p, i) => (i === 0 ? { ...p, visibility: 1.2 } : p)),
    };
    expect(FeatureFrameSchema.safeParse(badVisibility).success).toBe(false);

    const notFinite = { ...frame(), angles: { ...frame().angles, torsoTilt: Number.NaN } };
    expect(FeatureFrameSchema.safeParse(notFinite).success).toBe(false);
  });

  it('rellena hands vacío cuando falta', () => {
    const { hands: _ignored, ...withoutHands } = frame();
    const parsed = FeatureFrameSchema.parse(withoutHands);
    expect(parsed.hands).toEqual([]);
  });
});

describe('CaptureTakeSchema', () => {
  it('acepta una toma válida', () => {
    expect(CaptureTakeSchema.safeParse(take()).success).toBe(true);
  });

  it('rechaza una versión distinta', () => {
    expect(CaptureTakeSchema.safeParse(take({ version: 2 })).success).toBe(false);
  });

  it('exige etiqueta y al menos un frame', () => {
    expect(CaptureTakeSchema.safeParse(take({ label: '' })).success).toBe(false);
    expect(CaptureTakeSchema.safeParse(take({ frames: [] })).success).toBe(false);
  });

  it('solo acepta el origen del espejo', () => {
    expect(CaptureTakeSchema.safeParse(take({ source: 'bata-3d' })).success).toBe(false);
  });
});
