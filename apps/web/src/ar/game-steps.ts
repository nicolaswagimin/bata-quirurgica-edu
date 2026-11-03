// Steps of the AR mirror game (content/protocolos/bata-pasos.json → juegoAr). Pure state machine:
// each step has a posture rule that must hold violation-free, and the session also tracks the
// scene the renderer draws (mask floating or worn, gown hidden, hanging, being put on, worn).
// The client only decides when the sequence is done; XP is awarded by POST /quiz/practice.
import type { ArGameStep } from '@bata/shared/schemas';
import { hangingFrame, sleeveOpenings } from './hanging-gown.ts';
import { handsAtFace } from './mask.ts';
import type { FrameSize, Landmark } from './overlay-math.ts';
import { type BodyFrame, dist, torsoDepth, type Violation } from './posture.ts';
import { STEP_RULES, type TurnState } from './practice.ts';

export const MASK_SNAP_MS = 450;
export const DON_MS = 900;

export interface Scene {
  mask: 'floating' | 'snapping' | 'worn';
  /** 0..1 progress of the snap onto the face. */
  maskT: number;
  gown: 'hidden' | 'hanging' | 'donning' | 'worn';
  /** 0..1 progress of the donning animation. */
  gownT: number;
  /** Which sleeve openings already have a wrist in them (player's left, right). */
  sleeves: [boolean, boolean];
}

export interface GameView {
  stepIndex: number;
  hold: number;
  hint: string;
  completedIds: string[];
  done: boolean;
  scene: Scene;
  /** Sterile-technique warnings count from step 2 on (hands are scrubbed from then). */
  warningsOn: boolean;
}

export interface GameInput {
  body: BodyFrame | null;
  landmarks: readonly Landmark[];
  size: FrameSize;
  violations: ReadonlySet<Violation>;
  now: number;
}

const ruleFor = (id: string) => STEP_RULES.find((r) => r.id === id);

export class GameSession {
  private index = 0;
  private holdStart: number | null = null;
  private completed: string[] = [];
  private turn: TurnState = { baselineRatio: null, turned: false };
  private scene: Scene = {
    mask: 'floating',
    maskT: 0,
    gown: 'hidden',
    gownT: 0,
    sleeves: [false, false],
  };
  private animStart = 0;

  constructor(
    private readonly steps: readonly ArGameStep[],
    private readonly reducedMotion = false,
  ) {}

  update(input: GameInput): GameView {
    const step = this.steps[this.index];
    this.animate(input.now);
    if (!step) return this.view(1, '');
    if (!input.body) {
      this.holdStart = null;
      return this.view(0, 'Colócate de frente a la cámara, con hombros y caderas visibles');
    }
    const warningsOn = this.index > 0;
    if (warningsOn && input.violations.size > 0) {
      this.holdStart = null;
      return this.view(0, 'Corrige el aviso para seguir');
    }
    const result = this.check(step, input);
    if (!result.ok) {
      this.holdStart = null;
      return this.view(0, result.hint);
    }
    this.holdStart ??= input.now;
    const hold = Math.min(1, (input.now - this.holdStart) / result.holdMs);
    if (hold < 1) return this.view(hold, result.hint);
    this.holdStart = null;
    if (result.onHeld && !result.onHeld(input.now)) return this.view(0, result.hint);
    this.advance(step.id);
    return this.view(0, this.steps[this.index]?.instruction ?? '');
  }

  /** Each rule: ok, its hint, how long to hold, and an optional action that may delay advancing. */
  private check(
    step: ArGameStep,
    input: GameInput,
  ): { ok: boolean; hint: string; holdMs: number; onHeld?: (now: number) => boolean } {
    const body = input.body as BodyFrame;
    switch (step.id) {
      case 'g1-mascarilla': {
        if (this.scene.mask !== 'floating')
          return { ok: true, hint: step.instruction, holdMs: MASK_SNAP_MS };
        const ok = handsAtFace(input.landmarks, input.size, body.shoulderWidth);
        return {
          ok,
          hint: ok ? 'Así: ajusta la mascarilla sobre nariz y boca' : step.instruction,
          holdMs: 600,
          onHeld: (now) => {
            this.scene = { ...this.scene, mask: 'snapping', maskT: 0 };
            this.animStart = now;
            return this.reducedMotion;
          },
        };
      }
      case 'g3-bata':
        return this.checkGown(step, body);
      default: {
        const legacy = {
          'g2-manos': 'd1',
          'g4-lazos': 'd4',
          'g5-guantes': 'd5',
          'g6-solapa': 'd6',
        }[step.id];
        const rule = legacy ? ruleFor(legacy) : undefined;
        if (!rule) return { ok: false, hint: step.instruction, holdMs: 1000 };
        const r = rule.check(body, this.turn);
        return { ok: r.ok, hint: r.ok ? r.hint : step.instruction, holdMs: rule.holdMs };
      }
    }
  }

  private checkGown(step: ArGameStep, body: BodyFrame) {
    if (this.scene.gown === 'hidden') this.scene = { ...this.scene, gown: 'hanging' };
    if (this.scene.gown === 'donning' || this.scene.gown === 'worn') {
      return { ok: this.scene.gown === 'worn', hint: '¡Bata puesta!', holdMs: 1 };
    }
    const openings = sleeveOpenings(hangingFrame(body));
    const reach = body.shoulderWidth * 0.35;
    const wrists = [body.left.wrist, body.right.wrist];
    const inSleeve = (i: 0 | 1) => {
      const w = wrists[i];
      return !!w && dist(w, openings[i]) < reach;
    };
    const sleeves: [boolean, boolean] = [
      this.scene.sleeves[0] || inSleeve(0),
      this.scene.sleeves[1] || inSleeve(1),
    ];
    this.scene = { ...this.scene, sleeves };
    if (!sleeves[0] || !sleeves[1]) {
      return {
        ok: false,
        hint: sleeves[0] || sleeves[1] ? 'Ahora la otra mano en su manga' : step.instruction,
        holdMs: 1,
      };
    }
    const elbowsUp = [body.left.elbow, body.right.elbow].every(
      (e) => e && torsoDepth(body, e) <= 0.4,
    );
    const wristsUp = wrists.every((w) => w && torsoDepth(body, w) <= 0.4);
    return {
      ok: elbowsUp && wristsUp,
      hint:
        elbowsUp && wristsUp
          ? 'Extiende los brazos… ¡adentro!'
          : 'Ahora extiende los brazos al frente',
      holdMs: 500,
      onHeld: (t: number) => {
        this.scene = { ...this.scene, gown: 'donning', gownT: 0 };
        this.animStart = t;
        return this.reducedMotion;
      },
    };
  }

  private animate(now: number) {
    const s = this.scene;
    if (s.mask === 'snapping') {
      const t = this.reducedMotion ? 1 : (now - this.animStart) / MASK_SNAP_MS;
      this.scene = t >= 1 ? { ...s, mask: 'worn', maskT: 1 } : { ...s, maskT: t };
    } else if (s.gown === 'donning') {
      const t = this.reducedMotion ? 1 : (now - this.animStart) / DON_MS;
      this.scene = t >= 1 ? { ...s, gown: 'worn', gownT: 1 } : { ...s, gownT: t };
    }
  }

  private advance(id: string) {
    this.completed.push(id);
    this.index += 1;
    this.turn = { baselineRatio: null, turned: false };
    if (this.scene.mask !== 'worn') this.scene = { ...this.scene, mask: 'worn', maskT: 1 };
  }

  private view(hold: number, hint: string): GameView {
    return {
      stepIndex: this.index,
      hold,
      hint,
      completedIds: [...this.completed],
      done: this.index >= this.steps.length,
      scene: this.scene,
      warningsOn: this.index > 0,
    };
  }
}

/** Whether the HUD needs a re-render (hold rounded to 5 %). */
export function sameView(a: GameView | null, b: GameView): boolean {
  return (
    !!a &&
    a.stepIndex === b.stepIndex &&
    a.hint === b.hint &&
    a.done === b.done &&
    Math.abs(a.hold - b.hold) < 0.05
  );
}

export function doneView(steps: readonly ArGameStep[]): GameView {
  return {
    stepIndex: steps.length,
    hold: 0,
    hint: '',
    completedIds: steps.map((s) => s.id),
    done: true,
    warningsOn: true,
    scene: { mask: 'worn', maskT: 1, gown: 'worn', gownT: 1, sleeves: [true, true] },
  };
}
