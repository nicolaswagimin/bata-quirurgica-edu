import { describe, expect, it } from 'vitest';
import { computeGownAnchor, FpsMonitor, type Landmark } from '../../src/ar/overlay-math.ts';

const SIZE = { width: 1000, height: 500 };

function pose(points: Record<number, Landmark>): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => points[i] ?? { x: 0, y: 0, visibility: 0 });
}

const level = pose({
  11: { x: 0.6, y: 0.3, visibility: 0.9 },
  12: { x: 0.4, y: 0.3, visibility: 0.9 },
  23: { x: 0.58, y: 0.7, visibility: 0.9 },
  24: { x: 0.42, y: 0.7, visibility: 0.9 },
});

describe('computeGownAnchor', () => {
  it('centers between shoulders and hips with shoulder width and zero angle', () => {
    const anchor = computeGownAnchor(level, SIZE);
    expect(anchor).not.toBeNull();
    expect(anchor?.centerX).toBeCloseTo(500);
    expect(anchor?.centerY).toBeCloseTo(250);
    expect(anchor?.shoulderWidthPx).toBeCloseTo(200);
    expect(anchor?.torsoHeightPx).toBeCloseTo(200);
    expect(anchor?.angleRad).toBeCloseTo(0);
  });

  it('scales width with the shoulders', () => {
    const wide = pose({
      ...Object.fromEntries(level.map((p, i) => [i, p])),
      11: { x: 0.7, y: 0.3, visibility: 0.9 },
      12: { x: 0.3, y: 0.3, visibility: 0.9 },
    });
    const narrow = computeGownAnchor(level, SIZE);
    const broad = computeGownAnchor(wide, SIZE);
    expect(broad?.shoulderWidthPx).toBeCloseTo((narrow?.shoulderWidthPx ?? 0) * 2);
  });

  it('returns the shoulder angle when tilted', () => {
    const tilted = pose({
      11: { x: 0.6, y: 0.5, visibility: 1 },
      12: { x: 0.4, y: 0.1, visibility: 1 },
      23: { x: 0.6, y: 0.9, visibility: 1 },
      24: { x: 0.4, y: 0.9, visibility: 1 },
    });
    // In pixels: dx = 200, dy = 200 → 45°.
    expect(computeGownAnchor(tilted, SIZE)?.angleRad).toBeCloseTo(Math.PI / 4);
  });

  it.each([11, 12, 23, 24])('returns null when landmark %i has visibility below 0.5', (index) => {
    const hidden = level.map((p, i) => (i === index ? { ...p, visibility: 0.49 } : p));
    expect(computeGownAnchor(hidden, SIZE)).toBeNull();
  });

  it('returns null when landmarks are missing', () => {
    expect(computeGownAnchor([], SIZE)).toBeNull();
  });
});

function feed(monitor: FpsMonitor, fromMs: number, toMs: number, fps: number): boolean[] {
  const flags: boolean[] = [];
  for (let t = fromMs; t <= toMs; t += 1000 / fps) flags.push(monitor.record(t).lowPerformance);
  return flags;
}

describe('FpsMonitor', () => {
  it('measures the frame rate', () => {
    const monitor = new FpsMonitor();
    feed(monitor, 0, 2000, 30);
    expect(monitor.fps).toBeCloseTo(30, 0);
  });

  it('reports lowPerformance after 5 continuous seconds below 12 fps', () => {
    const monitor = new FpsMonitor();
    feed(monitor, 0, 1000, 30);
    const flags = feed(monitor, 1100, 7000, 10);
    expect(flags.at(-1)).toBe(true);
    expect(monitor.lowPerformance).toBe(true);
  });

  it('stays false when the drop lasts less than 5 seconds', () => {
    const monitor = new FpsMonitor();
    const flags = [
      ...feed(monitor, 0, 1000, 30),
      ...feed(monitor, 1100, 5000, 10),
      ...feed(monitor, 5030, 9000, 30),
    ];
    expect(flags.every((flag) => !flag)).toBe(true);
  });

  it('resets once the frame rate recovers', () => {
    const monitor = new FpsMonitor();
    feed(monitor, 0, 7000, 8);
    expect(monitor.lowPerformance).toBe(true);
    feed(monitor, 7030, 9000, 30);
    expect(monitor.lowPerformance).toBe(false);
  });
});
