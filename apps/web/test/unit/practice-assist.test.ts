import { describe, expect, it } from 'vitest';
import type { AssistColors } from '../../src/ar/assist-overlay.ts';
import { type GameView, INITIAL_SCENE } from '../../src/ar/game-steps.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import { jointStatus } from '../../src/ar/pose-targets.ts';
import { bodyFrame } from '../../src/ar/posture.ts';
import { PracticeAssist, visibleJoints } from '../../src/ar/practice-assist.ts';

const SIZE = { width: 1000, height: 1000 };
const BASE: Record<number, [number, number, number?]> = {
  0: [0.5, 0.17],
  11: [0.6, 0.3],
  12: [0.4, 0.3],
  13: [0.64, 0.45],
  14: [0.36, 0.45],
  15: [0.56, 0.42, -0.1],
  16: [0.44, 0.42, -0.1],
  23: [0.58, 0.6],
  24: [0.42, 0.6],
};
function pose(over: typeof BASE = {}): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  for (const [i, [x, y, z]] of Object.entries({ ...BASE, ...over })) {
    out[Number(i)] = { x, y, z: z ?? 0, visibility: 0.95 };
  }
  return out;
}
const COLORS: AssistColors = {
  ghost: 'g',
  ok: 'o',
  near: 'n',
  far: 'f',
  ring: 'r',
  track: 't',
  outline: 'l',
};
function view(stepIndex: number, hold = 0): GameView {
  return {
    stepIndex,
    hold,
    hint: '',
    completedIds: [],
    done: false,
    scene: INITIAL_SCENE,
    warningsOn: true,
    exempt: [],
  };
}
// Hands down by the hips: far from every target above the waist.
const HANDS_LOW = pose({ 15: [0.6, 0.62, 0], 16: [0.4, 0.62, 0] });

describe('visibleJoints', () => {
  it('solo muñecas, salvo en mangas y despliegue', () => {
    const body = bodyFrame(HANDS_LOW, SIZE);
    if (!body) throw new Error('sin cuerpo');
    expect(visibleJoints('band', jointStatus(body, 'band')).map((s) => s.joint)).toEqual([
      'leftWrist',
      'rightWrist',
    ]);
    expect(visibleJoints('sleeves', jointStatus(body, 'sleeves'))).toHaveLength(4);
  });
});

describe('PracticeAssist', () => {
  it('a los 8 s da una pista con la articulación y la anuncia una vez', () => {
    const assist = new PracticeAssist(['band'], COLORS);
    const body = bodyFrame(HANDS_LOW, SIZE);
    expect(assist.frame(null, body, view(0), 0, false).level).toBe(0);
    const at8 = assist.frame(null, body, view(0), 8000, false);
    expect(at8.level).toBe(1);
    expect(at8.hint).toMatch(/muñeca/);
    expect(at8.announce).toBe(true);
    expect(assist.frame(null, body, view(0), 8100, false).announce).toBe(false);
    expect(assist.frame(null, body, view(0), 15_000, false).level).toBe(2);
    expect(assist.frame(null, body, view(0), 25_000, false).level).toBe(3);
  });

  it('sin cuerpo el reloj se detiene', () => {
    const assist = new PracticeAssist(['band'], COLORS);
    assist.frame(null, bodyFrame(HANDS_LOW, SIZE), view(0), 0, false);
    assist.frame(null, null, view(0), 1, false);
    expect(assist.frame(null, bodyFrame(HANDS_LOW, SIZE), view(0), 20_000, false).level).toBe(0);
  });

  it('el giro no tiene pose objetivo ni pista de articulación', () => {
    const assist = new PracticeAssist(['turn'], COLORS);
    const body = bodyFrame(HANDS_LOW, SIZE);
    assist.frame(null, body, view(0), 0, false);
    const at9 = assist.frame(null, body, view(0), 9000, false);
    expect(at9.level).toBe(1);
    expect(at9.hint).toBeNull();
  });

  it('si a los 8 s está sosteniendo, la pista se anuncia cuando vuelve a fallar', () => {
    const assist = new PracticeAssist(['band'], COLORS);
    const body = bodyFrame(HANDS_LOW, SIZE);
    assist.frame(null, body, view(0), 0, false);
    const holding = assist.frame(null, body, view(0, 0.5), 8000, false);
    expect(holding.announce).toBe(false);
    const failing = assist.frame(null, body, view(0), 8200, false);
    expect(failing.hint).not.toBeNull();
    expect(failing.announce).toBe(true);
  });
});
