import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BataPasosSchema } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import { DON_MS, GameSession } from '../../src/ar/game-steps.ts';
import { gownMesh } from '../../src/ar/gown-mesh.ts';
import { hangingFrame, lerpMesh, sleeveOpenings } from '../../src/ar/hanging-gown.ts';
import { faceAnchor, handsAtFace } from '../../src/ar/mask.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import { bodyFrame, type Violation } from '../../src/ar/posture.ts';

const SIZE = { width: 1000, height: 1000 };
const pasos = BataPasosSchema.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../content/protocolos/bata-pasos.json'),
      'utf8',
    ),
  ),
);
const steps = [...pasos.juegoAr].sort((a, b) => a.order - b.order);

type Pt = [number, number, number?];
const BASE: Record<number, Pt> = {
  0: [0.5, 0.17],
  2: [0.52, 0.15],
  5: [0.48, 0.15],
  7: [0.54, 0.16],
  8: [0.46, 0.16],
  9: [0.51, 0.2],
  10: [0.49, 0.2],
  11: [0.6, 0.3],
  12: [0.4, 0.3],
  13: [0.64, 0.45],
  14: [0.36, 0.45],
  15: [0.56, 0.42, -0.1],
  16: [0.44, 0.42, -0.1],
  23: [0.58, 0.6],
  24: [0.42, 0.6],
  25: [0.58, 0.78],
  26: [0.42, 0.78],
  27: [0.58, 0.95],
  28: [0.42, 0.95],
};

function pose(over: Record<number, Pt> = {}): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const [i, [x, y, z]] of Object.entries({ ...BASE, ...over })) {
    out[Number(i)] = { x, y, z: z ?? 0, visibility: 0.95 };
  }
  return out;
}

const HANDS_AT_FACE: Record<number, Pt> = { 15: [0.53, 0.2, -0.2], 16: [0.47, 0.2, -0.2] };

function feed(s: GameSession, lms: Landmark[], from: number, ms: number, v = new Set<Violation>()) {
  let view = s.update({
    body: bodyFrame(lms, SIZE),
    landmarks: lms,
    size: SIZE,
    violations: v,
    now: from,
  });
  for (let t = from + 50; t <= from + ms; t += 50) {
    view = s.update({
      body: bodyFrame(lms, SIZE),
      landmarks: lms,
      size: SIZE,
      violations: v,
      now: t,
    });
  }
  return view;
}

describe('juegoAr content', () => {
  it('starts with the mask and covers every donning step', () => {
    expect(steps[0]?.id).toBe('g1-mascarilla');
    expect(new Set(steps.flatMap((s) => s.covers))).toEqual(
      new Set(pasos.donning.map((d) => d.id)),
    );
  });
});

describe('mask', () => {
  it('anchors between nose and mouth, ear to ear', () => {
    const face = faceAnchor(pose(), SIZE);
    expect(face?.center.y).toBeGreaterThan(170);
    expect(face?.center.y).toBeLessThan(200);
    expect(face?.width).toBeCloseTo(80 * 1.1, 0);
  });

  it('detects both hands at the face', () => {
    expect(handsAtFace(pose(), SIZE, 200)).toBe(false);
    expect(handsAtFace(pose(HANDS_AT_FACE), SIZE, 200)).toBe(true);
  });
});

describe('hanging gown', () => {
  it('shares topology with the worn gown so donning interpolates point by point', () => {
    const body = bodyFrame(pose(), SIZE);
    if (!body) throw new Error('no body');
    const hanging = gownMesh(hangingFrame(body));
    const worn = gownMesh(body);
    expect(hanging.body.length).toBe(worn.body.length);
    expect(lerpMesh(hanging, worn, 1).body[0]?.p[0]).toEqual(worn.body[0]?.p[0]);
    expect(lerpMesh(hanging, worn, 0).body[0]?.p[0]).toEqual(hanging.body[0]?.p[0]);
  });
});

describe('GameSession', () => {
  it('step 1: hands to the face put the mask on; warnings stay off until step 2', () => {
    const s = new GameSession(steps);
    let view = feed(s, pose(), 0, 300, new Set<Violation>(['cuello']));
    expect(view.scene.mask).toBe('floating');
    expect(view.warningsOn).toBe(false);
    view = feed(s, pose(HANDS_AT_FACE), 400, 700, new Set<Violation>(['cuello']));
    expect(view.scene.mask).toBe('snapping');
    view = feed(s, pose(HANDS_AT_FACE), 1150, 600);
    expect(view.scene.mask).toBe('worn');
    expect(view.completedIds).toEqual(['g1-mascarilla']);
    expect(view.warningsOn).toBe(true);
  });

  it('step 3: wrists into both sleeves, arms forward, then the gown animates onto the body', () => {
    const s = new GameSession(steps, true);
    feed(s, pose(HANDS_AT_FACE), 0, 700); // mask (reduced motion: instant)
    feed(s, pose(), 800, 1600); // hands in front of the chest
    const body = bodyFrame(pose(), SIZE);
    if (!body) throw new Error('no body');
    const [left, right] = sleeveOpenings(hangingFrame(body));
    let view = feed(s, pose(), 2500, 100);
    expect(view.scene.gown).toBe('hanging');
    const inSleeves = pose({
      15: [left.x / 1000, left.y / 1000, -0.3],
      16: [right.x / 1000, right.y / 1000, -0.3],
    });
    view = feed(s, inSleeves, 2700, 100);
    expect(view.scene.sleeves).toEqual([true, true]);
    const armsForward = pose({
      13: [0.6, 0.33, -0.3],
      14: [0.4, 0.33, -0.3],
      15: [0.58, 0.3, -0.6],
      16: [0.42, 0.3, -0.6],
    });
    view = feed(s, armsForward, 2900, 700 + DON_MS);
    expect(view.scene.gown).toBe('worn');
    expect(view.completedIds).toEqual(['g1-mascarilla', 'g2-manos', 'g3-bata']);
  });

  it('a warning from step 2 on resets the hold', () => {
    const s = new GameSession(steps, true);
    feed(s, pose(HANDS_AT_FACE), 0, 700);
    feed(s, pose(), 800, 1000);
    const view = feed(s, pose(), 1900, 100, new Set<Violation>(['bajo-cintura']));
    expect(view.hold).toBe(0);
    expect(view.hint).toBe('Corrige el aviso para seguir');
  });
});
