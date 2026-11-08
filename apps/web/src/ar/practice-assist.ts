// Phase 2 visual aids for the v2 practice, drawn on top of the AR canvas each frame: the target
// pose as a translucent ghost aligned to the player's shoulders and hips, the joints coloured by
// distance (green / amber / red) with arrows, a hold ring, and the progressive help timeline
// (8 s hint → 15 s 3D preview → 25 s skip). Pure geometry lives in pose-targets.ts,
// drawing in assist-overlay.ts and timing in assist-timeline.ts.
import type { PracticeKind } from '@bata/shared/schemas';
import { type AssistColors, drawGhost, drawHoldRing, drawJointStatus } from './assist-overlay.ts';
import { AssistTimeline } from './assist-timeline.ts';
import type { GameView } from './game-steps.ts';
import {
  ghostSkeleton,
  type JointStatus,
  jointHint,
  jointStatus,
  toImage,
} from './pose-targets.ts';
import type { BodyFrame } from './posture.ts';

export interface AssistView {
  level: 0 | 1 | 2 | 3;
  hint: string | null;
  /** True once per step, when the hint first appears: the caller speaks it. */
  announce: boolean;
}

const IDLE: AssistView = { level: 0, hint: null, announce: false };

/** Elbows only matter where the engine checks the arms; elsewhere they would distract. */
const ELBOW_KINDS: ReadonlySet<PracticeKind> = new Set(['sleeves', 'unfold']);

/** Joints worth showing for a step kind. */
export function visibleJoints(kind: PracticeKind, statuses: readonly JointStatus[]): JointStatus[] {
  return statuses.filter((s) => s.joint.endsWith('Wrist') || ELBOW_KINDS.has(kind));
}

/** Colours from the design tokens: success / xp (amber) / danger, ghost and outline on paper. */
export function readAssistColors(): AssistColors {
  const token = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return {
    ghost: token('bg'),
    ok: token('success'),
    near: token('xp'),
    far: token('danger'),
    ring: token('xp'),
    track: token('bg'),
    outline: token('bg'),
  };
}

export class PracticeAssist {
  private readonly timeline = new AssistTimeline();
  /** Step whose hint was already spoken: once per step, and only when there is a hint to say. */
  private announcedStep = -1;

  /** `speed` > 1 only in e2e builds (`?simularAyudaRapida=1`), to reach 25 s in a test. */
  constructor(
    private readonly kinds: readonly PracticeKind[],
    private readonly colors: AssistColors,
    private readonly speed = 1,
  ) {}

  reset(): void {
    this.timeline.reset();
    this.announcedStep = -1;
  }

  /**
   * Advances the help timeline and draws the aids for the current step. `light` skips the ghost
   * when the device is struggling, so the aids never cost the frame rate the game needs.
   */
  frame(
    ctx: CanvasRenderingContext2D | null,
    body: BodyFrame | null,
    view: GameView | null,
    now: number,
    light: boolean,
  ): AssistView {
    if (!view || view.done) return IDLE;
    const kind = this.kinds[view.stepIndex];
    if (!kind) return IDLE;
    const state = this.timeline.update({
      stepIndex: view.stepIndex,
      now: now * this.speed,
      hold: view.hold,
      paused: !body,
    });
    if (!body) return { level: state.level, hint: null, announce: false };
    const statuses = visibleJoints(kind, jointStatus(body, kind));
    // While the pose is held, the step's own hint (from the engine) is the right message.
    const hint = state.level >= 1 && view.hold === 0 ? jointHint(statuses) : null;
    if (ctx) this.draw(ctx, body, kind, statuses, view.hold, light);
    const announce = hint !== null && this.announcedStep !== view.stepIndex;
    if (announce) this.announcedStep = view.stepIndex;
    return { level: state.level, hint, announce };
  }

  private draw(
    ctx: CanvasRenderingContext2D,
    body: BodyFrame,
    kind: PracticeKind,
    statuses: readonly JointStatus[],
    hold: number,
    light: boolean,
  ): void {
    const ghost = light ? null : ghostSkeleton(body, kind);
    if (ghost) drawGhost(ctx, ghost, this.colors);
    drawJointStatus(ctx, statuses, this.colors, body.shoulderWidth / 60);
    if (hold > 0) {
      const center = toImage(body, { side: 0, depth: -0.85 });
      drawHoldRing(ctx, center, body.shoulderWidth * 0.16, hold, this.colors);
    }
  }
}
