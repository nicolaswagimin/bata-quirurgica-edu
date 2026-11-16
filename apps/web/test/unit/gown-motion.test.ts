import { describe, expect, it } from 'vitest';
import { GownSprings, isGownMotionEnabled, NEUTRAL_GOWN_MOTION } from '../../src/ar/gown-motion.ts';
import type { BodyFrame } from '../../src/ar/posture.ts';

/** The springs only read the torso centre and the shoulder width. */
function frame(x: number, y = 0): BodyFrame {
  return {
    shoulderMid: { x, y: y - 150 },
    hipMid: { x, y: y + 150 },
    shoulderWidth: 200,
  } as BodyFrame;
}

describe('isGownMotionEnabled', () => {
  it('solo se activa con ?bata=vivo', () => {
    expect(isGownMotionEnabled('?bata=vivo')).toBe(true);
    expect(isGownMotionEnabled('?bata=3d')).toBe(false);
    expect(isGownMotionEnabled('')).toBe(false);
  });
});

describe('GownSprings', () => {
  it('no mueve nada con prefers-reduced-motion', () => {
    const springs = new GownSprings();
    expect(springs.update(frame(0), 16, true)).toEqual(NEUTRAL_GOWN_MOTION);
  });

  it('se queda quieta con un cuerpo quieto', () => {
    const springs = new GownSprings();
    let motion = springs.update(frame(0), 16, false);
    for (let i = 0; i < 20; i++) motion = springs.update(frame(0), 16, false);
    expect(motion.hem.x).toBeCloseTo(0, 5);
    expect(motion.sleeveLeft.x).toBeCloseTo(0, 5);
  });

  it('atrasa el ruedo en contra de la aceleración', () => {
    const springs = new GownSprings();
    springs.update(frame(0), 16, false);
    let motion = springs.update(frame(30), 16, false);
    for (const x of [60, 90, 120, 150]) motion = springs.update(frame(x), 16, false);
    expect(motion.hem.x).toBeLessThan(0);
    expect(Math.abs(motion.hem.x)).toBeLessThanOrEqual(0.22);
  });

  it('acota el desplazamiento ante un salto enorme', () => {
    const springs = new GownSprings();
    springs.update(frame(0), 16, false);
    let motion = springs.update(frame(0), 16, false);
    for (let i = 0; i < 60; i++) motion = springs.update(frame(5000), 16, false);
    expect(Number.isFinite(motion.hem.x)).toBe(true);
    expect(Math.abs(motion.hem.x)).toBeLessThanOrEqual(0.22);
    expect(Math.abs(motion.sleeveLeft.x)).toBeLessThanOrEqual(0.22);
  });

  it('acota el dt para que una pausa no explote', () => {
    const springs = new GownSprings();
    springs.update(frame(0), 16, false);
    const motion = springs.update(frame(400), 5000, false);
    expect(Number.isFinite(motion.hem.x)).toBe(true);
    expect(Number.isFinite(motion.hem.y)).toBe(true);
  });

  it('reset vuelve al centro', () => {
    const springs = new GownSprings();
    springs.update(frame(0), 16, false);
    for (const x of [40, 80, 120]) springs.update(frame(x), 16, false);
    springs.reset();
    expect(springs.update(frame(120), 16, false)).toEqual(NEUTRAL_GOWN_MOTION);
  });
});
