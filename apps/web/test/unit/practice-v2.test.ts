import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ArPracticeFileSchema, type ArPracticeStep, type PracticeKind } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import { hangingFrame, sleeveOpenings } from '../../src/ar/hanging-gown.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import { bodyFrame, type Violation } from '../../src/ar/posture.ts';
import {
  handsAtNeck,
  handsUnfolding,
  isPracticeV2Enabled,
  PracticeSessionV2,
} from '../../src/ar/practice-session-v2.ts';

const SIZE = { width: 1000, height: 1000 };
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
  const out: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  for (const [i, [x, y, z]] of Object.entries({ ...BASE, ...over })) {
    out[Number(i)] = { x, y, z: z ?? 0, visibility: 0.95 };
  }
  return out;
}

const HANDS_AT_FACE: Record<number, Pt> = { 15: [0.53, 0.2, -0.2], 16: [0.47, 0.2, -0.2] };
const HANDS_AT_NECK: Record<number, Pt> = { 15: [0.55, 0.25, -0.2], 16: [0.45, 0.25, -0.2] };
const HANDS_TOGETHER: Record<number, Pt> = { 15: [0.52, 0.42, -0.1], 16: [0.48, 0.42, -0.1] };

function feed(
  session: PracticeSessionV2,
  landmarks: Landmark[],
  from: number,
  ms: number,
  violations = new Set<Violation>(),
) {
  let view = session.update({
    body: bodyFrame(landmarks, SIZE),
    landmarks,
    size: SIZE,
    violations,
    now: from,
  });
  for (let t = from + 50; t <= from + ms; t += 50) {
    view = session.update({
      body: bodyFrame(landmarks, SIZE),
      landmarks,
      size: SIZE,
      violations,
      now: t,
    });
  }
  return view;
}

function stepOf(kind: PracticeKind, holdMs = 400): ArPracticeStep {
  return {
    id: `s-${kind}`,
    order: 1,
    kind,
    donningIds: [],
    title: kind,
    goal: 'g',
    action: 'a',
    look: 'l',
    holdMs,
    commonError: 'e',
    correction: 'c',
    debrief: 'd',
    voice: 'v',
    source: { org: 'OMS', title: 't', year: 2009, section: 's' },
  };
}

function sessionFor(kind: PracticeKind): PracticeSessionV2 {
  return new PracticeSessionV2([stepOf(kind)], true);
}

const spec = ArPracticeFileSchema.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../content/protocolos/ar-practica-v2.json'),
      'utf8',
    ),
  ),
);

describe('isPracticeV2Enabled', () => {
  it('solo se activa con ?practica=v2', () => {
    expect(isPracticeV2Enabled('?practica=v2')).toBe(true);
    expect(isPracticeV2Enabled('?practica=v1')).toBe(false);
    expect(isPracticeV2Enabled('')).toBe(false);
  });
});

describe('la especificación validada', () => {
  it('tiene 8 pasos en el orden aprobado', () => {
    expect(spec.steps.map((step) => step.kind)).toEqual([
      'mask',
      'friction',
      'band',
      'neck',
      'sleeves',
      'still',
      'gloves',
      'turn',
    ]);
    expect(spec.validatedAt).toBe('2026-11-07');
    expect(spec.decisions.every((decision) => decision.chosen)).toBe(true);
  });
});

describe('handsAtNeck', () => {
  it('acepta las manos en el cuello y rechaza las manos en la cintura', () => {
    const neck = bodyFrame(pose(HANDS_AT_NECK), SIZE);
    if (!neck) throw new Error('sin cuerpo');
    expect(handsAtNeck(neck)).toBe(true);
    const waist = bodyFrame(pose(), SIZE);
    if (!waist) throw new Error('sin cuerpo');
    expect(handsAtNeck(waist)).toBe(false);
  });
});

describe('PracticeSessionV2', () => {
  it('mascarilla', () => {
    const session = sessionFor('mask');
    expect(feed(session, pose(HANDS_AT_FACE), 0, 700).done).toBe(true);
  });

  it('banda estéril', () => {
    const session = sessionFor('band');
    expect(feed(session, pose(), 0, 700).done).toBe(true);
  });

  it('manos al cuello', () => {
    const session = sessionFor('neck');
    expect(feed(session, pose(HANDS_AT_NECK), 0, 700).done).toBe(true);
  });

  it('brazos en las mangas', () => {
    const session = sessionFor('sleeves');
    const body = bodyFrame(pose(), SIZE);
    if (!body) throw new Error('sin cuerpo');
    const [left, right] = sleeveOpenings(hangingFrame(body));
    const inSleeves = pose({
      15: [left.x / SIZE.width, left.y / SIZE.height, -0.3],
      16: [right.x / SIZE.width, right.y / SIZE.height, -0.3],
    });
    feed(session, inSleeves, 0, 100);
    const armsForward = pose({
      13: [0.6, 0.33, -0.3],
      14: [0.4, 0.33, -0.3],
      15: [0.58, 0.3, -0.6],
      16: [0.42, 0.3, -0.6],
    });
    expect(feed(session, armsForward, 200, 1200).done).toBe(true);
  });

  it('quietud', () => {
    const session = sessionFor('still');
    expect(feed(session, pose(), 0, 900).done).toBe(true);
  });

  it('guantes juntos', () => {
    const session = sessionFor('gloves');
    expect(feed(session, pose(HANDS_TOGETHER), 0, 700).done).toBe(true);
  });

  it('giro y regreso', () => {
    const session = sessionFor('turn');
    feed(session, pose(), 0, 100);
    const turned = pose({
      11: [0.52, 0.29],
      12: [0.48, 0.29],
      23: [0.517, 0.55],
      24: [0.483, 0.55],
      13: [0.53, 0.41],
      14: [0.47, 0.41],
      15: [0.51, 0.43, -0.2],
      16: [0.49, 0.43, -0.2],
    });
    // El perfil debe sostenerse un poco (DWELL_MS) para que un frame con ruido no cuente.
    feed(session, turned, 200, 400);
    expect(feed(session, pose(), 700, 1500).done).toBe(true);
  });

  it('la fricción exige movimiento', () => {
    const moving = sessionFor('friction');
    let view = moving.update({
      body: bodyFrame(pose({ 15: [0.56, 0.42, -0.1] }), SIZE),
      landmarks: pose({ 15: [0.56, 0.42, -0.1] }),
      size: SIZE,
      violations: new Set<Violation>(),
      now: 0,
    });
    for (let t = 50; t <= 1200 && !view.done; t += 50) {
      const dx = (t / 50) % 2 === 0 ? 0.56 : 0.5;
      const landmarks = pose({ 15: [dx, 0.42, -0.1] });
      view = moving.update({
        body: bodyFrame(landmarks, SIZE),
        landmarks,
        size: SIZE,
        violations: new Set<Violation>(),
        now: t,
      });
    }
    expect(view.done).toBe(true);

    const still = sessionFor('friction');
    expect(feed(still, pose(), 0, 700).done).toBe(false);
  });
});

describe('práctica v3: despliegue y giro configurable', () => {
  const UNFOLD: Record<number, Pt> = { 15: [0.62, 0.3, -0.3], 16: [0.38, 0.3, -0.3] };
  const TURNED: Record<number, Pt> = {
    11: [0.52, 0.29],
    12: [0.48, 0.29],
    23: [0.517, 0.55],
    24: [0.483, 0.55],
    13: [0.53, 0.41],
    14: [0.47, 0.41],
    15: [0.51, 0.43, -0.2],
    16: [0.49, 0.43, -0.2],
  };

  it('handsUnfolding: manos separadas a la altura de los hombros', () => {
    expect(
      handsUnfolding(bodyFrame(pose(UNFOLD), SIZE) as NonNullable<ReturnType<typeof bodyFrame>>),
    ).toBe(true);
    expect(
      handsUnfolding(bodyFrame(pose(), SIZE) as NonNullable<ReturnType<typeof bodyFrame>>),
    ).toBe(false);
  });

  it('el despliegue se completa con las manos arriba y quietas', () => {
    expect(feed(sessionFor('unfold'), pose(UNFOLD), 0, 700).done).toBe(true);
  });

  it('el despliegue no avanza si la bata se sacude', () => {
    const session = sessionFor('unfold');
    const shake: Record<number, Pt> = { 15: [0.7, 0.3, -0.3], 16: [0.3, 0.3, -0.3] };
    let view = feed(session, pose(UNFOLD), 0, 0);
    for (let t = 50; t <= 1500; t += 50) {
      const lm = pose((t / 50) % 2 ? shake : UNFOLD);
      view = session.update({
        body: bodyFrame(lm, SIZE),
        landmarks: lm,
        size: SIZE,
        violations: new Set(),
        now: t,
      });
    }
    expect(view.done).toBe(false);
  });

  it('handsUnfolding rechaza manos apiladas o abiertas a los lados del cuerpo', () => {
    const frame = (over: Record<number, Pt>) =>
      bodyFrame(pose(over), SIZE) as NonNullable<ReturnType<typeof bodyFrame>>;
    expect(handsUnfolding(frame({ 15: [0.52, 0.25, -0.3], 16: [0.5, 0.36, -0.3] }))).toBe(false);
    expect(handsUnfolding(frame({ 15: [0.7, 0.3, 0], 16: [0.3, 0.3, 0] }))).toBe(false);
  });

  it('con giro de 360° hace falta pasar por la espalda', () => {
    const back = pose();
    for (const i of [0, 2, 5, 7, 8, 9, 10]) back[i] = { ...back[i], visibility: 0.1 } as Landmark;
    const session = new PracticeSessionV2([stepOf('turn')], true, { turn: '360' });
    feed(session, pose(), 0, 100);
    feed(session, pose(TURNED), 200, 400);
    // De vuelta al frente sin pasar por la espalda: no cuenta.
    expect(feed(session, pose(), 700, 1500).done).toBe(false);
    feed(session, pose(TURNED), 2300, 400);
    feed(session, back, 2800, 400);
    feed(session, pose(TURNED), 3300, 400);
    expect(feed(session, pose(), 3800, 1500).done).toBe(true);
  });
});

describe('saltar paso', () => {
  it('avanza sin completar el paso y lo registra como saltado', () => {
    const session = new PracticeSessionV2([stepOf('neck'), stepOf('band')], true);
    feed(session, pose(), 0, 100);
    session.skip(200);
    const view = feed(session, pose(), 250, 0);
    expect(view.stepIndex).toBe(1);
    expect(view.completedIds).toEqual([]);
    expect(view.skippedIds).toEqual(['s-neck']);
    // La bata queda colgada para que el paso de mangas siga teniendo sentido.
    expect(view.scene.gown).toBe('hanging');
  });

  it('saltar el último paso termina la práctica', () => {
    const session = new PracticeSessionV2([stepOf('turn')], true);
    session.skip(0);
    const view = feed(session, pose(), 50, 0);
    expect(view.done).toBe(true);
    expect(view.skippedIds).toEqual(['s-turn']);
  });

  it('ignora un salto pedido para un paso que ya terminó', () => {
    const session = new PracticeSessionV2([stepOf('neck'), stepOf('band')], true);
    session.skip(0, 's-band');
    const view = feed(session, pose(), 50, 0);
    expect(view.stepIndex).toBe(0);
    expect(view.skippedIds).toEqual([]);
  });
});
