// Phases of the AR mirror game before and around play. Pure state machine, unit-tested.
//   ready     → the phone is near the user: one tap starts (unlocks camera audio and voice)
//   framing   → "Aléjate hasta que se vea tu cuerpo" until the whole body is in frame
//   countdown → 3, 2, 1 while the body stays in frame (leaving for > 1 s goes back to framing)
//   playing   → the guided steps run
//   done      → results
import type { Landmark } from './overlay-math.ts';

export type GamePhase = 'ready' | 'framing' | 'countdown' | 'playing' | 'done';

// Shoulders, hips, knees and ankles: the gown reaches mid-calf, so the legs must be in frame.
const BODY = [11, 12, 23, 24, 25, 26, 27, 28] as const;

/** Every key joint visible and away from the frame edges (with a small margin). */
export function fullBodyInFrame(landmarks: readonly Landmark[]): boolean {
  return BODY.every((i) => {
    const lm = landmarks[i];
    return (
      !!lm &&
      (lm.visibility ?? 0) >= 0.5 &&
      lm.x > 0.02 &&
      lm.x < 0.98 &&
      lm.y > 0.02 &&
      lm.y < 0.98
    );
  });
}

export const COUNTDOWN_MS = 3000;
const SETTLE_MS = 600; // body must stay in frame this long before the countdown starts
const LOST_MS = 1000; // leaving the frame for longer than this cancels the countdown

export interface FlowView {
  phase: GamePhase;
  /** Whole seconds left during the countdown (3, 2, 1). */
  secondsLeft: number;
}

export class GameFlow {
  phase: GamePhase = 'ready';
  private inFrameSince: number | null = null;
  private outSince: number | null = null;
  private countdownStart = 0;

  /** `ready` decides when the body is framed; v2 passes the stricter framing advice. */
  constructor(
    private readonly ready: (landmarks: readonly Landmark[]) => boolean = fullBodyInFrame,
  ) {}

  start(): void {
    this.phase = 'framing';
    this.inFrameSince = null;
    this.outSince = null;
  }

  finish(): void {
    this.phase = 'done';
  }

  reset(): void {
    this.phase = 'ready';
  }

  update(landmarks: readonly Landmark[], now: number): FlowView {
    const inFrame = this.ready(landmarks);
    if (this.phase === 'framing') {
      if (inFrame) {
        this.inFrameSince ??= now;
        if (now - this.inFrameSince >= SETTLE_MS) {
          this.phase = 'countdown';
          this.countdownStart = now;
          this.outSince = null;
        }
      } else {
        this.inFrameSince = null;
      }
    } else if (this.phase === 'countdown') {
      if (!inFrame) {
        this.outSince ??= now;
        if (now - this.outSince > LOST_MS) {
          this.phase = 'framing';
          this.inFrameSince = null;
        }
      } else {
        this.outSince = null;
      }
      if (this.phase === 'countdown' && now - this.countdownStart >= COUNTDOWN_MS) {
        this.phase = 'playing';
      }
    }
    const left =
      this.phase === 'countdown'
        ? Math.ceil((COUNTDOWN_MS - (now - this.countdownStart)) / 1000)
        : 0;
    return { phase: this.phase, secondsLeft: Math.max(0, left) };
  }
}
