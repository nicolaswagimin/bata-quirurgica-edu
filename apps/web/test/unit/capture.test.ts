import { BODY_POINT_COUNT, CaptureTakeSchema } from '@bata/shared/perception';
import { describe, expect, it } from 'vitest';
import type { Landmark } from '../../src/ar/overlay-math.ts';
import {
  CAPTURE_SAMPLE_MS,
  CaptureRecorder,
  captureFrame,
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

const SIZE = { width: 1000, height: 1000 };

function pose(wristX = 0.6): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  const set = (i: number, x: number, y: number) => {
    out[i] = { x, y, z: -0.1, visibility: 0.95 };
  };
  set(0, 0.5, 0.17);
  set(11, 0.6, 0.3);
  set(12, 0.4, 0.3);
  set(13, 0.64, 0.45);
  set(14, 0.36, 0.45);
  set(15, wristX, 0.42);
  set(16, 0.4, 0.42);
  set(23, 0.58, 0.6);
  set(24, 0.42, 0.6);
  return out;
}

function hide(landmarks: Landmark[], indices: number[]): Landmark[] {
  return landmarks.map((landmark, i) =>
    indices.includes(i) ? { ...landmark, visibility: 0 } : landmark,
  );
}

describe('captureFrame', () => {
  it('guarda el primer frame y mide la velocidad contra el último guardado', () => {
    const recorder = new CaptureRecorder();
    recorder.start('g3-bata', 0);
    const first = captureFrame({
      recorder,
      landmarks: pose(0.6),
      size: SIZE,
      now: 0,
      previous: null,
    });
    expect(first?.frame.t).toBe(0);
    expect(recorder.frameCount).toBe(1);

    // 33 ms después no toca muestrear: la referencia no cambia.
    const skipped = captureFrame({
      recorder,
      landmarks: pose(0.62),
      size: SIZE,
      now: 33,
      previous: first,
    });
    expect(skipped).toBe(first);
    expect(recorder.frameCount).toBe(1);

    const second = captureFrame({
      recorder,
      landmarks: pose(0.65),
      size: SIZE,
      now: 70,
      previous: skipped,
    });
    expect(second).not.toBe(first);
    expect(recorder.frameCount).toBe(2);
    expect(second?.frame.t).toBe(70);
    expect(second?.frame.velocities[5]?.x).not.toBe(0);
  });

  it('devuelve null cuando no se graba o no hay torso', () => {
    const recorder = new CaptureRecorder();
    expect(
      captureFrame({ recorder, landmarks: pose(), size: SIZE, now: 0, previous: null }),
    ).toBeNull();

    recorder.start('g3-bata', 0);
    expect(
      captureFrame({
        recorder,
        landmarks: hide(pose(), [23]),
        size: SIZE,
        now: 0,
        previous: null,
      }),
    ).toBeNull();
  });
});
