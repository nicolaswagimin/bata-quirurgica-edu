import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ArPracticeFileSchema } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import { practiceConfig, resolvePractice } from '../../src/ar/practice-config.ts';
import { newTurnTracker, stepTurn } from '../../src/ar/practice-turn.ts';

const v3 = ArPracticeFileSchema.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../content/protocolos/ar-practica-v3.json'),
      'utf8',
    ),
  ),
);

describe('practiceConfig', () => {
  it('usa los valores propuestos del contenido sin parámetros', () => {
    expect(practiceConfig(v3, '?practica=v2')).toEqual({
      giro: 'cuarto',
      mascarilla: false,
      secado: true,
    });
  });

  it('la URL cambia los puntos abiertos e ignora valores desconocidos', () => {
    expect(practiceConfig(v3, '?giro=360&mascarilla=1&secado=0')).toEqual({
      giro: '360',
      mascarilla: true,
      secado: false,
    });
    expect(practiceConfig(v3, '?giro=180&mascarilla=talvez').giro).toBe('cuarto');
  });
});

describe('resolvePractice', () => {
  it('por defecto: 7 pasos, del secado a la tarjeta y el giro', () => {
    const { steps, turn, pending } = resolvePractice(v3, practiceConfig(v3, ''));
    expect(steps.map((step) => step.kind)).toEqual([
      'band',
      'neck',
      'unfold',
      'sleeves',
      'still',
      'gloves',
      'turn',
    ]);
    expect(steps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(turn).toBe('cuarto');
    expect(pending).toBe(true);
  });

  it('con mascarilla y sin secado cambia los pasos y el giro usa su texto', () => {
    const config = practiceConfig(v3, '?mascarilla=1&secado=0&giro=360');
    const { steps, turn } = resolvePractice(v3, config);
    expect(steps[0]?.kind).toBe('mask');
    expect(steps.some((step) => step.toggle === 'secado')).toBe(false);
    expect(turn).toBe('360');
    expect(steps.at(-1)?.voice).toBe(v3.turnText?.['360'].voice);
  });

  it('cada paso tiene instrucción, qué mirar, error frecuente y corrección', () => {
    for (const step of v3.steps) {
      expect(step.action.length).toBeLessThanOrEqual(120);
      expect(step.look && step.commonError && step.correction).toBeTruthy();
    }
  });
});

describe('stepTurn', () => {
  const FRONT = 1;
  const SIDE = 0.5;
  type Frame = [ratio: number, ms: number, face?: boolean];

  /** Feeds each phase as 50 ms frames for its duration; returns the last result. */
  function run(mode: 'cuarto' | '360', frames: Frame[], t = newTurnTracker()) {
    let now = 0;
    let last = false;
    for (const [ratio, ms, face = true] of frames) {
      const end = now + ms;
      for (; now < end; now += 50) {
        last = stepTurn(t, { ratio, faceVisible: face, frontal: true, now }, mode);
      }
    }
    return { last, t };
  }

  it('un cuarto de vuelta: perfil sostenido y de vuelta al frente', () => {
    expect(
      run('cuarto', [
        [FRONT, 100],
        [SIDE, 400],
        [FRONT, 400],
      ]).last,
    ).toBe(true);
  });

  it('un frame de perfil con ruido no cuenta', () => {
    expect(
      run('cuarto', [
        [FRONT, 100],
        [SIDE, 50],
        [FRONT, 400],
      ]).last,
    ).toBe(false);
    const flicker: Frame[] = Array.from({ length: 8 }, (_, i) => [i % 2 ? FRONT : 0.64, 50]);
    expect(run('360', [[FRONT, 100], ...flicker, [FRONT, 400]]).last).toBe(false);
  });

  it('360°: perfil, espalda sin cara, perfil y frente', () => {
    const full: Frame[] = [
      [FRONT, 100],
      [SIDE, 400],
      [FRONT, 400, false],
      [SIDE, 400],
      [FRONT, 400],
    ];
    expect(run('360', full).last).toBe(true);
  });

  it('360°: dos cuartos de vuelta con regreso al frente no bastan', () => {
    const twoQuarters: Frame[] = [
      [FRONT, 100],
      [SIDE, 400],
      [FRONT, 400],
      [SIDE, 400],
      [FRONT, 400],
    ];
    expect(run('360', twoQuarters).last).toBe(false);
  });

  it('solo vale mientras el cuerpo sigue de frente', () => {
    const { t } = run('cuarto', [
      [FRONT, 100],
      [SIDE, 400],
      [FRONT, 400],
    ]);
    expect(stepTurn(t, { ratio: 0.7, faceVisible: true, frontal: true, now: 5000 }, 'cuarto')).toBe(
      false,
    );
  });

  it('no toma la referencia sin una postura frontal válida', () => {
    const t = newTurnTracker();
    stepTurn(t, { ratio: FRONT, faceVisible: true, frontal: false, now: 0 }, 'cuarto');
    expect(t.baseline).toBeNull();
  });
});
