import { describe, expect, it } from 'vitest';
import { fullBodyInFrame, GameFlow } from '../../src/ar/game-flow.ts';
import { DwellTracker, videoToStage } from '../../src/ar/hover-targets.ts';
import type { Landmark } from '../../src/ar/overlay-math.ts';

function body(visible = true): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  for (const [i, y] of [
    [11, 0.25],
    [12, 0.25],
    [23, 0.5],
    [24, 0.5],
    [25, 0.7],
    [26, 0.7],
    [27, 0.9],
    [28, 0.9],
  ] as const) {
    out[i] = { x: 0.5, y, visibility: visible ? 0.9 : 0.2 };
  }
  return out;
}

describe('videoToStage', () => {
  it('mirrors x and applies object-fit: cover', () => {
    // 640×480 video in a 390×844 portrait stage: scaled by 844/480, cropped left and right.
    const p = videoToStage(
      { x: 0.25, y: 0.5 },
      { width: 640, height: 480 },
      { width: 390, height: 844 },
    );
    const scale = 844 / 480;
    const offsetX = (390 - 640 * scale) / 2;
    expect(p.y).toBeCloseTo(422);
    expect(p.x).toBeCloseTo(390 - (offsetX + 0.25 * 640 * scale));
  });
});

describe('DwellTracker', () => {
  const target = { id: 'jugar', rect: { left: 100, top: 100, width: 100, height: 100 } };
  const onIt = [{ x: 150, y: 150 }];

  it('activates after a full second over the button, once', () => {
    const t = new DwellTracker(1000, 250, 900);
    expect(t.update(onIt, [target], 0).progress.get('jugar')).toBe(0);
    expect(t.update(onIt, [target], 500).progress.get('jugar')).toBeCloseTo(0.5);
    expect(t.update(onIt, [target], 1000).activated).toBe('jugar');
    expect(t.update(onIt, [target], 1100).activated).toBeNull(); // cooldown
  });

  it('tolerates a brief loss of the hand but resets when it leaves for good', () => {
    const t = new DwellTracker(1000, 250, 900);
    t.update(onIt, [target], 0);
    t.update([], [target], 200); // hand lost for 200 ms: keeps progress
    expect(t.update(onIt, [target], 600).progress.get('jugar')).toBeCloseTo(0.6);
    t.update([], [target], 700);
    expect(t.update([], [target], 1000).progress.has('jugar')).toBe(false);
  });

  it('keeps a hovered button with a trembling hand just outside its edge', () => {
    const t = new DwellTracker();
    t.update(onIt, [target], 0);
    expect(t.update([{ x: 205, y: 150 }], [target], 300).progress.get('jugar')).toBeCloseTo(0.3);
  });
});

describe('GameFlow', () => {
  it('needs the whole body in frame', () => {
    expect(fullBodyInFrame(body())).toBe(true);
    expect(fullBodyInFrame(body(false))).toBe(false);
  });

  it('frames, counts down 3-2-1 and starts; leaving the frame cancels the countdown', () => {
    const f = new GameFlow();
    f.start();
    expect(f.update(body(false), 0).phase).toBe('framing');
    f.update(body(), 100);
    expect(f.update(body(), 800).phase).toBe('countdown');
    expect(f.update(body(), 900).secondsLeft).toBe(3);
    f.update(body(false), 1500);
    expect(f.update(body(false), 2600).phase).toBe('framing');
    f.update(body(), 3000);
    f.update(body(), 3700);
    expect(f.update(body(), 6800).phase).toBe('playing');
  });
});
