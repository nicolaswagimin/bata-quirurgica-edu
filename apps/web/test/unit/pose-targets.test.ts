import type { PracticeKind } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import { hangingFrame, sleeveOpenings } from '../../src/ar/hanging-gown.ts';
import { handsAtFace } from '../../src/ar/mask.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import {
  ghostSkeleton,
  jointHint,
  jointStatus,
  targetPose,
  toImage,
} from '../../src/ar/pose-targets.ts';
import { bodyFrame, dist } from '../../src/ar/posture.ts';
import { inSterileBand } from '../../src/ar/practice.ts';
import { handsAtNeck, handsUnfolding } from '../../src/ar/practice-session-v2.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test geometry');
  return value;
}

const SIZE = { width: 1000, height: 1000 };
function pose(): Landmark[] {
  const points: Record<number, [number, number]> = {
    0: [0.5, 0.17],
    9: [0.51, 0.2],
    10: [0.49, 0.2],
    11: [0.6, 0.3],
    12: [0.4, 0.3],
    23: [0.58, 0.6],
    24: [0.42, 0.6],
  };
  return Array.from({ length: 33 }, (_, i) => ({
    x: points[i]?.[0] ?? 0,
    y: points[i]?.[1] ?? 0,
    z: 0,
    visibility: points[i] ? 1 : 0,
  }));
}
function atTarget(kind: PracticeKind) {
  const landmarks = pose();
  const base = bodyFrame(landmarks, SIZE);
  const target = targetPose(kind);
  if (!base || !target) throw new Error('Missing target');
  for (const [joint, index] of [
    ['leftWrist', 15],
    ['rightWrist', 16],
    ['leftElbow', 13],
    ['rightElbow', 14],
  ] as const) {
    const p = toImage(base, target[joint]);
    landmarks[index] = { x: p.x / SIZE.width, y: p.y / SIZE.height, z: -0.35, visibility: 1 };
  }
  const body = bodyFrame(landmarks, SIZE);
  if (!body) throw new Error('Missing body');
  return { body, landmarks };
}

describe('target geometry', () => {
  it.each(['band', 'friction', 'still', 'gloves'] as const)(
    '%s is inside the sterile band',
    (kind) => {
      const { body } = atTarget(kind);
      expect(inSterileBand(body)).toBe(true);
      if (kind === 'gloves')
        expect(dist(required(body.left.wrist), required(body.right.wrist))).toBeLessThanOrEqual(
          body.shoulderWidth * 0.45,
        );
    },
  );
  it('passes neck, unfold and face predicates', () => {
    expect(handsAtNeck(atTarget('neck').body)).toBe(true);
    expect(handsUnfolding(atTarget('unfold').body)).toBe(true);
    const { body, landmarks } = atTarget('mask');
    expect(handsAtFace(landmarks, SIZE, body.shoulderWidth)).toBe(true);
  });
  it('reaches both sleeve openings with arms raised', () => {
    const { body } = atTarget('sleeves');
    const openings = sleeveOpenings(hangingFrame(body));
    for (const [i, limb] of [body.left, body.right].entries()) {
      expect(dist(required(limb.wrist), required(openings[i]))).toBeLessThan(
        body.shoulderWidth * 0.35,
      );
    }
    expect(targetPose('sleeves')?.leftElbow.depth).toBeLessThanOrEqual(0.4);
    expect(inSterileBand(body)).toBe(true);
  });
  it('maps rotated torso coordinates and anchors the ghost', () => {
    const { body } = atTarget('band');
    const rotated = { ...body, across: { x: 0, y: 1 }, down: { x: -1, y: 0 } };
    expect(toImage(rotated, { side: 0.5, depth: 0.5 })).toEqual({ x: 350, y: 400 });
    const ghost = ghostSkeleton(body, 'band');
    expect(ghost?.points.leftShoulder).toEqual(body.left.shoulder);
    expect(ghost?.points.leftWrist).toEqual(body.left.wrist);
    expect(ghost?.bones).toHaveLength(8);
    expect(targetPose('turn')).toBeNull();
    expect(ghostSkeleton(body, 'turn')).toBeNull();
    expect(jointStatus(body, 'turn')).toEqual([]);
  });
});

describe('joint feedback', () => {
  it('omits hidden joints and reports distances, thresholds and arrows', () => {
    const { body } = atTarget('band');
    expect(jointHint(jointStatus(body, 'band'))).toBeNull();
    body.left.elbow = null;
    body.left.wrist = toImage(body, { side: 0.6, depth: 0.38 });
    body.right.wrist = toImage(body, { side: -1, depth: 0.38 });
    const statuses = jointStatus(body, 'band');
    expect(statuses).toHaveLength(3);
    expect(statuses[0]?.status).toBe('near');
    expect(statuses[0]?.distance).toBeCloseTo(0.3);
    expect(statuses[1]?.status).toBe('far');
    expect(statuses[1]?.arrow).toEqual({ x: 1, y: 0 });
    expect(jointHint(statuses)).toBe('Acerca la muñeca derecha al cuerpo');
  });
  it('uses anatomical sides, torso directions and wrists on ties', () => {
    const { body } = atTarget('band');
    body.left.wrist = toImage(body, { side: 0.3, depth: 0.9 });
    const wrist = required(jointStatus(body, 'band')[0]);
    const elbow = { ...wrist, joint: 'rightElbow' as const };
    expect(jointHint([elbow, wrist])).toBe('Sube la muñeca izquierda');
    expect(jointHint([{ ...wrist, torsoDelta: { side: 0, depth: 10 } }])).toBe(
      'Baja la muñeca izquierda',
    );
    expect(jointHint([{ ...elbow, torsoDelta: { side: -20, depth: 0 }, currentSide: 1 }])).toBe(
      'Acerca el codo derecho al cuerpo',
    );
  });
});
