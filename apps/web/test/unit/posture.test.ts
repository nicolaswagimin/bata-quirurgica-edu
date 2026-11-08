import { describe, expect, it } from 'vitest';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import {
  bodyFrame,
  detectViolations,
  LandmarkSmoother,
  MAX_SMOOTHING,
  MIN_SMOOTHING,
  LM,
  type Violation,
  ViolationTracker,
} from '../../src/ar/posture.ts';

const SIZE = { width: 1000, height: 1000 };

type Pt = { x: number; y: number; z?: number };

// Frontal stance in a 1000×1000 frame: shoulders 200 px apart at y=300, hips at y=600.
// Shoulder width 200, torso height 300, waist at y≈516.
function pose(parts: Partial<Record<keyof typeof LM, Pt | null>> = {}): Landmark[] {
  const base: Record<keyof typeof LM, Pt> = {
    nose: { x: 0.5, y: 0.18 },
    leftShoulder: { x: 0.6, y: 0.3 },
    rightShoulder: { x: 0.4, y: 0.3 },
    leftElbow: { x: 0.64, y: 0.45 },
    rightElbow: { x: 0.36, y: 0.45 },
    leftWrist: { x: 0.56, y: 0.42, z: -0.1 },
    rightWrist: { x: 0.44, y: 0.42, z: -0.1 },
    leftHip: { x: 0.58, y: 0.6 },
    rightHip: { x: 0.42, y: 0.6 },
    leftKnee: { x: 0.58, y: 0.78 },
    rightKnee: { x: 0.42, y: 0.78 },
    leftAnkle: { x: 0.58, y: 0.95 },
    rightAnkle: { x: 0.42, y: 0.95 },
  };
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const key of Object.keys(base) as (keyof typeof LM)[]) {
    const p = key in parts ? parts[key] : base[key];
    out[LM[key]] = p
      ? { x: p.x, y: p.y, z: p.z ?? 0, visibility: 0.95 }
      : { x: 0, y: 0, z: 0, visibility: 0.1 };
  }
  return out;
}

function violations(parts: Parameters<typeof pose>[0]): Set<Violation> {
  const frame = bodyFrame(pose(parts), SIZE);
  if (!frame) throw new Error('no frame');
  return detectViolations(frame);
}

describe('bodyFrame', () => {
  it('needs both shoulders and hips', () => {
    expect(bodyFrame(pose({ leftHip: null }), SIZE)).toBeNull();
    const f = bodyFrame(pose(), SIZE);
    expect(f?.shoulderWidth).toBeCloseTo(200);
    expect(f?.torsoHeight).toBeCloseTo(300);
  });
});

describe('detectViolations', () => {
  it('stays silent with hands in front of the chest', () => {
    expect([...violations({})]).toEqual([]);
  });

  it('flags a wrist below the waist only past the margin', () => {
    // Waist at depth 0.72 (y=516); margin 0.08 → line at y=540.
    expect(violations({ rightWrist: { x: 0.44, y: 0.53, z: -0.1 } }).has('bajo-cintura')).toBe(
      false,
    );
    expect(violations({ rightWrist: { x: 0.44, y: 0.56, z: -0.1 } }).has('bajo-cintura')).toBe(
      true,
    );
  });

  it('flags a hand at the neck but not hands held out in front at neck height', () => {
    expect(violations({ leftWrist: { x: 0.51, y: 0.27, z: 0 } }).has('cuello')).toBe(true);
    expect(violations({ leftWrist: { x: 0.51, y: 0.27, z: -0.6 } }).has('cuello')).toBe(false);
  });

  it('flags hands reaching behind the body', () => {
    expect(violations({ rightWrist: { x: 0.38, y: 0.45, z: 0.45 } }).has('espalda')).toBe(true);
  });

  it('flags hands tucked under the armpits (crossed arms)', () => {
    // Left wrist under the right armpit and vice versa.
    const v = violations({
      leftWrist: { x: 0.42, y: 0.36, z: 0 },
      rightWrist: { x: 0.58, y: 0.36, z: 0 },
    });
    expect(v.has('axilas')).toBe(true);
  });

  it('ignores wrists the model cannot see', () => {
    expect([...violations({ leftWrist: null, rightWrist: null })]).toEqual([]);
  });
});

describe('ViolationTracker', () => {
  it('needs the violation to persist before warning and to vanish before clearing', () => {
    const t = new ViolationTracker(350, 600);
    const v = new Set<Violation>(['cuello']);
    const none = new Set<Violation>();
    expect(t.update(v, 0).size).toBe(0);
    expect(t.update(none, 100).size).toBe(0); // a one-frame blip never warns
    expect(t.update(v, 200).size).toBe(0);
    expect(t.update(v, 560).has('cuello')).toBe(true);
    expect(t.update(none, 600).has('cuello')).toBe(true); // brief recovery keeps it
    expect(t.update(v, 700).has('cuello')).toBe(true);
    expect(t.update(none, 800).has('cuello')).toBe(true);
    expect(t.update(none, 1450).has('cuello')).toBe(false);
  });
});

describe('LandmarkSmoother', () => {
  it('moves part of the way towards each new value', () => {
    const s = new LandmarkSmoother(0.5);
    s.smooth([{ x: 0, y: 0, visibility: 1 }]);
    const [p] = s.smooth([{ x: 1, y: 1, visibility: 1 }]);
    expect(p?.x).toBeCloseTo(0.5);
  });

  it('setAlpha changes how far it follows a noisy jump', () => {
    const steady = new LandmarkSmoother(0.5);
    steady.setAlpha(0.15);
    steady.smooth([{ x: 0, y: 0, visibility: 1 }]);
    expect(steady.smooth([{ x: 1, y: 0, visibility: 1 }])[0]?.x).toBeCloseTo(0.15);

    const quick = new LandmarkSmoother(0.5);
    quick.setAlpha(0.6);
    quick.smooth([{ x: 0, y: 0, visibility: 1 }]);
    expect(quick.smooth([{ x: 1, y: 0, visibility: 1 }])[0]?.x).toBeCloseTo(0.6);
  });

  it('clamps the alpha to the playable range', () => {
    const slow = new LandmarkSmoother(0.5);
    slow.setAlpha(0);
    slow.smooth([{ x: 0, y: 0, visibility: 1 }]);
    expect(slow.smooth([{ x: 1, y: 0, visibility: 1 }])[0]?.x).toBeCloseTo(MIN_SMOOTHING);

    const fast = new LandmarkSmoother(0.5);
    fast.setAlpha(5);
    fast.smooth([{ x: 0, y: 0, visibility: 1 }]);
    expect(fast.smooth([{ x: 1, y: 0, visibility: 1 }])[0]?.x).toBeCloseTo(MAX_SMOOTHING);
  });
});
