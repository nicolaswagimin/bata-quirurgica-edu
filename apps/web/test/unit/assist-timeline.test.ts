import { describe, expect, it } from 'vitest';
import { AssistTimeline, HINT_MS, PREVIEW_MS, SKIP_MS } from '../../src/ar/assist-timeline.ts';

describe('AssistTimeline', () => {
  it('advances at exact thresholds without resetting for hold progress', () => {
    const timeline = new AssistTimeline();
    const update = (now: number, hold = 0) => timeline.update({ stepIndex: 0, now, hold });
    expect(update(100).elapsedMs).toBe(0);
    expect(update(100 + HINT_MS - 1).level).toBe(0);
    expect(update(100 + HINT_MS, 0.6)).toEqual({
      level: 1,
      elapsedMs: HINT_MS,
      announceHint: true,
    });
    expect(update(100 + PREVIEW_MS - 1).level).toBe(1);
    expect(update(100 + PREVIEW_MS)).toEqual({
      level: 2,
      elapsedMs: PREVIEW_MS,
      announceHint: false,
    });
    expect(update(100 + SKIP_MS - 1).level).toBe(2);
    expect(update(100 + SKIP_MS, 1)).toEqual({ level: 3, elapsedMs: SKIP_MS, announceHint: false });
  });

  it('excludes paused intervals including the interval ending at resume', () => {
    const timeline = new AssistTimeline();
    const update = (now: number, paused = false) =>
      timeline.update({ stepIndex: 0, now, hold: 0, paused });
    update(0, true);
    expect(update(10000, true).elapsedMs).toBe(0);
    expect(update(20000).elapsedMs).toBe(0);
    expect(update(24000, true).elapsedMs).toBe(4000);
    expect(update(30000, true).elapsedMs).toBe(4000);
    expect(update(40000).elapsedMs).toBe(4000);
    expect(update(44000).announceHint).toBe(true);
  });

  it('announces once even when updates jump straight to skip, and resets per step', () => {
    const timeline = new AssistTimeline();
    const update = (stepIndex: number, now: number) => timeline.update({ stepIndex, now, hold: 0 });
    update(0, 0);
    expect(update(0, SKIP_MS).announceHint).toBe(true);
    expect(update(0, SKIP_MS + 1).announceHint).toBe(false);
    expect(update(1, 30000)).toEqual({ level: 0, elapsedMs: 0, announceHint: false });
    expect(update(1, 38000).announceHint).toBe(true);
    timeline.reset();
    expect(update(1, 90000)).toEqual({ level: 0, elapsedMs: 0, announceHint: false });
    expect(update(1, 98000).announceHint).toBe(true);
  });
});
