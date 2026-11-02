import { describe, expect, it } from 'vitest';
import { gownMesh } from '../../src/ar/gown-mesh.ts';
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

function mesh(over?: Parameters<typeof pose>[0]) {
  const frame = bodyFrame(pose(over), SIZE);
  if (!frame) throw new Error('no frame');
  return gownMesh(frame);
}

const ys = (pts: { y: number }[]) => pts.map((p) => p.y);

describe('gownMesh', () => {
  it('covers shoulders to mid-calf with a 6-column body grid', () => {
    const m = mesh();
    expect(m.body.length % 6).toBe(0);
    const top = Math.min(...m.body.flatMap((q) => ys(q.p)));
    const hem = Math.max(...m.body.flatMap((q) => ys(q.p)));
    expect(top).toBeCloseTo(300, 0); // shoulder line
    // Halfway knee (780) → ankle (960).
    expect(hem).toBeCloseTo(870, 0);
  });

  it('extrapolates the hem when the legs are out of frame', () => {
    const m = mesh({ leftKnee: null, rightKnee: null, leftAnkle: null, rightAnkle: null });
    const hem = Math.max(...m.body.flatMap((q) => ys(q.p)));
    expect(hem).toBeGreaterThan(600 + 300); // well below the hips
  });

  it('runs each sleeve along shoulder → elbow and ends with a cuff at the wrist', () => {
    const m = mesh();
    expect(m.sleeves).toHaveLength(4);
    expect(m.cuffs).toHaveLength(2);
    const cuffEnd = m.cuffs[0]?.p ?? [];
    const midEnd = {
      x: ((cuffEnd[2]?.x ?? 0) + (cuffEnd[3]?.x ?? 0)) / 2,
      y: ((cuffEnd[2]?.y ?? 0) + (cuffEnd[3]?.y ?? 0)) / 2,
    };
    expect(midEnd.x).toBeCloseTo(680, 0);
    expect(midEnd.y).toBeCloseTo(580, 0);
  });

  it('follows a raised arm', () => {
    const m = mesh({ leftElbow: [0.75, 0.25], leftWrist: [0.85, 0.15] });
    const cuff = m.cuffs[0]?.p ?? [];
    expect(Math.min(...ys(cuff))).toBeLessThan(200);
  });

  it('maps the weave continuously down the body (texture v grows row by row)', () => {
    const m = mesh();
    for (let i = 6; i < m.body.length; i += 6) {
      expect(m.body[i]?.uv[0].y).toBeCloseTo(m.body[i - 6]?.uv[3].y ?? Number.NaN, 5);
    }
  });

  it('shows ties, neckline and all five hotspots', () => {
    const m = mesh();
    expect(m.ties.length).toBeGreaterThanOrEqual(2);
    expect(m.neckline.length).toBeGreaterThan(4);
    expect(m.hotspots.map((h) => h.id).sort()).toEqual(
      ['cierre-posterior', 'cuello', 'mangas', 'punos', 'zona-esteril'].sort(),
    );
  });
});
