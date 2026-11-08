// Motor de la práctica AR v2. Lee la secuencia validada de `content/protocolos/ar-practica-v2.json`
// y la ejecuta con las mismas reglas geométricas que el motor v1, pero despachando por `kind` en vez
// de por id. Solo se usa con `?practica=v2`; sin la bandera, el AR sigue con GameSession.
import type { ArPracticeStep, PracticeKind } from '@bata/shared/schemas';
import {
  DON_MS,
  FLAP_MS,
  type GameInput,
  type GameView,
  GLOVE_MS,
  HOLD_GRACE_MS,
  INITIAL_SCENE,
  MASK_SNAP_MS,
  type Scene,
} from './game-steps.ts';
import { hangingFrame, sleeveOpenings } from './hanging-gown.ts';
import { handsAtFace } from './mask.ts';
import {
  type BodyFrame,
  dist,
  sideOffset,
  torsoDepth,
  type Vec,
  type Violation,
} from './posture.ts';
import { inSterileBand } from './practice.ts';
import { newTurnTracker, stepTurn, type TurnMode, type TurnTracker } from './practice-turn.ts';

/** Wrist speed (shoulder widths per second) under which the player counts as standing still. */
const STILL_SPEED = 0.6;
/** Wrist depth relative to the shoulders (MediaPipe z) that counts as held out in front. */
const UNFOLD_MAX_DEPTH = -0.25;
/** Nose visibility under which the face counts as hidden (player's back to the camera). */
const FACE_VISIBLE = 0.5;
const NO_BODY = 'Colócate de frente a la cámara, con hombros y caderas visibles';
const FIX_WARNING = 'Corrige el aviso para seguir';

/** `?practica=v2` activa el motor nuevo; cualquier otro valor deja el AR como está. */
export function isPracticeV2Enabled(search: string): boolean {
  return new URLSearchParams(search).get('practica') === 'v2';
}

/**
 * Both wrists at the neckline: near the centre line, around shoulder height and in front of the
 * torso. Used to take the gown by its inner face (step `neck`).
 */
export function handsAtNeck(body: BodyFrame): boolean {
  const shoulderWidth = body.shoulderWidth;
  return [body.left.wrist, body.right.wrist].every((wrist) => {
    if (!wrist) return false;
    const dx = wrist.x - body.shoulderMid.x;
    const dy = wrist.y - body.shoulderMid.y;
    const depth = torsoDepth(body, wrist);
    return (
      Math.abs(dx) <= shoulderWidth * 0.6 &&
      dy >= -shoulderWidth * 0.7 &&
      dy <= shoulderWidth * 0.15 &&
      depth >= -0.25 &&
      depth <= 0.5
    );
  });
}

/**
 * Gown held up and unfolded (step `unfold`): both wrists around shoulder height, in front of the
 * body and apart, as if holding the gown by its shoulders away from the chest.
 */
export function handsUnfolding(body: BodyFrame): boolean {
  const left = body.left.wrist;
  const right = body.right.wrist;
  if (!left || !right) return false;
  // Horizontal spread along the shoulder line, not euclidean: hands stacked vertically don't count.
  const apart = Math.abs(sideOffset(body, left) - sideOffset(body, right)) >= 0.5;
  const atShoulders = [left, right].every((wrist) => {
    const depth = torsoDepth(body, wrist);
    return depth >= -0.3 && depth <= 0.25 && Math.abs(sideOffset(body, wrist)) <= 1.1;
  });
  // Held out in front of the chest (MediaPipe z), not spread to the sides at body depth.
  const inFront = [body.left.wristDepth, body.right.wristDepth].every(
    (depth) => depth !== null && depth <= UNFOLD_MAX_DEPTH,
  );
  return apart && atShoulders && inFront;
}

type CheckResult = { ok: boolean; hint: string };

export interface PracticeV2Options {
  /** Giro del paso `turn`: cuarto de vuelta (v2) o vuelta completa (opción abierta de la v3). */
  turn?: TurnMode;
}

export class PracticeSessionV2 {
  private index = 0;
  private holdStart: number | null = null;
  private completed: string[] = [];
  private turn: TurnTracker = newTurnTracker();
  private readonly turnMode: TurnMode;
  private scene: Scene = INITIAL_SCENE;
  private animStart = 0;
  private lastWrists: [Vec | null, Vec | null] = [null, null];
  private lastT = 0;
  private still = false;
  private missStart: number | null = null;
  private lastHold = 0;

  constructor(
    private readonly steps: readonly ArPracticeStep[],
    private readonly reducedMotion = false,
    options: PracticeV2Options = {},
  ) {
    this.turnMode = options.turn ?? 'cuarto';
  }

  update(input: GameInput): GameView {
    const step = this.steps[this.index];
    this.animate(input.now);
    this.trackStillness(input);
    if (!step) return this.view(1, '');
    // The gown hangs as soon as the "take the gown" step starts.
    if (step.kind === 'neck' && this.scene.gown === 'hidden') {
      this.scene = { ...this.scene, gown: 'hanging' };
    }
    if (!input.body) {
      if (this.paused(input.now)) return this.view(this.lastHold, NO_BODY);
      this.holdStart = null;
      return this.view(0, NO_BODY);
    }
    if (this.index > 0 && input.violations.size > 0) {
      if (this.paused(input.now)) return this.view(this.lastHold, FIX_WARNING);
      this.holdStart = null;
      return this.view(0, FIX_WARNING);
    }

    const result = this.check(step, input);
    if (!result.ok) {
      if (this.paused(input.now)) return this.view(this.lastHold, result.hint);
      this.holdStart = null;
      return this.view(0, result.hint);
    }
    this.missStart = null;
    this.holdStart ??= input.now;
    const hold = Math.min(1, (input.now - this.holdStart) / step.holdMs);
    if (step.kind === 'still') {
      this.scene = { ...this.scene, ties: 'tying', tieT: hold };
    }
    if (step.kind === 'turn' && this.scene.flap === 'open') {
      this.scene = { ...this.scene, flap: 'closing', flapT: 0 };
      this.animStart = input.now;
    }
    if (hold < 1) return this.view(hold, result.hint);
    this.holdStart = null;
    this.advance(step, input.now);
    return this.view(0, this.steps[this.index]?.action ?? '');
  }

  private check(step: ArPracticeStep, input: GameInput): CheckResult {
    const body = input.body as BodyFrame;
    const kind: PracticeKind = step.kind;
    switch (kind) {
      case 'mask': {
        const ok = handsAtFace(input.landmarks, input.size, body.shoulderWidth);
        return { ok, hint: ok ? step.voice : step.correction };
      }
      case 'friction': {
        const inside = inSterileBand(body);
        const ok = inside && !this.still;
        return { ok, hint: ok ? step.voice : inside ? step.correction : step.action };
      }
      case 'band': {
        const ok = inSterileBand(body);
        return { ok, hint: ok ? step.voice : step.correction };
      }
      case 'neck': {
        const ok = handsAtNeck(body);
        return { ok, hint: ok ? step.voice : step.correction };
      }
      case 'sleeves': {
        const openings = sleeveOpenings(hangingFrame(body));
        const reach = body.shoulderWidth * 0.35;
        const wrists = [body.left.wrist, body.right.wrist];
        const inSleeve = (i: 0 | 1) => {
          const wrist = wrists[i];
          return !!wrist && dist(wrist, openings[i]) < reach;
        };
        const sleeves: [boolean, boolean] = [
          this.scene.sleeves[0] || inSleeve(0),
          this.scene.sleeves[1] || inSleeve(1),
        ];
        this.scene = { ...this.scene, sleeves };
        if (!sleeves[0] || !sleeves[1]) {
          return {
            ok: false,
            hint: sleeves[0] || sleeves[1] ? 'Ahora la otra mano en su manga' : step.action,
          };
        }
        const elbowsUp = [body.left.elbow, body.right.elbow].every(
          (elbow) => elbow && torsoDepth(body, elbow) <= 0.4,
        );
        const wristsUp = wrists.every((wrist) => wrist && torsoDepth(body, wrist) <= 0.4);
        const ok = elbowsUp && wristsUp;
        return { ok, hint: ok ? step.voice : step.correction };
      }
      case 'still': {
        const inside = inSterileBand(body);
        const ok = inside && this.still;
        return { ok, hint: ok ? step.voice : inside ? step.correction : step.action };
      }
      case 'gloves': {
        const left = body.left.wrist;
        const right = body.right.wrist;
        const together = !!left && !!right && dist(left, right) <= body.shoulderWidth * 0.45;
        const ok = together && inSterileBand(body);
        return { ok, hint: ok ? step.voice : step.correction };
      }
      case 'unfold': {
        const up = handsUnfolding(body);
        const ok = up && this.still;
        return { ok, hint: ok ? step.voice : up ? step.correction : step.action };
      }
      case 'turn': {
        const frontal = inSterileBand(body);
        const ratio = body.shoulderWidth / body.torsoHeight;
        const faceVisible = (input.landmarks[0]?.visibility ?? 0) >= FACE_VISIBLE;
        const back = stepTurn(
          this.turn,
          { ratio, faceVisible, frontal, now: input.now },
          this.turnMode,
        );
        if (this.turn.baseline === null) {
          return { ok: false, hint: 'De frente a la cámara, con las manos frente al pecho.' };
        }
        if (!back) {
          return {
            ok: false,
            hint: this.turn.path.length > 1 ? 'Sigue girando y vuelve de frente.' : step.action,
          };
        }
        const ok = frontal;
        return { ok, hint: ok ? step.voice : 'Vuelve de frente con las manos frente al pecho.' };
      }
      default:
        return { ok: false, hint: step.action };
    }
  }

  /** True while a miss is recent enough to freeze the hold instead of resetting it. */
  private paused(now: number): boolean {
    this.missStart ??= now;
    return now - this.missStart < HOLD_GRACE_MS;
  }

  private advance(step: ArPracticeStep, now: number): void {
    this.completed.push(step.id);
    this.index += 1;
    this.turn = newTurnTracker();
    if (step.kind === 'mask') this.scene = { ...this.scene, mask: 'snapping', maskT: 0 };
    if (step.kind === 'sleeves') this.scene = { ...this.scene, gown: 'donning', gownT: 0 };
    if (step.kind === 'still') this.scene = { ...this.scene, ties: 'tied', tieT: 1 };
    if (step.kind === 'gloves') this.scene = { ...this.scene, gloves: 'putting', gloveT: 0 };
    if (step.kind === 'turn') this.scene = { ...this.scene, flap: 'closed', flapT: 1 };
    this.animStart = now;
  }

  private animate(now: number): void {
    const scene = this.scene;
    if (scene.mask === 'snapping') {
      const t = this.reducedMotion ? 1 : (now - this.animStart) / MASK_SNAP_MS;
      this.scene = t >= 1 ? { ...scene, mask: 'worn', maskT: 1 } : { ...scene, maskT: t };
    } else if (scene.gown === 'donning') {
      const t = this.reducedMotion ? 1 : (now - this.animStart) / DON_MS;
      this.scene = t >= 1 ? { ...scene, gown: 'worn', gownT: 1 } : { ...scene, gownT: t };
    } else if (scene.gloves === 'putting') {
      const t = this.reducedMotion ? 1 : (now - this.animStart) / GLOVE_MS;
      this.scene = t >= 1 ? { ...scene, gloves: 'on', gloveT: 1 } : { ...scene, gloveT: t };
    } else if (scene.flap === 'closing') {
      const t = this.reducedMotion ? 1 : (now - this.animStart) / FLAP_MS;
      this.scene = { ...scene, flapT: Math.min(1, t) };
    }
  }

  private trackStillness({ body, now }: GameInput): void {
    const wrists: [Vec | null, Vec | null] = [body?.left.wrist ?? null, body?.right.wrist ?? null];
    const dt = (now - this.lastT) / 1000;
    if (body && dt > 0 && dt < 0.5) {
      const speeds = wrists.map((wrist, i) => {
        const previous = this.lastWrists[i];
        return wrist && previous ? dist(wrist, previous) / dt / body.shoulderWidth : 0;
      });
      this.still = Math.max(...speeds) < STILL_SPEED;
    }
    this.lastWrists = wrists;
    this.lastT = now;
  }

  private view(hold: number, hint: string): GameView {
    this.lastHold = hold;
    return {
      stepIndex: this.index,
      hold,
      hint,
      completedIds: [...this.completed],
      done: this.index >= this.steps.length,
      scene: this.scene,
      warningsOn: this.index > 0,
      exempt: this.exempt(),
    };
  }

  /** Reaching into the hanging gown's sleeves passes the wrists by the armpits: not a warning. */
  private exempt(): Violation[] {
    const step = this.steps[this.index];
    const reaching = this.scene.gown === 'hanging' || this.scene.gown === 'donning';
    return step?.kind === 'sleeves' && reaching ? ['axilas'] : [];
  }
}
