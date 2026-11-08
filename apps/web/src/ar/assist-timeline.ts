export const HINT_MS = 8000;
export const PREVIEW_MS = 15000;
export const SKIP_MS = 25000;

export interface AssistState {
  level: 0 | 1 | 2 | 3;
  elapsedMs: number;
  announceHint: boolean;
}

export class AssistTimeline {
  private stepIndex: number | null = null;
  private lastNow = 0;
  private paused = false;
  private elapsedMs = 0;
  private announced = false;

  update(input: { stepIndex: number; now: number; hold: number; paused?: boolean }): AssistState {
    if (input.stepIndex !== this.stepIndex) {
      this.reset();
      this.stepIndex = input.stepIndex;
    } else if (!this.paused) {
      // The previous sample's state applies until this sample, including pause entry.
      this.elapsedMs += Math.max(0, input.now - this.lastNow);
    }
    this.lastNow = input.now;
    this.paused = input.paused ?? false;
    // Hold progress deliberately does not restart assistance.
    const level =
      this.elapsedMs >= SKIP_MS
        ? 3
        : this.elapsedMs >= PREVIEW_MS
          ? 2
          : this.elapsedMs >= HINT_MS
            ? 1
            : 0;
    const announceHint = level >= 1 && !this.announced;
    if (announceHint) this.announced = true;
    return { level, elapsedMs: this.elapsedMs, announceHint };
  }

  reset(): void {
    this.stepIndex = null;
    this.lastNow = 0;
    this.paused = false;
    this.elapsedMs = 0;
    this.announced = false;
  }
}
