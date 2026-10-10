import { describe, expect, it } from 'vitest';
import { drawGown, gownGeometry, HEM_WIDTH_FACTOR } from '../../src/ar/gown-overlay.ts';
import type { Anchor } from '../../src/ar/overlay-math.ts';

const LEVEL: Anchor = {
  centerX: 500,
  centerY: 250,
  shoulderWidthPx: 200,
  torsoHeightPx: 200,
  angleRad: 0,
};

const HOTSPOT_IDS = ['cuello', 'punos', 'zona-esteril', 'mangas', 'cierre-posterior'];

function rotateAround(p: { x: number; y: number }, c: { x: number; y: number }, a: number) {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return {
    x: c.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: c.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

describe('gownGeometry', () => {
  it('returns no shapes or hotspots without an anchor', () => {
    expect(gownGeometry(null)).toEqual({ shapes: [], hotspots: [] });
  });

  it('spans shoulders to hips, widening to 1.4× the shoulder width at the hem', () => {
    const { shapes } = gownGeometry(LEVEL);
    const body = shapes.find((s) => s.kind === 'body');
    expect(body?.points).toEqual([
      { x: 400, y: 150 },
      { x: 600, y: 150 },
      { x: 500 + 100 * HEM_WIDTH_FACTOR, y: 350 },
      { x: 500 - 100 * HEM_WIDTH_FACTOR, y: 350 },
    ]);
    const sleeves = shapes.filter((s) => s.kind === 'sleeve');
    expect(sleeves).toHaveLength(2);
    // Each sleeve starts at a shoulder.
    expect(sleeves.map((s) => s.points[0])).toEqual([
      { x: 600, y: 150 },
      { x: 400, y: 150 },
    ]);
  });

  it('returns the five hotspots in canvas pixels, the neck at the shoulder line', () => {
    const { hotspots } = gownGeometry(LEVEL);
    expect(hotspots.map((h) => h.id).sort()).toEqual([...HOTSPOT_IDS].sort());
    const cuello = hotspots.find((h) => h.id === 'cuello');
    expect(cuello).toMatchObject({ x: 500, y: 150 });
    const sterile = hotspots.find((h) => h.id === 'zona-esteril');
    expect(sterile?.x).toBeCloseTo(500);
    expect(sterile?.y).toBeGreaterThan(150);
    expect(sterile?.y).toBeLessThan(350);
  });

  it('scales with the shoulder width', () => {
    const small = gownGeometry(LEVEL);
    const big = gownGeometry({ ...LEVEL, shoulderWidthPx: 400, torsoHeightPx: 400 });
    for (const [i, spot] of small.hotspots.entries()) {
      const scaled = big.hotspots[i];
      expect(scaled?.x).toBeCloseTo(500 + (spot.x - 500) * 2);
      expect(scaled?.y).toBeCloseTo(250 + (spot.y - 250) * 2);
    }
  });

  it('rotates everything by the shoulder angle around the center', () => {
    const angle = Math.PI / 6;
    const level = gownGeometry(LEVEL);
    const tilted = gownGeometry({ ...LEVEL, angleRad: angle });
    const center = { x: LEVEL.centerX, y: LEVEL.centerY };
    for (const [i, spot] of level.hotspots.entries()) {
      const expected = rotateAround(spot, center, angle);
      expect(tilted.hotspots[i]?.x).toBeCloseTo(expected.x);
      expect(tilted.hotspots[i]?.y).toBeCloseTo(expected.y);
    }
    const p = rotateAround({ x: 400, y: 150 }, center, angle);
    expect(tilted.shapes[0]?.points[0]?.x).toBeCloseTo(p.x);
    expect(tilted.shapes[0]?.points[0]?.y).toBeCloseTo(p.y);
  });
});

describe('drawGown', () => {
  it('fills every shape and hotspot with the given color', () => {
    const calls: string[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      beginPath: () => calls.push('begin'),
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => calls.push('fill'),
      stroke: () => undefined,
      arc: () => calls.push('arc'),
    };
    drawGown(ctx, gownGeometry(LEVEL), '#127A5F');
    expect(ctx.fillStyle).toBe('#127A5F');
    expect(calls.filter((c) => c === 'fill')).toHaveLength(3 + 5);
    expect(calls.filter((c) => c === 'arc')).toHaveLength(5);
  });

  it('draws nothing for an empty geometry', () => {
    let fills = 0;
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => fills++,
      stroke: () => undefined,
      arc: () => undefined,
    };
    drawGown(ctx, gownGeometry(null), 'red');
    expect(fills).toBe(0);
  });
});
