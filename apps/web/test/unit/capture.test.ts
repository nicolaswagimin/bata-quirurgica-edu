import { BODY_POINT_COUNT, CaptureTakeSchema } from '@bata/shared/perception';
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_SAMPLE_MS,
  CaptureRecorder,
  isCaptureEnabled,
  MIN_TAKE_FRAMES,
} from '../../src/ar/perception/capture.ts';

function frame(t: number) {
  return {
    t,
    points: Array.from({ length: BODY_POINT_COUNT }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0.9,
    })),
    velocities: Array.from({ length: BODY_POINT_COUNT }, () => ({ x: 0, y: 0 })),
    angles: { leftElbow: 3, rightElbow: 3, leftShoulder: 1.5, rightShoulder: 1.5, torsoTilt: 0 },
    torso: { centerX: 500, centerY: 400, shoulderWidth: 200, torsoHeight: 180, angleRad: 0 },
    hands: [],
  };
}

/** Llena una toma con `count` frames válidos muestreados a 66 ms desde `startAt`. */
function fill(recorder: CaptureRecorder, count: number, startAt = 0): void {
  for (let i = 0; i < count; i++) {
    recorder.push(frame(i * CAPTURE_SAMPLE_MS), startAt + i * CAPTURE_SAMPLE_MS);
  }
}

describe('isCaptureEnabled', () => {
  it('solo se activa en desarrollo y con ?captura=1', () => {
    expect(isCaptureEnabled({ dev: true, search: '?captura=1' })).toBe(true);
    expect(isCaptureEnabled({ dev: false, search: '?captura=1' })).toBe(false);
    expect(isCaptureEnabled({ dev: true, search: '?captura=0' })).toBe(false);
    expect(isCaptureEnabled({ dev: true, search: '' })).toBe(false);
  });
});

describe('CaptureRecorder', () => {
  it('muestrea a 15 Hz y descarta los frames demasiado seguidos', () => {
    const recorder = new CaptureRecorder();
    recorder.start('g3-bata', 0);
    expect(recorder.push(frame(0), 0)).toBe(true);
    expect(recorder.push(frame(1), 30)).toBe(false);
    expect(recorder.push(frame(2), CAPTURE_SAMPLE_MS)).toBe(true);
    expect(recorder.push(frame(3), CAPTURE_SAMPLE_MS * 2)).toBe(true);
    expect(recorder.frameCount).toBe(3);
  });

  it('no graba sin etiqueta y exige una no vacía', () => {
    const recorder = new CaptureRecorder();
    expect(recorder.isRecording()).toBe(false);
    expect(recorder.push(frame(0), 0)).toBe(false);
    expect(() => recorder.start('  ', 0)).toThrow();
  });

  it('devuelve una toma válida al cerrar', () => {
    const recorder = new CaptureRecorder();
    recorder.start('g5-guantes', 1000);
    fill(recorder, MIN_TAKE_FRAMES, 1000);
    const take = recorder.stop(1000 + CAPTURE_SAMPLE_MS * (MIN_TAKE_FRAMES - 1));
    expect(take).not.toBeNull();
    const parsed = CaptureTakeSchema.parse(take);
    expect(parsed.label).toBe('g5-guantes');
    expect(parsed.sampleHz).toBe(Math.round(1000 / CAPTURE_SAMPLE_MS));
    expect(parsed.frames).toHaveLength(MIN_TAKE_FRAMES);
    expect(parsed.durationMs).toBeGreaterThan(0);
    expect(recorder.isRecording()).toBe(false);
  });

  it('descarta una toma demasiado corta y limpia el estado', () => {
    const recorder = new CaptureRecorder();
    recorder.start('g1-mascarilla', 0);
    fill(recorder, MIN_TAKE_FRAMES - 1);
    expect(recorder.stop(500)).toBeNull();
    expect(recorder.frameCount).toBe(0);
    expect(recorder.isRecording()).toBe(false);
  });

  it('no crece sin límite', () => {
    const recorder = new CaptureRecorder();
    recorder.start('g6-solapa', 0);
    for (let i = 0; i < 200; i++) recorder.push(frame(i), i * CAPTURE_SAMPLE_MS);
    expect(recorder.frameCount).toBeLessThanOrEqual(90);
  });

  it('clear borra la toma en curso', () => {
    const recorder = new CaptureRecorder();
    recorder.start('g2-manos', 0);
    fill(recorder, 10);
    recorder.clear();
    expect(recorder.frameCount).toBe(0);
    expect(recorder.isRecording()).toBe(false);
    expect(recorder.elapsed(100)).toBe(0);
  });
});
