import { describe, expect, it } from 'vitest';
import { framingAdvice } from '../../src/ar/framing-advice.ts';
import { fullBodyInFrame } from '../../src/ar/game-flow.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';

function pose(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: index % 2 ? 0.55 : 0.45,
    y: index === 0 ? 0.1 : index >= 27 ? 0.9 : index >= 25 ? 0.75 : index >= 23 ? 0.6 : 0.3,
    visibility: 0.9,
    ...overrides[index],
  }));
}

function shifted(x: number): Landmark[] {
  return pose().map((point) => ({ ...point, x }));
}

describe('framingAdvice', () => {
  it('requires a detected torso before giving other advice', () => {
    for (const landmarks of [null, [], pose({ 11: { visibility: 0.49 }, 0: { y: 0 } })]) {
      expect(framingAdvice(landmarks).issue).toBe('sin-cuerpo');
    }
  });

  it('prioritizes missing feet, then head, over size and lateral advice', () => {
    const landmarks = shifted(0.2);
    for (const index of [27, 28, 29, 30]) landmarks[index] = { x: 0.2, y: 1, visibility: 1 };
    landmarks[0] = { x: 0.2, y: 0, visibility: 1 };
    expect(framingAdvice(landmarks).issue).toBe('pies');
    expect(framingAdvice(pose({ 0: { y: 0.02 } })).issue).toBe('cabeza');
    expect(framingAdvice(pose({ 0: { visibility: 0.49 } })).issue).toBe('cabeza');
  });

  it('detects excessive and insufficient body height before lateral advice', () => {
    expect(framingAdvice(pose({ 0: { y: 0.03 }, 27: { y: 0.97 }, 28: { y: 0.97 } })).issue).toBe(
      'cerca',
    );
    const small = shifted(0.2);
    small[0] = { x: 0.2, y: 0.5, visibility: 1 };
    expect(framingAdvice(small).issue).toBe('lejos');
  });

  it('uses the own left/right directions in the mirrored selfie view', () => {
    expect(framingAdvice(shifted(0.2))).toMatchObject({
      issue: 'izquierda',
      message: expect.stringContaining('tu izquierda'),
    });
    expect(framingAdvice(shifted(0.8))).toMatchObject({
      issue: 'derecha',
      message: expect.stringContaining('tu derecha'),
    });
    expect(framingAdvice(shifted(0.3)).ok).toBe(true);
    expect(framingAdvice(shifted(0.7)).ok).toBe(true);
  });

  it('accepts the visibility threshold and gives the success message', () => {
    const landmarks = pose().map((point) => ({ ...point, visibility: 0.5 }));
    expect(framingAdvice(landmarks)).toEqual({
      ok: true,
      issue: null,
      message: 'Perfecto, quédate ahí',
    });
  });

  it('checks heels for feet but still requires the game joints before readiness', () => {
    expect(framingAdvice(pose({ 27: { visibility: 0 }, 28: { visibility: 0 } })).issue).toBe(
      'pies',
    );
    expect(framingAdvice(pose({ 25: { visibility: 0 } })).ok).toBe(false);
    expect(framingAdvice(pose({ 11: { x: 0.02 } })).issue).toBe('cerca');
    expect(framingAdvice(pose({ 27: { y: 0.98 }, 29: { visibility: 0 } })).issue).toBe('pies');
  });

  it('never reports ok unless fullBodyInFrame agrees for the same landmarks', () => {
    const samples = [pose(), shifted(0.3), shifted(0.7)];
    for (const index of [11, 12, 23, 24, 25, 26, 27, 28]) {
      for (const override of [{ visibility: 0.49 }, { x: 0.02 }, { y: 0.98 }]) {
        samples.push(pose({ [index]: override }));
      }
    }
    for (const landmarks of samples) {
      if (framingAdvice(landmarks).ok) expect(fullBodyInFrame(landmarks)).toBe(true);
      if (!fullBodyInFrame(landmarks)) expect(framingAdvice(landmarks).ok).toBe(false);
    }
  });
});
