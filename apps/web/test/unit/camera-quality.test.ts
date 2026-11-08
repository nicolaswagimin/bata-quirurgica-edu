import { describe, expect, it } from 'vitest';
import {
  assessQuality,
  type FrameSample,
  HIGH_JITTER,
  LOW_DETAIL,
  LOW_FPS,
  MIN_COVERAGE,
  QUALITY_HINTS,
  sampleFrame,
  TrackQuality,
} from '../../src/ar/camera-quality.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';

const SIZE = { width: 1000, height: 1000 };

function frame(
  width: number,
  height: number,
  rgb: (x: number, y: number) => [number, number, number],
) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgb(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

const BASE: Record<number, [number, number]> = {
  0: [0.5, 0.15],
  11: [0.6, 0.3],
  12: [0.4, 0.3],
  13: [0.62, 0.45],
  14: [0.38, 0.45],
  15: [0.6, 0.5],
  16: [0.4, 0.5],
  23: [0.58, 0.6],
  24: [0.42, 0.6],
  27: [0.57, 0.9],
  28: [0.43, 0.9],
};

function person(over: Record<number, [number, number]> = {}, visibility = 0.95): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  for (const [i, [x, y]] of Object.entries({ ...BASE, ...over })) {
    out[Number(i)] = { x, y, z: 0, visibility };
  }
  return out;
}

const GOOD_FRAME: FrameSample = { luma: 0.5, dark: 0.05, bright: 0.02, detail: 0.12 };

describe('sampleFrame', () => {
  it('reads a black frame as dark and flat', () => {
    const sample = sampleFrame(
      frame(8, 8, () => [0, 0, 0]),
      8,
      8,
    );
    expect(sample.luma).toBeCloseTo(0);
    expect(sample.dark).toBe(1);
    expect(sample.detail).toBeCloseTo(0);
  });

  it('reads a white frame as bright', () => {
    const sample = sampleFrame(
      frame(8, 8, () => [255, 255, 255]),
      8,
      8,
    );
    expect(sample.luma).toBeCloseTo(1);
    expect(sample.bright).toBe(1);
  });

  it('measures horizontal detail with a checkerboard', () => {
    const sample = sampleFrame(
      frame(8, 8, (x) => (x % 2 === 0 ? [0, 0, 0] : [255, 255, 255])),
      8,
      8,
    );
    expect(sample.luma).toBeCloseTo(0.5);
    expect(sample.detail).toBeGreaterThan(0.9);
  });

  it('handles an empty buffer', () => {
    expect(sampleFrame(new Uint8ClampedArray(), 0, 0)).toEqual({
      luma: 0,
      dark: 0,
      bright: 0,
      detail: 0,
    });
  });
});

describe('TrackQuality', () => {
  it('reads a still, fully visible body as confident and steady', () => {
    const track = new TrackQuality();
    let sample = track.update(person(), SIZE, true);
    for (let i = 0; i < 4; i++) sample = track.update(person(), SIZE, true);
    expect(sample.confidence).toBeCloseTo(0.95);
    expect(sample.jitter).toBeCloseTo(0);
    expect(sample.hasBody).toBe(true);
  });

  it('measures body coverage from nose to ankles', () => {
    const sample = new TrackQuality().update(person(), SIZE, true);
    expect(sample.coverage).toBeCloseTo(0.75);
  });

  it('detects the high-frequency noise of a shaking pose', () => {
    const track = new TrackQuality();
    for (let i = 0; i < 8; i++) {
      const dx = i % 2 === 0 ? 0.02 : -0.02;
      const shaken = person(
        Object.fromEntries(
          [11, 12, 13, 14, 15, 16, 23, 24].map((k) => {
            const [x, y] = BASE[k] as [number, number];
            return [k, [x + dx, y]];
          }),
        ),
      );
      track.update(shaken, SIZE, true);
    }
    expect(track.update(person(), SIZE, true).jitter).toBeGreaterThan(HIGH_JITTER);
  });

  it('drops confidence when the landmarks are not visible', () => {
    const half = person({}, 0.2);
    expect(new TrackQuality().update(half, SIZE, true).confidence).toBeCloseTo(0.2);
  });
});

describe('assessQuality', () => {
  const steady = { confidence: 0.95, jitter: 0, coverage: 0.75, hasBody: true };

  it('gives a clean bill to a well-lit, steady, complete body', () => {
    const report = assessQuality({ frame: GOOD_FRAME, track: steady, fps: 30 });
    expect(report).toMatchObject({
      score: 100,
      issues: [],
      primary: null,
      hint: null,
      hold: false,
    });
    expect(report.smoothing).toBeCloseTo(0.49, 2);
  });

  it('flags a dark room first', () => {
    const report = assessQuality({
      frame: { ...GOOD_FRAME, luma: 0.05, dark: 0.9 },
      track: { ...steady, hasBody: false },
      fps: 30,
    });
    expect(report.issues).toEqual(expect.arrayContaining(['sin-luz', 'pose']));
    expect(report.hint).toBe(QUALITY_HINTS['sin-luz']);
  });

  it('asks for the body when there is none and holds the last one', () => {
    const report = assessQuality({
      frame: GOOD_FRAME,
      track: { ...steady, hasBody: false, confidence: 0, coverage: 0 },
      fps: 30,
    });
    expect(report.issues).toContain('pose');
    expect(report.hint).toBe(QUALITY_HINTS.pose);
    expect(report.hold).toBe(true);
  });

  it('asks to step back when the body is too small', () => {
    const report = assessQuality({
      frame: GOOD_FRAME,
      track: { ...steady, coverage: MIN_COVERAGE - 0.1 },
      fps: 30,
    });
    expect(report.issues).toContain('encuadre');
    expect(report.hint).toBe(QUALITY_HINTS.encuadre);
  });

  it('steadies the smoothing when the tracking shakes', () => {
    const calm = assessQuality({ frame: GOOD_FRAME, track: steady, fps: 30 });
    const shaken = assessQuality({
      frame: GOOD_FRAME,
      track: { ...steady, jitter: HIGH_JITTER * 3 },
      fps: 30,
    });
    expect(shaken.issues).toContain('movido');
    expect(shaken.smoothing).toBeLessThan(calm.smoothing);
  });

  it('detects a backlit scene', () => {
    const report = assessQuality({
      frame: { ...GOOD_FRAME, luma: 0.4, bright: 0.5 },
      track: steady,
      fps: 30,
    });
    expect(report.issues).toContain('contraluz');
    expect(report.hint).toBe(QUALITY_HINTS.contraluz);
  });

  it('reports a slow device', () => {
    const report = assessQuality({ frame: GOOD_FRAME, track: steady, fps: LOW_FPS - 4 });
    expect(report.issues).toContain('lento');
    expect(report.score).toBeLessThan(100);
  });

  it('flags a blurry frame only when there is a body to blur', () => {
    const blurry = { ...GOOD_FRAME, detail: LOW_DETAIL / 2 };
    expect(assessQuality({ frame: blurry, track: steady, fps: 30 }).issues).toContain('movido');
    expect(
      assessQuality({
        frame: blurry,
        track: { ...steady, hasBody: false },
        fps: 30,
      }).issues,
    ).not.toContain('movido');
  });
});
